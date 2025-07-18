package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.TaskMoveDto;
import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapperDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.service.TaskService;
import com.inerio.taskmanager.service.KanbanColumnService;

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
 * REST controller for managing tasks and their attachments in the Kanban application.
 * <p>
 * Handles CRUD operations for tasks, attachment upload/download/delete, and drag &amp; drop reordering.
 * </p>
 */
@RestController
@RequestMapping("/api/v1/tasks")
@CrossOrigin(origins = "*") // TODO: Restrict origins in production for security.
public class TaskController {

    private final TaskService taskService;
    private final KanbanColumnService kanbanColumnService;

    /** SLF4J logger for logging request/response and warnings. */
    private static final Logger log = LoggerFactory.getLogger(TaskController.class);

    /**
     * Constructor with dependency injection for required services.
     *
     * @param taskService      Service for business logic related to tasks.
     * @param kanbanColumnService  Service for business logic related to columns.
     */
    public TaskController(TaskService taskService, KanbanColumnService kanbanColumnService) {
        this.taskService = taskService;
        this.kanbanColumnService = kanbanColumnService;
    }

    // ======================= TASK CRUD ENDPOINTS =======================

    /**
     * Get all tasks as DTOs.
     *
     * @return List of all tasks or HTTP 204 if none exist.
     */
    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks() {
        List<TaskDto> tasks = taskService.getAllTasks()
                .stream()
                .map(TaskMapperDto::toDto)
                .collect(Collectors.toList());
        if (tasks.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(tasks);
    }

    /**
     * Get a single task by its ID.
     *
     * @param id Task ID
     * @return TaskDto if found, HTTP 404 otherwise.
     */
    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id)
                .map(TaskMapperDto::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get all tasks in a specific column, ordered by position.
     *
     * @param kanbanColumnId List (column) ID
     * @return List of TaskDto or HTTP 204 if empty.
     */
    @GetMapping("/kanbanColumn/{kanbanColumnId}")
    public ResponseEntity<List<TaskDto>> getTasksByListId(@PathVariable Long kanbanColumnId) {
        List<TaskDto> tasks = taskService.getTasksByKanbanColumnId(kanbanColumnId)
                .stream()
                .map(TaskMapperDto::toDto)
                .collect(Collectors.toList());
        if (tasks.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(tasks);
    }

    /**
     * Create a new task. Requires a valid column ID.
     *
     * @param dto TaskDto to create
     * @return Created TaskDto with HTTP 201, or 400 if invalid column.
     */
    @PostMapping
    public ResponseEntity<TaskDto> createTask(@RequestBody TaskDto dto) {
        Optional<KanbanColumn> kanbanColumnOpt = kanbanColumnService.getKanbanColumnById(dto.getKanbanColumnId());
        if (kanbanColumnOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        TaskDto created = TaskMapperDto.toDto(taskService.createTaskFromDto(dto, kanbanColumnOpt.get()));
        URI location = URI.create("/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Update an existing task. Requires valid column ID.
     *
     * @param id  Task ID
     * @param dto Updated TaskDto
     * @return Updated TaskDto or 404 if not found, 400 if invalid column.
     */
    @PutMapping("/{id}")
    public ResponseEntity<TaskDto> updateTask(@PathVariable Long id, @RequestBody TaskDto dto) {
        Optional<KanbanColumn> kanbanColumnOpt = kanbanColumnService.getKanbanColumnById(dto.getKanbanColumnId());
        if (kanbanColumnOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            TaskDto saved = TaskMapperDto.toDto(
                    taskService.updateTaskFromDto(id, dto, kanbanColumnOpt.get())
            );
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            log.warn("Task not found for update: {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete a task by ID.
     *
     * @param id Task ID
     * @return HTTP 204 on success, 404 if not found.
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
     * Delete all tasks for a given column.
     *
     * @param kanbanColumnId KanbanColumn ID
     * @return HTTP 204
     */
    @DeleteMapping("/kanbanColumn/{kanbanColumnId}")
    public ResponseEntity<Void> deleteTasksByKanbanColumnId(@PathVariable Long kanbanColumnId) {
        taskService.deleteTasksByKanbanColumnId(kanbanColumnId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete all tasks in the database.
     *
     * @return HTTP 204
     */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks() {
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build();
    }

    // ==================== DRAG & DROP: MOVE & REORDER TASK ====================

    /**
     * Move a task to a target column and position (with reorder).  
     * Body: { "taskId": ..., "targetKanbanColumnId": ..., "targetPosition": ... }
     *
     * @param moveRequest TaskMoveDto containing move parameters
     * @return HTTP 200 on success, 400 on error
     */
    @PostMapping("/move")
    public ResponseEntity<?> moveTask(@RequestBody TaskMoveDto moveRequest) {
        try {
            taskService.moveTask(
                moveRequest.getTaskId(),
                moveRequest.getTargetKanbanColumnId(),
                moveRequest.getTargetPosition()
            );
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.warn("Task move failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ======================= ATTACHMENT ENDPOINTS =======================

    /**
     * Upload an attachment to a task. Returns updated TaskDto.
     *
     * @param id   Task ID
     * @param file MultipartFile uploaded
     * @return Updated TaskDto or error status
     */
    @PostMapping("/{id}/attachments")
    public ResponseEntity<?> uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        try {
            TaskDto updatedTask = TaskMapperDto.toDto(taskService.uploadAttachment(id, file));
            return ResponseEntity.ok(updatedTask);
        } catch (IllegalStateException e) {
            log.warn("Attachment upload failed for task {}: {}", id, e.getMessage());
            return ResponseEntity.status(409).body(e.getMessage());
        } catch (Exception e) {
            log.warn("Attachment upload failed for task {}: {}", id, e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Download an attachment for a task (as a stream/binary).
     *
     * @param id       Task ID
     * @param filename Attachment filename
     * @return File stream or error response
     */
    @GetMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> downloadAttachment(
            @PathVariable Long id,
            @PathVariable String filename) {
        return taskService.downloadAttachment(id, filename);
    }

    /**
     * Delete an attachment from a task. Returns updated TaskDto.
     *
     * @param id       Task ID
     * @param filename Attachment filename
     * @return Updated TaskDto
     */
    @DeleteMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> deleteAttachment(
            @PathVariable Long id,
            @PathVariable String filename) {
        TaskDto updatedTask = TaskMapperDto.toDto(taskService.deleteAttachment(id, filename));
        return ResponseEntity.ok(updatedTask);
    }
}
