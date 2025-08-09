package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapperDto;
import com.inerio.taskmanager.dto.TaskReorderDto;
import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.TaskRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;

import java.nio.file.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Service layer for business logic and persistence of Task entities.
 * <p>
 * Handles CRUD operations, position management (drag &amp; drop), and file attachment handling for Kanban tasks.
 * </p>
 * <ul>
 *     <li>Ensures tasks are always ordered and correctly positioned.</li>
 *     <li>Supports moving tasks between columns and positions.</li>
 *     <li>Manages file upload, download, and deletion per task.</li>
 * </ul>
 */
@Service
public class TaskService {

    /** JPA repository for Task persistence and custom queries. */
    private final TaskRepository taskRepository;
    /** JPA repository for KanbanColumn access (used for parent/column operations). */
    private final KanbanColumnRepository kanbanColumnRepository;
    /** Directory where all task attachments are stored (per task ID subfolder). */
    private static final String UPLOAD_DIR = "uploads";

    /**
     * Dependency injection constructor.
     *
     * @param taskRepository     Repository for Task.
     * @param kanbanColumnRepository Repository for KanbanColumn.
     */
    public TaskService(TaskRepository taskRepository, KanbanColumnRepository kanbanColumnRepository) {
        this.taskRepository = taskRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
    }

    // ==============================
    //   TASK CRUD OPERATIONS
    // ==============================

    /**
     * Returns all tasks in the database (unordered).
     * @return All persisted Task entities.
     */
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    /**
     * Finds a Task by its ID.
     * @param id Task ID.
     * @return Optional Task entity.
     */
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Gets all tasks belonging to a given column, sorted by position.
     * @param kanbanColumnId ID of the KanbanColumn (column).
     * @return All tasks, ordered by position.
     * @throws RuntimeException if KanbanColumn does not exist.
     */
    public List<Task> getTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        return taskRepository.findByKanbanColumnOrderByPositionAsc(kanbanColumn);
    }

    /**
     * Creates a new Task from a DTO and a parent KanbanColumn, placing it at the end of the column.
     * <p>
     * Ensures no gaps in position indices.
     * </p>
     *
     * @param dto  DTO describing the new task.
     * @param kanbanColumn Parent KanbanColumn entity.
     * @return Persisted Task entity.
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
     * Updates an existing Task's core fields from DTO. Does not change its position or column.
     * <p>
     * Use {@link #moveTask(Long, Long, int)} to change position or column.
     * </p>
     *
     * @param id   ID of the Task to update.
     * @param dto  DTO with new values.
     * @param kanbanColumn Target column (must be valid).
     * @return Updated Task entity.
     * @throws TaskNotFoundException if task does not exist.
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
        // position is NOT updated here
        return taskRepository.save(existing);
    }

    /**
     * Deletes a Task by ID, removes its attachments from disk, and repacks following tasks' positions.
     * <p>
     * After removal, tasks below this one in the column shift up (their position decrements).
     * </p>
     *
     * @param id Task ID to delete.
     * @throws TaskNotFoundException if task does not exist.
     */
    @Transactional
    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
        KanbanColumn kanbanColumn = task.getKanbanColumn();
        int deletedPos = task.getPosition();

        deleteAttachmentsFolder(id);
        taskRepository.deleteById(id);

        // Shift positions for tasks below the deleted one in the column
        List<Task> toShift = taskRepository.findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(kanbanColumn, deletedPos);
        for (Task t : toShift) {
            t.setPosition(t.getPosition() - 1);
        }
        taskRepository.saveAll(toShift);
    }

    /**
     * Deletes all tasks for a given column (and all their attachments).
     * @param kanbanColumnId Column ID.
     * @throws RuntimeException if column does not exist.
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
     * Deletes all tasks belonging to all columns of a given board.
     * @param boardId ID of the board whose tasks should be deleted.
     */
    @Transactional
    public void deleteTasksByBoardId(Long boardId) {
        List<KanbanColumn> columns = kanbanColumnRepository.findByBoardId(boardId);
        for (KanbanColumn column : columns) {
            deleteTasksByKanbanColumnId(column.getId());
        }
    }

    /**
     * Deletes all tasks in the database (and all attachments).
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
     * Moves a task to a new column and/or a new position, without shifting other tasks in either column.
     * <p>
     * This method is intentionally minimal: it simply updates the task's column reference and assigns it the provided position.
     * <b>Important:</b> The actual reordering and normalization of all positions in the target column is
     * expected to be handled by a subsequent call to {@link #reorderTasks(List)}. This avoids double logic
     * and keeps position consistency delegated to a single endpoint.
     * </p>
     *
     * <ul>
     *   <li>Does <b>not</b> shift any other task positions.</li>
     *   <li>Should always be followed by a call to <b>/reorder</b> (frontend responsibility).</li>
     *   <li>Leads to consistent, predictable state on both client and server.</li>
     * </ul>
     *
     * @param taskId ID of the task to move.
     * @param targetKanbanColumnId ID of the target Kanban column.
     * @param targetPosition Zero-based index in the target column (for information only; will be normalized by reorder).
     * @throws TaskNotFoundException if the task does not exist.
     * @throws RuntimeException if the target column does not exist.
     */
    @Transactional
    public void moveTask(Long taskId, Long targetKanbanColumnId, int targetPosition) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        KanbanColumn targetColumn = kanbanColumnRepository.findById(targetKanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + targetKanbanColumnId));

        // Directly set the new column (position will be set by reorderTasks).
        task.setKanbanColumn(targetColumn);
        // Optionally, set the position to targetPosition, but this will be overwritten by reorderTasks
        task.setPosition(targetPosition);
        taskRepository.save(task);
    }

    
    /**
     * Reorders multiple tasks by updating their positions based on the provided list.
     * <p>
     * Expects a list of TaskReorderDto where each entry defines a task ID and its new position.
     * The method does not check for column consistency, assuming all tasks belong to the same column.
     * </p>
     *
     * @param reorderedTasks List of task reordering instructions (task ID + new position).
     * @throws TaskNotFoundException if any of the provided task IDs do not exist.
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
     * Uploads an attachment to a given task. Validates file name and uniqueness.
     * @param taskId Task to attach the file to.
     * @param file   Uploaded file (multipart).
     * @return Updated Task entity with new attachment reference.
     * @throws Exception if upload fails or constraints are not respected.
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
     * Downloads an attachment for a task as a streamed resource.
     * @param taskId   Task to fetch from.
     * @param filename Name of the attachment.
     * @return ResponseEntity with the resource or error.
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
            // Optional: log the error for debugging
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Deletes an attachment for a task, removes file on disk, and updates the Task entity.
     * Also deletes the task's upload folder if empty.
     *
     * @param taskId   Task entity.
     * @param filename Name of attachment to remove.
     * @return Updated Task entity.
     */
    public Task deleteAttachment(Long taskId, String filename) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        Path filePath = Paths.get(UPLOAD_DIR, taskId.toString(), filename);
        try {
            Files.deleteIfExists(filePath);
            task.getAttachments().remove(filename);
            taskRepository.save(task);
            // Delete folder if empty
            Path dirPath = Paths.get(UPLOAD_DIR, taskId.toString());
            if (Files.isDirectory(dirPath) && Files.list(dirPath).findAny().isEmpty()) {
                Files.delete(dirPath);
            }
        } catch (Exception ignored) {}
        return task;
    }

    /**
     * Helper method to delete all attachments for a given task (used on task delete).
     * @param taskId Task entity ID.
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
                            // log error
                        }
                    });
            }
        } catch (Exception e) {
            // log error
        }
    }
}
