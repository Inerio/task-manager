package com.inerio.taskmanager.service;

import com.inerio.taskmanager.config.AppProperties;
import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapperDto;
import com.inerio.taskmanager.dto.TaskReorderDto;
import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Service for business logic and persistence of {@link Task} entities.
 * Provides CRUD operations, drag-and-drop position management, and attachment handling.
 */
@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final Path baseUploadDir;

    public TaskService(TaskRepository taskRepository,
                       KanbanColumnRepository kanbanColumnRepository,
                       AppProperties appProperties) {
        this.taskRepository = taskRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.baseUploadDir = Paths.get(appProperties.getUploadDir()).toAbsolutePath().normalize();
    }

    // ==============================
    //   OWNERSHIP HELPERS
    // ==============================

    public boolean ownsColumn(String uid, Long columnId) {
        return kanbanColumnRepository.existsByIdAndBoardOwnerUid(columnId, uid);
    }

    public boolean ownsTask(String uid, Long taskId) {
        return taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(taskId, uid);
    }

    // ==============================
    //   TASK READ OPERATIONS
    // ==============================

    /** Return all tasks scoped to an owner UID, in a stable order for the UI. */
    public List<Task> getAllTasksForOwner(String uid) {
        return taskRepository.findAllForOwnerOrdered(uid);
    }

    public Optional<Task> getTaskById(Long id) { return taskRepository.findById(id); }

    public List<Task> getTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        return taskRepository.findByKanbanColumnOrderByPositionAsc(kanbanColumn);
    }

    // ==============================
    //   TASK WRITE OPERATIONS
    // ==============================

    @Transactional
    public Task createTaskFromDto(TaskDto dto, KanbanColumn kanbanColumn) {
        Task task = TaskMapperDto.toEntity(dto, kanbanColumn);
        int maxPosition = 0;
        List<Task> current = taskRepository.findByKanbanColumnOrderByPositionAsc(kanbanColumn);
        if (!current.isEmpty()) {
            maxPosition = current.get(current.size() - 1).getPosition() + 1;
        }
        task.setPosition(maxPosition);
        return taskRepository.save(task);
    }

    @Transactional
    public Task updateTaskFromDto(Long id, TaskDto dto, KanbanColumn kanbanColumn) {
        Task existing = taskRepository.findById(id)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
        existing.setTitle(dto.getTitle());
        existing.setDescription(dto.getDescription());
        existing.setCompleted(dto.isCompleted());
        existing.setDueDate(dto.getDueDate());
        existing.setKanbanColumn(kanbanColumn);
        return taskRepository.save(existing);
    }

    @Transactional
    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
        KanbanColumn kanbanColumn = task.getKanbanColumn();
        int deletedPos = task.getPosition();

        deleteAttachmentsFolder(id);
        taskRepository.deleteById(id);

        List<Task> toShift = taskRepository.findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(kanbanColumn, deletedPos);
        for (Task t : toShift) {
            t.setPosition(t.getPosition() - 1);
        }
        taskRepository.saveAll(toShift);
    }

    @Transactional
    public void deleteTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        List<Task> tasks = taskRepository.findByKanbanColumn(kanbanColumn);
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteAll(tasks);
    }

    @Transactional
    public void deleteTasksByBoardId(Long boardId) {
        kanbanColumnRepository.findByBoardId(boardId)
                .forEach(column -> deleteTasksByKanbanColumnId(column.getId()));
    }

    public void deleteAllTasks() {
        taskRepository.findAll().forEach(t -> deleteAttachmentsFolder(t.getId()));
        taskRepository.deleteAll();
    }

    // ==============================
    //   POSITION / REORDER LOGIC
    // ==============================

    @Transactional
    public void moveTask(Long taskId, Long targetKanbanColumnId, int targetPosition) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        KanbanColumn targetColumn = kanbanColumnRepository.findById(targetKanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + targetKanbanColumnId));

        task.setKanbanColumn(targetColumn);
        task.setPosition(targetPosition);
        taskRepository.save(task);
    }

    public void reorderTasks(List<TaskReorderDto> reorderedTasks) {
        List<Task> tasksToUpdate = new ArrayList<>();
        for (TaskReorderDto dto : reorderedTasks) {
            Task task = taskRepository.findById(dto.getId())
                .orElseThrow(() -> new TaskNotFoundException("Task not found with id: " + dto.getId()));
            task.setPosition(dto.getPosition());
            tasksToUpdate.add(task);
        }
        taskRepository.saveAll(tasksToUpdate);
    }

    // ==============================
    //   ATTACHMENT MANAGEMENT
    // ==============================

    /** Uploads an attachment to a task, ensuring a non-empty and unique filename per task. */
    public Task uploadAttachment(Long taskId, MultipartFile file) throws Exception {
        Path uploadPath = baseUploadDir.resolve(taskId.toString()).normalize();
        Files.createDirectories(uploadPath);

        String original = file.getOriginalFilename();
        if (original == null || original.isBlank()) throw new IllegalArgumentException("Invalid filename");

        String safeName = sanitizeFilename(original);
        Path filePath = uploadPath.resolve(safeName).normalize();

        // Prevent path traversal
        if (!filePath.toAbsolutePath().startsWith(uploadPath.toAbsolutePath())) {
            throw new IllegalArgumentException("Invalid filename");
        }

        synchronized (this) {
            Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

            if (task.getAttachments().contains(safeName)) {
                throw new IllegalStateException("Attachment already exists: " + safeName);
            }
            if (Files.exists(filePath)) {
                throw new IllegalStateException("A file with this name already exists on the server: " + safeName);
            }

            try (var in = file.getInputStream()) {
                Files.copy(in, filePath); // no REPLACE_EXISTING
            }
            task.getAttachments().add(safeName);
            taskRepository.save(task);
            return task;
        }
    }

    public ResponseEntity<Resource> downloadAttachment(Long taskId, String filename) {
        try {
            String safeName = sanitizeFilename(filename);
            Path file = baseUploadDir.resolve(Paths.get(taskId.toString(), safeName)).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) return ResponseEntity.notFound().build();
            return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + safeName + "\"")
                .body(resource);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public Task deleteAttachment(Long taskId, String filename) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        String safeName = sanitizeFilename(filename);
        Path filePath = baseUploadDir.resolve(Paths.get(taskId.toString(), safeName)).normalize();
        try {
            Files.deleteIfExists(filePath);
            task.getAttachments().remove(safeName);
            taskRepository.save(task);
            Path dirPath = baseUploadDir.resolve(taskId.toString());
            try (DirectoryStream<Path> s = Files.newDirectoryStream(dirPath)) {
                if (!s.iterator().hasNext()) Files.deleteIfExists(dirPath);
            }
        } catch (Exception ignored) {
            // best-effort cleanup
        }
        return task;
    }

    private void deleteAttachmentsFolder(Long taskId) {
        Path taskUploadDir = baseUploadDir.resolve(taskId.toString()).normalize();
        try {
            if (Files.exists(taskUploadDir)) {
                Files.walk(taskUploadDir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try { Files.deleteIfExists(path); } catch (Exception ignored) {}
                    });
            }
        } catch (Exception ignored) { }
    }

    /** Very small sanitizer: keep basename, replace unsafe chars, limit length. */
    private static String sanitizeFilename(String name) {
        String base = Paths.get(name).getFileName().toString(); // drop any path
        base = base.replaceAll("[\\r\\n\\t]", "_");
        base = base.replaceAll("[^A-Za-z0-9._-]", "_");
        if (base.length() > 255) base = base.substring(0, 255);
        if (base.equals(".") || base.equals("..") || base.isBlank()) throw new IllegalArgumentException("Invalid filename");
        return base;
    }
}
