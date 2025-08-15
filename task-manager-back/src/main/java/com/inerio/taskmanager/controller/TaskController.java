package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapperDto;
import com.inerio.taskmanager.dto.TaskMoveDto;
import com.inerio.taskmanager.dto.TaskReorderDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.service.BoardService;
import com.inerio.taskmanager.service.KanbanColumnService;
import com.inerio.taskmanager.service.TaskService;
import com.inerio.taskmanager.service.UserAccountService;
import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST controller exposing CRUD, reordering, and attachment endpoints for tasks.
 * All operations are scoped to the caller via the {@code X-Client-Id} header.
 */
@RestController
@RequestMapping("/api/v1/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    private static final Logger log = LoggerFactory.getLogger(TaskController.class);

    private final TaskService taskService;
    private final KanbanColumnService kanbanColumnService;
    private final UserAccountService userAccountService;
    private final BoardService boardService;

    public TaskController(TaskService taskService,
                          KanbanColumnService kanbanColumnService,
                          UserAccountService userAccountService,
                          BoardService boardService) {
        this.taskService = taskService;
        this.kanbanColumnService = kanbanColumnService;
        this.userAccountService = userAccountService;
        this.boardService = boardService;
    }

    // ==================== DRAG & DROP: MOVE & REORDER TASK ====================

    /**
     * PUT {@code /api/v1/tasks/reorder}
     * <p>Reorders tasks within a column according to the provided list.</p>
     *
     * @param uid             client identifier from {@code X-Client-Id}
     * @param reorderedTasks  list of task ids with their target positions
     * @return 200 on success
     */
    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderTasks(
            @RequestHeader("X-Client-Id") String uid,
            @RequestBody List<TaskReorderDto> reorderedTasks) {
        userAccountService.touch(uid);
        taskService.reorderTasks(reorderedTasks);
        return ResponseEntity.ok().build();
    }

    /**
     * POST {@code /api/v1/tasks/move}
     * <p>Moves a task to a target column/position. Both must belong to the caller.</p>
     *
     * @param uid         client identifier from {@code X-Client-Id}
     * @param moveRequest payload containing task id, target column id and position
     * @return 200 on success, 404 if task/column not owned, 400 on business error
     */
    @PostMapping("/move")
    public ResponseEntity<?> moveTask(
            @RequestHeader("X-Client-Id") String uid,
            @RequestBody TaskMoveDto moveRequest) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, moveRequest.getTaskId())
            || !taskService.ownsColumn(uid, moveRequest.getTargetKanbanColumnId())) {
            return ResponseEntity.notFound().build();
        }
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

    // ======================= TASK CRUD ENDPOINTS =======================

    /**
     * GET {@code /api/v1/tasks}
     * <p>Disabled to avoid cross-user leakage. Returns 204.</p>
     *
     * @param uid client identifier from {@code X-Client-Id}
     * @return 204 No Content
     */
    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks(
            @RequestHeader("X-Client-Id") String uid) {
        userAccountService.touch(uid);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET {@code /api/v1/tasks/kanbanColumn/{kanbanColumnId}}
     * <p>Returns tasks for a column owned by the caller, ordered by position.</p>
     *
     * @param uid             client identifier from {@code X-Client-Id}
     * @param kanbanColumnId  column id
     * @return 200 with tasks, 204 if none, or 404 if column not owned
     */
    @GetMapping("/kanbanColumn/{kanbanColumnId}")
    public ResponseEntity<List<TaskDto>> getTasksByListId(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long kanbanColumnId) {
        userAccountService.touch(uid);
        if (!taskService.ownsColumn(uid, kanbanColumnId)) {
            return ResponseEntity.notFound().build();
        }
        List<TaskDto> tasks = taskService.getTasksByKanbanColumnId(kanbanColumnId)
                .stream()
                .map(TaskMapperDto::toDto)
                .collect(Collectors.toList());
        if (tasks.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(tasks);
    }

    /**
     * POST {@code /api/v1/tasks}
     * <p>Creates a task in a column owned by the caller.</p>
     *
     * @param uid client identifier from {@code X-Client-Id}
     * @param dto task payload
     * @return 201 with created task, 404 if column not owned, 400 if column does not exist
     */
    @PostMapping
    public ResponseEntity<TaskDto> createTask(
            @RequestHeader("X-Client-Id") String uid,
            @RequestBody TaskDto dto) {
        userAccountService.touch(uid);
        if (!taskService.ownsColumn(uid, dto.getKanbanColumnId())) {
            return ResponseEntity.notFound().build();
        }
        Optional<KanbanColumn> kanbanColumnOpt = kanbanColumnService.getKanbanColumnById(dto.getKanbanColumnId());
        if (kanbanColumnOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        TaskDto created = TaskMapperDto.toDto(taskService.createTaskFromDto(dto, kanbanColumnOpt.get()));
        URI location = URI.create("/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    /**
     * PUT {@code /api/v1/tasks/{id}}
     * <p>Updates a task if both the task and target column belong to the caller.</p>
     *
     * @param uid client identifier from {@code X-Client-Id}
     * @param id  task id
     * @param dto task payload
     * @return 200 with updated task, 404 if not owned, 400 if column missing
     */
    @PutMapping("/{id}")
    public ResponseEntity<TaskDto> updateTask(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long id,
            @RequestBody TaskDto dto) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id) || !taskService.ownsColumn(uid, dto.getKanbanColumnId())) {
            return ResponseEntity.notFound().build();
        }
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
     * GET {@code /api/v1/tasks/{id}}
     * <p>Returns a task by id if owned by the caller.</p>
     *
     * @param uid client identifier from {@code X-Client-Id}
     * @param id  task id
     * @return 200 with task, or 404 if not owned/not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getTaskById(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long id) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) {
            return ResponseEntity.notFound().build();
        }
        return taskService.getTaskById(id)
                .map(TaskMapperDto::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE {@code /api/v1/tasks/{id}}
     * <p>Deletes a task if owned by the caller.</p>
     *
     * @param uid client identifier from {@code X-Client-Id}
     * @param id  task id
     * @return 204 when deleted, or 404 if not owned/not found
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long id) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) {
            return ResponseEntity.notFound().build();
        }
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * DELETE {@code /api/v1/tasks/kanbanColumn/{kanbanColumnId}}
     * <p>Deletes all tasks for the specified column if owned by the caller.</p>
     *
     * @param uid            client identifier from {@code X-Client-Id}
     * @param kanbanColumnId column id
     * @return 204 when deleted, or 404 if column not owned
     */
    @DeleteMapping("/kanbanColumn/{kanbanColumnId}")
    public ResponseEntity<Void> deleteTasksByKanbanColumnId(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long kanbanColumnId) {
        userAccountService.touch(uid);
        if (!taskService.ownsColumn(uid, kanbanColumnId)) {
            return ResponseEntity.notFound().build();
        }
        taskService.deleteTasksByKanbanColumnId(kanbanColumnId);
        return ResponseEntity.noContent().build();
    }

    /**
     * DELETE {@code /api/v1/tasks/board/{boardId}}
     * <p>Deletes all tasks in all columns of a board if owned by the caller.</p>
     *
     * @param uid     client identifier from {@code X-Client-Id}
     * @param boardId board id
     * @return 204 when deleted, or 404 if board not owned
     */
    @DeleteMapping("/board/{boardId}")
    public ResponseEntity<Void> deleteTasksByBoardId(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        taskService.deleteTasksByBoardId(boardId);
        return ResponseEntity.noContent().build();
    }

    /**
     * DELETE {@code /api/v1/tasks/all}
     * <p>Deletes all tasks. Intended for admin/debug scenarios.</p>
     *
     * @param uid client identifier from {@code X-Client-Id}
     * @return 204 when deleted
     */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks(
            @RequestHeader("X-Client-Id") String uid) {
        userAccountService.touch(uid);
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build();
    }

    // ======================= ATTACHMENT ENDPOINTS =======================

    /**
     * POST {@code /api/v1/tasks/{id}/attachments}
     * <p>Uploads an attachment to a task if owned by the caller.</p>
     *
     * @param uid   client identifier from {@code X-Client-Id}
     * @param id    task id
     * @param file  attachment file
     * @return 200 with updated task, 404 if not owned, 409 if duplicate name, 400 on error
     */
    @PostMapping("/{id}/attachments")
    public ResponseEntity<?> uploadAttachment(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) {
            return ResponseEntity.notFound().build();
        }
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
     * GET {@code /api/v1/tasks/{id}/attachments/{filename}}
     * <p>Downloads an attachment if the task is owned by the caller.</p>
     *
     * @param uid      client identifier from {@code X-Client-Id}
     * @param id       task id
     * @param filename attachment file name
     * @return 200 with file content, 404 if not owned/not found, 400 on error
     */
    @GetMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> downloadAttachment(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long id,
            @PathVariable String filename) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) {
            return ResponseEntity.notFound().build();
        }
        return taskService.downloadAttachment(id, filename);
    }

    /**
     * DELETE {@code /api/v1/tasks/{id}/attachments/{filename}}
     * <p>Deletes an attachment from a task if owned by the caller.</p>
     *
     * @param uid      client identifier from {@code X-Client-Id}
     * @param id       task id
     * @param filename attachment file name
     * @return 200 with updated task, or 404 if not owned
     */
    @DeleteMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> deleteAttachment(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long id,
            @PathVariable String filename) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) {
            return ResponseEntity.notFound().build();
        }
        TaskDto updatedTask = TaskMapperDto.toDto(taskService.deleteAttachment(id, filename));
        return ResponseEntity.ok(updatedTask);
    }
}
