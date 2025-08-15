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

    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderTasks(@RequestHeader("X-Client-Id") String uid,
                                             @RequestBody List<TaskReorderDto> reorderedTasks) {
        userAccountService.touch(uid);
        taskService.reorderTasks(reorderedTasks);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/move")
    public ResponseEntity<?> moveTask(@RequestHeader("X-Client-Id") String uid,
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

    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks(@RequestHeader("X-Client-Id") String uid) {
        userAccountService.touch(uid);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/kanbanColumn/{kanbanColumnId}")
    public ResponseEntity<List<TaskDto>> getTasksByListId(@RequestHeader("X-Client-Id") String uid,
                                                          @PathVariable Long kanbanColumnId) {
        userAccountService.touch(uid);
        if (!taskService.ownsColumn(uid, kanbanColumnId)) return ResponseEntity.notFound().build();
        List<TaskDto> tasks = taskService.getTasksByKanbanColumnId(kanbanColumnId)
                .stream().map(TaskMapperDto::toDto).collect(Collectors.toList());
        if (tasks.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(tasks);
    }

    @PostMapping
    public ResponseEntity<TaskDto> createTask(@RequestHeader("X-Client-Id") String uid,
                                              @RequestBody TaskDto dto) {
        userAccountService.touch(uid);
        if (!taskService.ownsColumn(uid, dto.getKanbanColumnId())) return ResponseEntity.notFound().build();
        Optional<KanbanColumn> kanbanColumnOpt = kanbanColumnService.getKanbanColumnById(dto.getKanbanColumnId());
        if (kanbanColumnOpt.isEmpty()) return ResponseEntity.badRequest().build();
        TaskDto created = TaskMapperDto.toDto(taskService.createTaskFromDto(dto, kanbanColumnOpt.get()));
        URI location = URI.create("/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskDto> updateTask(@RequestHeader("X-Client-Id") String uid,
                                              @PathVariable Long id,
                                              @RequestBody TaskDto dto) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id) || !taskService.ownsColumn(uid, dto.getKanbanColumnId()))
            return ResponseEntity.notFound().build();
        Optional<KanbanColumn> kanbanColumnOpt = kanbanColumnService.getKanbanColumnById(dto.getKanbanColumnId());
        if (kanbanColumnOpt.isEmpty()) return ResponseEntity.badRequest().build();
        try {
            TaskDto saved = TaskMapperDto.toDto(taskService.updateTaskFromDto(id, dto, kanbanColumnOpt.get()));
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            log.warn("Task not found for update: {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getTaskById(@RequestHeader("X-Client-Id") String uid, @PathVariable Long id) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) return ResponseEntity.notFound().build();
        return taskService.getTaskById(id).map(TaskMapperDto::toDto).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@RequestHeader("X-Client-Id") String uid, @PathVariable Long id) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) return ResponseEntity.notFound().build();
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/kanbanColumn/{kanbanColumnId}")
    public ResponseEntity<Void> deleteTasksByKanbanColumnId(@RequestHeader("X-Client-Id") String uid,
                                                            @PathVariable Long kanbanColumnId) {
        userAccountService.touch(uid);
        if (!taskService.ownsColumn(uid, kanbanColumnId)) return ResponseEntity.notFound().build();
        taskService.deleteTasksByKanbanColumnId(kanbanColumnId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/board/{boardId}")
    public ResponseEntity<Void> deleteTasksByBoardId(@RequestHeader("X-Client-Id") String uid,
                                                     @PathVariable Long boardId) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) return ResponseEntity.notFound().build();
        taskService.deleteTasksByBoardId(boardId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks(@RequestHeader("X-Client-Id") String uid) {
        userAccountService.touch(uid);
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<?> uploadAttachment(@RequestHeader("X-Client-Id") String uid,
                                              @PathVariable Long id,
                                              @RequestParam("file") MultipartFile file) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) return ResponseEntity.notFound().build();
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

    @GetMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> downloadAttachment(@RequestHeader("X-Client-Id") String uid,
                                                @PathVariable Long id,
                                                @PathVariable String filename) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) return ResponseEntity.notFound().build();
        return taskService.downloadAttachment(id, filename);
    }

    @DeleteMapping("/{id}/attachments/{filename:.+}")
    public ResponseEntity<?> deleteAttachment(@RequestHeader("X-Client-Id") String uid,
                                              @PathVariable Long id,
                                              @PathVariable String filename) {
        userAccountService.touch(uid);
        if (!taskService.ownsTask(uid, id)) return ResponseEntity.notFound().build();
        TaskDto updatedTask = TaskMapperDto.toDto(taskService.deleteAttachment(id, filename));
        return ResponseEntity.ok(updatedTask);
    }
}
