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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Service layer for {@link Task} domain logic and persistence.
 * <p>
 * Responsibilities:
 * <ul>
 *   <li>CRUD operations and position management (drag-and-drop ordering)</li>
 *   <li>Ownership checks by anonymous owner UID</li>
 *   <li>Attachment handling (upload/download/delete + local filesystem)</li>
 * </ul>
 * <p>
 * Note: HTTP header {@code X-Client-Id} is enforced globally and not duplicated here.
 */
@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final Path baseUploadDir;

    /**
     * Constructs the service with required repositories and application properties.
     *
     * @param taskRepository          repository for tasks
     * @param kanbanColumnRepository  repository for kanban columns
     * @param appProperties           application properties (upload directory)
     */
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

    /**
     * Checks whether the given owner UID owns the specified column.
     *
     * @param uid       owner UID
     * @param columnId  column identifier
     * @return {@code true} if owned by the given UID, {@code false} otherwise
     */
    @Transactional(readOnly = true)
    public boolean ownsColumn(String uid, Long columnId) {
        return kanbanColumnRepository.existsByIdAndBoardOwnerUid(columnId, uid);
    }

    /**
     * Checks whether the given owner UID owns the specified task.
     *
     * @param uid     owner UID
     * @param taskId  task identifier
     * @return {@code true} if owned by the given UID, {@code false} otherwise
     */
    @Transactional(readOnly = true)
    public boolean ownsTask(String uid, Long taskId) {
        return taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(taskId, uid);
    }

    // ==============================
    //   TASK READ OPERATIONS
    // ==============================

    /**
     * Returns all tasks for the given owner UID in a stable UI-friendly order.
     *
     * @param uid owner UID
     * @return ordered list of tasks
     */
    @Transactional(readOnly = true)
    public List<Task> getAllTasksForOwner(String uid) {
        return taskRepository.findAllForOwnerOrdered(uid);
    }

    /**
     * Finds a task by its identifier.
     *
     * @param id task identifier
     * @return optional containing the task if found
     */
    @Transactional(readOnly = true)
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Returns the tasks of a given column ordered by their position.
     *
     * @param kanbanColumnId column identifier
     * @return ordered list of tasks for the column
     * @throws RuntimeException if the column is not found
     */
    @Transactional(readOnly = true)
    public List<Task> getTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        return taskRepository.findByKanbanColumnOrderByPositionAsc(kanbanColumn);
    }

    // ==============================
    //   TASK WRITE OPERATIONS
    // ==============================

    /**
     * Creates a new task from a DTO at the end of the target column.
     *
     * @param dto           request DTO
     * @param kanbanColumn  target column
     * @return persisted task
     */
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

    /**
     * Updates an existing task from a DTO and column.
     *
     * @param id            task identifier
     * @param dto           request DTO
     * @param kanbanColumn  target column
     * @return persisted task
     * @throws TaskNotFoundException if the task is not found
     */
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

    /**
     * Deletes a task, removes its attachment folder, and compacts positions in the column.
     *
     * @param id task identifier
     * @throws TaskNotFoundException if the task is not found
     */
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

    /**
     * Deletes all tasks from a given column and removes their attachment folders.
     *
     * @param kanbanColumnId column identifier
     * @throws RuntimeException if the column is not found
     */
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

    /**
     * Deletes all tasks across all columns of a board.
     *
     * @param boardId board identifier
     */
    @Transactional
    public void deleteTasksByBoardId(Long boardId) {
        kanbanColumnRepository.findByBoardId(boardId)
                .forEach(column -> deleteTasksByKanbanColumnId(column.getId()));
    }

    /**
     * Deletes every task in the system and their attachments.
     * Intended for maintenance/admin operations.
     */
    public void deleteAllTasks() {
        taskRepository.findAll().forEach(t -> deleteAttachmentsFolder(t.getId()));
        taskRepository.deleteAll();
    }

    // ==============================
    //   POSITION / REORDER LOGIC
    // ==============================

    /**
     * Moves a task to a target column and sets its tentative position.
     * <p>
     * Note: On the frontend flow, a subsequent explicit reorder may fine-tune positions.
     *
     * @param taskId               task identifier
     * @param targetKanbanColumnId target column identifier
     * @param targetPosition       target position within the column
     * @throws TaskNotFoundException if the task is not found
     * @throws RuntimeException      if the target column is not found
     */
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

    /**
     * Persists a batch of task position changes (within their current columns).
     *
     * @param reorderedTasks list of (taskId, position)
     * @throws TaskNotFoundException if any referenced task is not found
     */
    @Transactional
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

    /**
     * Uploads a file to the task's attachment directory with basic sanitization and uniqueness checks.
     * The filename is sanitized and path traversal is prevented.
     *
     * @param taskId task identifier
     * @param file   multipart file
     * @return updated task including the new attachment name
     * @throws Exception if IO or validation fails (signature preserved)
     * @throws TaskNotFoundException if the task is not found
     */
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
                Files.copy(in, filePath);
            }
            task.getAttachments().add(safeName);
            taskRepository.save(task);
            return task;
        }
    }

    /**
     * Streams a task attachment as a downloadable resource with proper headers.
     *
     * @param taskId   task identifier
     * @param filename client-provided filename
     * @return HTTP 200 with resource if found; 404 if missing; 400 on invalid input
     */
    public ResponseEntity<Resource> downloadAttachment(Long taskId, String filename) {
        try {
            String safeName = sanitizeFilename(filename);
            Path file = baseUploadDir.resolve(Paths.get(taskId.toString(), safeName)).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) return ResponseEntity.notFound().build();

            MediaType mediaType = MediaTypeFactory.getMediaType(resource)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeName + "\"")
                .contentType(mediaType)
                .body(resource);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Deletes an attachment from the filesystem and removes it from the task.
     * Best-effort cleanup: directory is removed if it becomes empty.
     *
     * @param taskId   task identifier
     * @param filename client-provided filename
     * @return updated task after removal
     * @throws TaskNotFoundException if the task is not found
     */
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
    
    /**
     * Deletes all attachments (files + DB list) for the given task.
     * Best-effort on disk removal; DB list is cleared atomically.
     *
     * @param taskId task identifier
     * @return updated task after cleanup
     * @throws TaskNotFoundException if the task is not found
     */
    @Transactional
    public Task deleteAllAttachments(Long taskId) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

        // Wipe on-disk folder even if DB list is out-of-sync
        deleteAttachmentsFolder(taskId);

        // Clear ElementCollection and persist
        task.getAttachments().clear();
        return taskRepository.save(task);
    }

    /**
     * Recursively deletes the attachment directory for a task if it exists.
     *
     * @param taskId task identifier
     */
    private void deleteAttachmentsFolder(Long taskId) {
        Path taskUploadDir = baseUploadDir.resolve(taskId.toString()).normalize();
        try (var walk = Files.walk(taskUploadDir)) {
            walk.sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception ignored) {
                        // ignore best-effort deletions
                    }
                });
        } catch (Exception ignored) {
            // ignore if folder does not exist or cannot be walked
        }
    }

    /**
     * Basic filename sanitizer:
     * <ul>
     *   <li>Removes any path component, keeps the basename only</li>
     *   <li>Replaces unsafe characters and control chars with underscores</li>
     *   <li>Trims to a maximum length</li>
     * </ul>
     *
     * @param name client-provided filename
     * @return sanitized file name safe for local storage
     * @throws IllegalArgumentException for empty or invalid names
     */
    private static String sanitizeFilename(String name) {
        String base = Paths.get(name).getFileName().toString();
        base = base.replaceAll("[\\r\\n\\t]", "_");
        base = base.replaceAll("[^A-Za-z0-9._-]", "_");
        if (base.length() > 255) base = base.substring(0, 255);
        if (base.equals(".") || base.equals("..") || base.isBlank()) throw new IllegalArgumentException("Invalid filename");
        return base;
    }
}
