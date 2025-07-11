package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapper;
import com.inerio.taskmanager.model.TaskList;
import com.inerio.taskmanager.service.TaskService;
import com.inerio.taskmanager.service.TaskListService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * REST controller for managing tasks and attachments.
 */
@RestController
@RequestMapping("/api/v1/tasks")
@CrossOrigin(origins = "*") // TODO: Restrict in production
public class TaskController {

    // ------------------------------------------
    // DEPENDENCY INJECTION & LOGGING
    // ------------------------------------------
    private final TaskService taskService;
    private final TaskListService taskListService;
    private static final Logger log = LoggerFactory.getLogger(TaskController.class);

    public TaskController(TaskService taskService, TaskListService taskListService) {
        this.taskService = taskService;
        this.taskListService = taskListService;
    }

    // ------------------------------------------
    // TASK CRUD ENDPOINTS
    // ------------------------------------------

    /** Return all tasks (as DTOs). */
    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks() {
        List<TaskDto> tasks = taskService.getAllTasks()
                .stream()
                .map(TaskMapper::toDto)
                .collect(Collectors.toList());
        if (tasks.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(tasks);
    }

    /** Return a task by ID, or 404 if not found. */
    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id)
                .map(TaskMapper::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Return all tasks for a specific list/column. */
    @GetMapping("/list/{listId}")
    public ResponseEntity<List<TaskDto>> getTasksByListId(@PathVariable Long listId) {
        List<TaskDto> tasks = taskService.getTasksByListId(listId)
                .stream()
                .map(TaskMapper::toDto)
                .collect(Collectors.toList());
        if (tasks.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(tasks);
    }

    /** Create a new task (requires valid listId). */
    @PostMapping
    public ResponseEntity<TaskDto> createTask(@RequestBody TaskDto dto) {
        Optional<TaskList> listOpt = taskListService.getListById(dto.getListId());
        if (listOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        TaskDto created = TaskMapper.toDto(
                taskService.createTaskFromDto(dto, listOpt.get())
        );
        URI location = URI.create("/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    /** Update an existing task (requires valid listId). */
    @PutMapping("/{id}")
    public ResponseEntity<TaskDto> updateTask(@PathVariable Long id, @RequestBody TaskDto dto) {
        Optional<TaskList> listOpt = taskListService.getListById(dto.getListId());
        if (listOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            TaskDto saved = TaskMapper.toDto(
                    taskService.updateTaskFromDto(id, dto, listOpt.get())
            );
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            log.warn("Task not found for update: {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    /** Delete a task by ID. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        if (taskService.getTaskById(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    /** Delete all tasks for a given list/column. */
    @DeleteMapping("/list/{listId}")
    public ResponseEntity<Void> deleteTasksByListId(@PathVariable Long listId) {
        taskService.deleteTasksByListId(listId);
        return ResponseEntity.noContent().build();
    }

    /** Delete all tasks in the database. */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks() {
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------
    // ATTACHMENT ENDPOINTS
    // ------------------------------------------

    /** Upload an attachment to a task. Returns updated TaskDto. */
    @PostMapping("/{id}/attachments")
    public ResponseEntity<?> uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        try {
            TaskDto updatedTask = TaskMapper.toDto(taskService.uploadAttachment(id, file));
            return ResponseEntity.ok(updatedTask);
        } catch (IllegalStateException e) {
            log.warn("Attachment upload failed for task {}: {}", id, e.getMessage());
            return ResponseEntity.status(409).body(e.getMessage());
        } catch (Exception e) {
            log.warn("Attachment upload failed for task {}: {}", id, e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /** Download an attachment for a task (stream/binary). */
    @GetMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> downloadAttachment(
            @PathVariable Long id,
            @PathVariable String filename) {
        return taskService.downloadAttachment(id, filename);
    }

    /** Delete an attachment from a task. Returns updated TaskDto. */
    @DeleteMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> deleteAttachment(
            @PathVariable Long id,
            @PathVariable String filename) {
        TaskDto updatedTask = TaskMapper.toDto(taskService.deleteAttachment(id, filename));
        return ResponseEntity.ok(updatedTask);
    }
}
