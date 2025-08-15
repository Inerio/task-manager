package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.KanbanColumnDto;
import com.inerio.taskmanager.dto.KanbanColumnMoveDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.service.BoardService;
import com.inerio.taskmanager.service.KanbanColumnService;
import com.inerio.taskmanager.service.UserAccountService;
import java.util.List;
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
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller exposing CRUD and reordering endpoints for Kanban columns.
 * All operations are scoped to the caller via the {@code X-Client-Id} header.
 */
@RestController
@RequestMapping("/api/v1/boards/{boardId}/kanbanColumns")
public class KanbanColumnController {

    private static final Logger log = LoggerFactory.getLogger(KanbanColumnController.class);

    private final KanbanColumnService kanbanColumnService;
    private final BoardService boardService;
    private final UserAccountService userAccountService;

    public KanbanColumnController(KanbanColumnService kanbanColumnService,
                                  BoardService boardService,
                                  UserAccountService userAccountService) {
        this.kanbanColumnService = kanbanColumnService;
        this.boardService = boardService;
        this.userAccountService = userAccountService;
    }

    @GetMapping
    public ResponseEntity<List<KanbanColumnDto>> getAllKanbanColumns(@RequestHeader("X-Client-Id") String uid,
                                                                     @PathVariable Long boardId) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) return ResponseEntity.notFound().build();
        List<KanbanColumnDto> dtos = kanbanColumnService.getAllKanbanColumnDtos(boardId);
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> getKanbanColumnById(@RequestHeader("X-Client-Id") String uid,
                                                               @PathVariable Long boardId,
                                                               @PathVariable Long id) {
        userAccountService.touch(uid);
        return kanbanColumnService.getKanbanColumnById(id)
                .filter(c -> c.getBoard() != null
                          && c.getBoard().getId().equals(boardId)
                          && c.getBoard().getOwner() != null
                          && uid.equals(c.getBoard().getOwner().getUid()))
                .map(kanbanColumn -> ResponseEntity.ok(
                        new KanbanColumnDto(kanbanColumn.getId(), kanbanColumn.getName(), kanbanColumn.getPosition(), boardId)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<KanbanColumnDto> createKanbanColumn(@RequestHeader("X-Client-Id") String uid,
                                                              @PathVariable Long boardId,
                                                              @RequestBody KanbanColumn kanbanColumn) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) return ResponseEntity.notFound().build();
        KanbanColumn created = kanbanColumnService.createKanbanColumn(kanbanColumn, boardId);
        return ResponseEntity.ok(new KanbanColumnDto(created.getId(), created.getName(), created.getPosition(), boardId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> updateKanbanColumn(@RequestHeader("X-Client-Id") String uid,
                                                              @PathVariable Long boardId,
                                                              @PathVariable Long id,
                                                              @RequestBody KanbanColumn kanbanColumn) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) return ResponseEntity.notFound().build();
        KanbanColumn updated = kanbanColumnService.updateKanbanColumn(id, kanbanColumn);
        return ResponseEntity.ok(new KanbanColumnDto(updated.getId(), updated.getName(), updated.getPosition(), boardId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKanbanColumn(@RequestHeader("X-Client-Id") String uid,
                                                   @PathVariable Long boardId,
                                                   @PathVariable Long id) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) return ResponseEntity.notFound().build();
        kanbanColumnService.deleteKanbanColumn(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/move")
    public ResponseEntity<?> moveKanbanColumn(@RequestHeader("X-Client-Id") String uid,
                                              @PathVariable Long boardId,
                                              @RequestBody KanbanColumnMoveDto moveDto) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) return ResponseEntity.notFound().build();
        try {
            kanbanColumnService.moveKanbanColumn(moveDto.getKanbanColumnId(), moveDto.getTargetPosition());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Move column failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
