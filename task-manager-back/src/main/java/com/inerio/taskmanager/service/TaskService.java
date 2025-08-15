package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapperDto;
import com.inerio.taskmanager.dto.TaskReorderDto;
import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
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
 * <p>
 * Provides CRUD operations, drag-and-drop position management, and attachment handling.
 * </p>
 */
@Service
public class TaskService {

    /** Base directory where task attachments are stored (one subfolder per task ID). */
    private static final String UPLOAD_DIR = "uploads";

    private final TaskRepository taskRepository;
    private final KanbanColumnRepository kanbanColumnRepository;

    public TaskService(TaskRepository taskRepository, KanbanColumnRepository kanbanColumnRepository) {
        this.taskRepository = taskRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
    }

    // ==============================
    //   OWNERSHIP HELPERS
    // ==============================

    /**
     * Checks whether the given column is owned by the user identified by {@code uid}.
     *
     * @param uid      anonymous user identifier
     * @param columnId column ID to check
     * @return {@code true} if the column belongs to a board owned by the user; {@code false} otherwise
     */
    public boolean ownsColumn(String uid, Long columnId) {
        return kanbanColumnRepository.existsByIdAndBoardOwnerUid(columnId, uid);
    }

    /**
     * Checks whether the given task is owned by the user identified by {@code uid}.
     *
     * @param uid    anonymous user identifier
     * @param taskId task ID to check
     * @return {@code true} if the task belongs to a board owned by the user; {@code false} otherwise
     */
    public boolean ownsTask(String uid, Long taskId) {
        return taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(taskId, uid);
    }

    // ==============================
    //   TASK CRUD OPERATIONS
    // ==============================

    /**
     * Retrieves all tasks (unordered).
     *
     * @return list of all tasks
     */
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    /**
     * Finds a task by its ID.
     *
     * @param id task ID
     * @return optional task
     */
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Retrieves all tasks for a given column, ordered by position.
     *
     * @param kanbanColumnId column ID
     * @return ordered list of tasks
     * @throws RuntimeException if the column does not exist
     */
    public List<Task> getTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        return taskRepository.findByKanbanColumnOrderByPositionAsc(kanbanColumn);
    }

    /**
     * Creates a new task from a DTO and places it at the end of the given column.
     *
     * @param dto          task data
     * @param kanbanColumn parent column
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
     * Updates core fields of an existing task from a DTO. Position and column ordering are not changed.
     * Use {@link #moveTask(Long, Long, int)} to change column/position.
     *
     * @param id           task ID to update
     * @param dto          new task values
     * @param kanbanColumn target column
     * @return updated task
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
     * Deletes a task by ID, removes its attachment folder from disk, and compacts positions in the column.
     *
     * @param id task ID
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
     * Deletes all tasks for the given column and removes their attachment folders.
     *
     * @param kanbanColumnId column ID
     * @throws RuntimeException if the column does not exist
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
     * Deletes all tasks belonging to all columns of the given board.
     *
     * @param boardId board ID
     */
    @Transactional
    public void deleteTasksByBoardId(Long boardId) {
        List<KanbanColumn> columns = kanbanColumnRepository.findByBoardId(boardId);
        for (KanbanColumn column : columns) {
            deleteTasksByKanbanColumnId(column.getId());
        }
    }

    /**
     * Deletes every task in the database and removes all attachment folders.
     */
    public void deleteAllTasks() {
        List<Task> tasks = taskRepository.findAll();
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteAll();
    }

    // ==============================
    //   POSITION / REORDER LOGIC
    // ==============================

    /**
     * Moves a task to a new column and/or assigns a temporary position.
     * <p>
     * Normalization of positions in the target column is expected to be performed via
     * {@link #reorderTasks(List)}.
     * </p>
     *
     * @param taskId               task to move
     * @param targetKanbanColumnId target column ID
     * @param targetPosition       zero-based temporary position in target column
     * @throws TaskNotFoundException if the task does not exist
     * @throws RuntimeException      if the target column does not exist
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
     * Bulk-updates task positions according to the provided list.
     *
     * @param reorderedTasks list of (taskId, position) entries
     * @throws TaskNotFoundException if any task ID does not exist
     */
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
     * Uploads an attachment to a task, ensuring a non-empty and unique filename per task.
     *
     * @param taskId task ID
     * @param file   multipart file
     * @return updated task including the new filename in its attachments list
     * @throws Exception if the upload fails or validation is not met
     */
    public Task uploadAttachment(Long taskId, MultipartFile file) throws Exception {
        Path uploadPath = Paths.get(UPLOAD_DIR, taskId.toString());
        Files.createDirectories(uploadPath);

        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Invalid filename");
        }

        synchronized (this) {
            Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

            if (task.getAttachments().contains(filename)) {
                throw new IllegalStateException("Attachment already exists: " + filename);
            }
            Path filePath = uploadPath.resolve(filename);
            if (Files.exists(filePath)) {
                throw new IllegalStateException("A file with this name already exists on the server: " + filename);
            }

            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            task.getAttachments().add(filename);
            taskRepository.save(task);

            return task;
        }
    }

    /**
     * Streams an attachment file for a task.
     *
     * @param taskId   task ID
     * @param filename attachment filename
     * @return 200 with resource if found, 404 if missing, or 400 on error
     */
    public ResponseEntity<Resource> downloadAttachment(Long taskId, String filename) {
        try {
            Path file = Paths.get(UPLOAD_DIR, taskId.toString(), filename);
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(resource);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Deletes a single attachment and removes the task folder if it becomes empty.
     *
     * @param taskId   task ID
     * @param filename attachment filename to delete
     * @return updated task after removal
     * @throws TaskNotFoundException if the task does not exist
     */
    public Task deleteAttachment(Long taskId, String filename) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        Path filePath = Paths.get(UPLOAD_DIR, taskId.toString(), filename);
        try {
            Files.deleteIfExists(filePath);
            task.getAttachments().remove(filename);
            taskRepository.save(task);
            Path dirPath = Paths.get(UPLOAD_DIR, taskId.toString());
            if (Files.isDirectory(dirPath) && Files.list(dirPath).findAny().isEmpty()) {
                Files.delete(dirPath);
            }
        } catch (Exception ignored) {
            // best-effort cleanup
        }
        return task;
    }

    /**
     * Deletes the entire attachments directory for a given task ID, if present.
     *
     * @param taskId task ID
     */
    private void deleteAttachmentsFolder(Long taskId) {
        Path taskUploadDir = Paths.get(UPLOAD_DIR, taskId.toString());
        try {
            if (Files.exists(taskUploadDir)) {
                Files.walk(taskUploadDir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (Exception e) {
                            // best-effort cleanup
                        }
                    });
            }
        } catch (Exception e) {
            // best-effort cleanup
        }
    }
}
