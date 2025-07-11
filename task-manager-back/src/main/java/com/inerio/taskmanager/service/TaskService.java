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

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.nio.file.*;

/**
 * Service layer for Task business logic and persistence.
 * Handles CRUD operations, list actions, and attachment (file) management.
 */
@Service
public class TaskService {

    // ------------------------------------------
    // DEPENDENCIES & CONSTANTS
    // ------------------------------------------
    private final TaskRepository taskRepository;
    private final TaskListRepository taskListRepository;
    private static final String UPLOAD_DIR = "uploads";

    public TaskService(TaskRepository taskRepository, TaskListRepository taskListRepository) {
        this.taskRepository = taskRepository;
        this.taskListRepository = taskListRepository;
    }

    // ------------------------------------------
    // BASIC CRUD OPERATIONS
    // ------------------------------------------

    /**
     * Fetch all tasks.
     */
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    /**
     * Fetch a single task by its ID.
     */
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Get all tasks for a specific TaskList.
     */
    public List<Task> getTasksByListId(Long listId) {
        TaskList list = taskListRepository.findById(listId)
            .orElseThrow(() -> new RuntimeException("TaskList not found with ID " + listId));
        return taskRepository.findByList(list);
    }

    /**
     * Create a new Task from DTO and parent TaskList.
     */
    public Task createTaskFromDto(TaskDto dto, TaskList list) {
        Task task = TaskMapper.toEntity(dto, list);
        return taskRepository.save(task);
    }

    /**
     * Update a Task from DTO and parent TaskList.
     */
    public Task updateTaskFromDto(Long id, TaskDto dto, TaskList list) {
        Task existing = taskRepository.findById(id)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
        existing.setTitle(dto.getTitle());
        existing.setDescription(dto.getDescription());
        existing.setCompleted(dto.isCompleted());
        existing.setDueDate(dto.getDueDate());
        existing.setList(list);
        // creationDate and attachments are not modified here
        return taskRepository.save(existing);
    }

    /**
     * Delete a Task by ID (and attachments on disk).
     */
    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new TaskNotFoundException("Task not found with ID " + id);
        }
        deleteAttachmentsFolder(id);
        taskRepository.deleteById(id);
    }

    /**
     * Delete all tasks for a given TaskList (and all attachments).
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
     * Delete all tasks (and all attachments on disk).
     */
    public void deleteAllTasks() {
        List<Task> tasks = taskRepository.findAll();
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteAll();
    }

    // ------------------------------------------
    // ATTACHMENT MANAGEMENT
    // ------------------------------------------

    /**
     * Upload a file as an attachment for a task.
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
     * Download a specific attachment for a task.
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
     * Delete an attachment from disk and update the Task's attachments list.
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
     * Utility: Delete all attachment files and the upload folder for a given task ID.
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
                        } catch (Exception e) { /* Optional: log */ }
                    });
            }
        } catch (Exception e) {
            // Optional: log error
        }
    }
}
