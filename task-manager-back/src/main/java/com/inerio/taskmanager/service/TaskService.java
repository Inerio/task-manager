package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapper;
import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.TaskList;
import com.inerio.taskmanager.repository.TaskRepository;
import com.inerio.taskmanager.repository.TaskListRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;

import java.nio.file.*;
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
 *     <li>Supports moving tasks between lists and positions.</li>
 *     <li>Manages file upload, download, and deletion per task.</li>
 * </ul>
 */
@Service
public class TaskService {

    /** JPA repository for Task persistence and custom queries. */
    private final TaskRepository taskRepository;
    /** JPA repository for TaskList access (used for parent/column operations). */
    private final TaskListRepository taskListRepository;
    /** Directory where all task attachments are stored (per task ID subfolder). */
    private static final String UPLOAD_DIR = "uploads";

    /**
     * Dependency injection constructor.
     *
     * @param taskRepository     Repository for Task.
     * @param taskListRepository Repository for TaskList.
     */
    public TaskService(TaskRepository taskRepository, TaskListRepository taskListRepository) {
        this.taskRepository = taskRepository;
        this.taskListRepository = taskListRepository;
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
     * Gets all tasks belonging to a given list (Kanban column), sorted by position.
     * @param listId ID of the TaskList (column).
     * @return All tasks, ordered by position.
     * @throws RuntimeException if TaskList does not exist.
     */
    public List<Task> getTasksByListId(Long listId) {
        TaskList list = taskListRepository.findById(listId)
            .orElseThrow(() -> new RuntimeException("TaskList not found with ID " + listId));
        return taskRepository.findByListOrderByPositionAsc(list);
    }

    /**
     * Creates a new Task from a DTO and a parent TaskList, placing it at the end of the column.
     * <p>
     * Ensures no gaps in position indices.
     * </p>
     *
     * @param dto  DTO describing the new task.
     * @param list Parent TaskList entity.
     * @return Persisted Task entity.
     */
    @Transactional
    public Task createTaskFromDto(TaskDto dto, TaskList list) {
        Task task = TaskMapper.toEntity(dto, list);
        int maxPosition = 0;
        List<Task> current = taskRepository.findByListOrderByPositionAsc(list);
        if (!current.isEmpty()) {
            maxPosition = current.get(current.size() - 1).getPosition() + 1;
        }
        task.setPosition(maxPosition); // Always append at the end
        return taskRepository.save(task);
    }

    /**
     * Updates an existing Task's core fields from DTO. Does not change its position or list.
     * <p>
     * Use {@link #moveTask(Long, Long, int)} to change position or column.
     * </p>
     *
     * @param id   ID of the Task to update.
     * @param dto  DTO with new values.
     * @param list Target list (must be valid).
     * @return Updated Task entity.
     * @throws TaskNotFoundException if task does not exist.
     */
    @Transactional
    public Task updateTaskFromDto(Long id, TaskDto dto, TaskList list) {
        Task existing = taskRepository.findById(id)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
        existing.setTitle(dto.getTitle());
        existing.setDescription(dto.getDescription());
        existing.setCompleted(dto.isCompleted());
        existing.setDueDate(dto.getDueDate());
        existing.setList(list);
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
        TaskList list = task.getList();
        int deletedPos = task.getPosition();

        deleteAttachmentsFolder(id);
        taskRepository.deleteById(id);

        // Shift positions for tasks below the deleted one in the column
        List<Task> toShift = taskRepository.findByListAndPositionGreaterThanOrderByPositionAsc(list, deletedPos);
        for (Task t : toShift) {
            t.setPosition(t.getPosition() - 1);
        }
        taskRepository.saveAll(toShift);
    }

    /**
     * Deletes all tasks for a given list/column (and all their attachments).
     * @param listId List ID.
     * @throws RuntimeException if list does not exist.
     */
    @Transactional
    public void deleteTasksByListId(Long listId) {
        TaskList list = taskListRepository.findById(listId)
            .orElseThrow(() -> new RuntimeException("TaskList not found with ID " + listId));
        List<Task> tasks = taskRepository.findByList(list);
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteAll(tasks);
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
     * Moves a task to a new list (column) and/or a new position.
     * <p>
     * Ensures all positions in each column remain unique and continuous.
     * </p>
     *
     * @param taskId         ID of the task to move.
     * @param targetListId   ID of the target column.
     * @param targetPosition Zero-based position in the target column.
     * @throws TaskNotFoundException if the task does not exist.
     * @throws RuntimeException if the target list does not exist.
     */
    @Transactional
    public void moveTask(Long taskId, Long targetListId, int targetPosition) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        TaskList oldList = task.getList();
        int oldPosition = task.getPosition();

        TaskList newList = taskListRepository.findById(targetListId)
            .orElseThrow(() -> new RuntimeException("TaskList not found with ID " + targetListId));

        if (oldList.getId().equals(newList.getId())) {
            // Move within same column
            if (targetPosition == oldPosition) return; // nothing to do

            List<Task> tasks = taskRepository.findByListOrderByPositionAsc(oldList);
            if (targetPosition < oldPosition) {
                // Moving up: shift down all between [targetPosition, oldPosition-1]
                for (Task t : tasks) {
                    int p = t.getPosition();
                    if (p >= targetPosition && p < oldPosition) {
                        t.setPosition(p + 1);
                    }
                }
            } else {
                // Moving down: shift up all between [oldPosition+1, targetPosition]
                for (Task t : tasks) {
                    int p = t.getPosition();
                    if (p > oldPosition && p <= targetPosition) {
                        t.setPosition(p - 1);
                    }
                }
            }
            task.setPosition(targetPosition);
            taskRepository.saveAll(tasks);
            taskRepository.save(task);
        } else {
            // Move to different column
            // Shift positions up in old column
            List<Task> oldTasks = taskRepository.findByListAndPositionGreaterThanOrderByPositionAsc(oldList, oldPosition);
            for (Task t : oldTasks) {
                t.setPosition(t.getPosition() - 1);
            }
            taskRepository.saveAll(oldTasks);

            // Shift positions down in new column starting from targetPosition
            List<Task> newTasks = taskRepository.findByListAndPositionGreaterThanEqualOrderByPositionAsc(newList, targetPosition);
            for (Task t : newTasks) {
                t.setPosition(t.getPosition() + 1);
            }
            taskRepository.saveAll(newTasks);

            // Move task itself
            task.setList(newList);
            task.setPosition(targetPosition);
            taskRepository.save(task);
        }
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
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

        Path uploadPath = Paths.get(UPLOAD_DIR, taskId.toString());
        Files.createDirectories(uploadPath);

        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Invalid filename");
        }
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
                            // Optional: log error
                        }
                    });
            }
        } catch (Exception e) {
            // Optional: log error
        }
    }
}
