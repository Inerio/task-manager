package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.service.TaskService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;

/**
 * REST controller for task management (CRUD, column actions, attachments).
 */
@RestController
@RequestMapping("/api/v1/tasks")
@CrossOrigin(origins = "*") // Restrict in production!
public class TaskController {

    private final TaskService taskService;
    private static final Logger log = LoggerFactory.getLogger(TaskController.class);

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // -----------
    // Task CRUD
    // -----------

    /**
     * Get all tasks.
     */
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks() {
        List<Task> tasks = taskService.getAllTasks();
        if (tasks.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(tasks);
    }

    /**
     * Get task by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new task.
     */
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        Task createdTask = taskService.createTask(task);
        URI location = URI.create("/" + createdTask.getId());
        return ResponseEntity.created(location).body(createdTask);
    }

    /**
     * Update an existing task.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task updatedTask) {
        try {
            Task savedTask = taskService.updateTask(id, updatedTask);
            return ResponseEntity.ok(savedTask);
        } catch (RuntimeException e) {
            log.warn("Task not found for update: {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete a task by ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        if (taskService.getTaskById(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete all tasks for a specific status (column).
     */
    @DeleteMapping("/status/{status}")
    public ResponseEntity<Void> deleteTasksByStatus(@PathVariable String status) {
        taskService.deleteTasksByStatus(status);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete all tasks.
     */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks() {
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build();
    }

    // ------------------------
    // Attachment endpoints
    // ------------------------

    /**
     * Upload an attachment for a given task.
     */
    @PostMapping("/{id}/attachments")
    public ResponseEntity<?> uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        try {
            Task updatedTask = taskService.uploadAttachment(id, file);
            return ResponseEntity.ok(updatedTask);
        } catch (IllegalStateException e) {
            // Duplicate file error: HTTP 409 Conflict
            log.warn("Attachment upload failed for task {}: {}", id, e.getMessage());
            return ResponseEntity.status(409).body(e.getMessage());
        } catch (Exception e) {
            log.warn("Attachment upload failed for task {}: {}", id, e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }


    /**
     * Download a specific attachment for a task.
     */
    @GetMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> downloadAttachment(
            @PathVariable Long id,
            @PathVariable String filename) {
        return taskService.downloadAttachment(id, filename);
    }

    /**
     * Delete an attachment from a task.
     */
    @DeleteMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> deleteAttachment(
            @PathVariable Long id,
            @PathVariable String filename) {
        Task updatedTask = taskService.deleteAttachment(id, filename);
        return ResponseEntity.ok(updatedTask);
    }
}
