package com.inerio.taskmanager.service;

import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.repository.TaskRepository;

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
 * Handles CRUD, column actions, and file (attachment) management.
 */
@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private static final String UPLOAD_DIR = "uploads";

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    // ------------------------
    // Basic CRUD operations
    // ------------------------

    /**
     * Fetch all tasks from the database.
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
     * Create or update a task.
     */
    public Task createTask(Task task) {
        return taskRepository.save(task);
    }

    /**
     * Delete a task by ID.
     * @throws TaskNotFoundException if ID does not exist.
     */
    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new TaskNotFoundException("Task not found with ID " + id);
        }

        deleteAttachmentsFolder(id);

        // Delete the task from the database
        taskRepository.deleteById(id);
    }


    /**
     * Delete all tasks for a specific status (column).
     */
    @Transactional
    public void deleteTasksByStatus(String status) {
        List<Task> tasks = taskRepository.findByStatus(status);
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteByStatus(status);
    }

    /**
     * Delete all tasks from the database.
     */
    public void deleteAllTasks() {
        List<Task> tasks = taskRepository.findAll();
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteAll();
    }

    /**
     * Update a task by its ID.
     * @throws TaskNotFoundException if the ID does not exist.
     */
    public Task updateTask(Long id, Task updatedTask) {
        Task existing = taskRepository.findById(id)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));

        existing.setTitle(updatedTask.getTitle());
        existing.setDescription(updatedTask.getDescription());
        existing.setCompleted(updatedTask.isCompleted());
        existing.setStatus(updatedTask.getStatus());
        existing.setDueDate(updatedTask.getDueDate());

        return taskRepository.save(existing);
    }

    // ------------------------
    // Attachments management
    // ------------------------

    /**
     * Uploads a file as an attachment for a task.
     * Files are stored in /uploads/{taskId}/.
     * The filename is saved in the attachments list of the Task.
     * 
     * Throws an exception if the file already exists in the attachments list.
     * @throws TaskNotFoundException if task does not exist.
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

        // Check for duplicate filename in the task's attachments list
        if (task.getAttachments().contains(filename)) {
            throw new IllegalStateException("Attachment already exists: " + filename);
        }

        Path filePath = uploadPath.resolve(filename);

        // Extra check: file should not already exist on disk
        if (Files.exists(filePath)) {
            throw new IllegalStateException("A file with this name already exists on the server: " + filename);
        }

        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        // Add to task and save
        task.getAttachments().add(filename);
        taskRepository.save(task);

        return task;
    }


    /**
     * Downloads a specific attachment for a task.
     * Returns the file as a Resource, with appropriate headers.
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
     * Deletes an attachment from disk, delete the folder if it is empty after file deletion and updates the Task's attachments list.
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

        } catch (Exception ignored) {}
        return task;
    }
    
    /**
     * Delete all attachment files and the upload folder for a given task ID.
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
                        } catch (Exception e) { /* log if needed */ }
                    });
            }
        } catch (Exception e) {
            // Optional: log error
        }
    }

}
