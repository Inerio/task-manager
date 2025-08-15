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
import org.springframework.web.bind.annotation.CrossOrigin;
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
@CrossOrigin(origins = "*")
public class KanbanColumnController {

    private static final Logger log = LoggerFactory.getLogger(KanbanColumnController.class);

    private final KanbanColumnService kanbanColumnService;
    private final BoardService boardService;
    private final UserAccountService userAccountService;

    public KanbanColumnController(
            KanbanColumnService kanbanColumnService,
            BoardService boardService,
            UserAccountService userAccountService) {
        this.kanbanColumnService = kanbanColumnService;
        this.boardService = boardService;
        this.userAccountService = userAccountService;
    }

    /**
     * GET {@code /api/v1/boards/{boardId}/kanbanColumns}
     * <p>Returns all columns for the specified board, ordered by position.</p>
     *
     * @param uid     client identifier from {@code X-Client-Id}
     * @param boardId board id
     * @return 200 with list of columns, or 404 if the board is not owned by the caller
     */
    @GetMapping
    public ResponseEntity<List<KanbanColumnDto>> getAllKanbanColumns(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        List<KanbanColumnDto> dtos = kanbanColumnService.getAllKanbanColumnDtos(boardId);
        return ResponseEntity.ok(dtos);
    }

    /**
     * GET {@code /api/v1/boards/{boardId}/kanbanColumns/{id}}
     * <p>Returns a single column by id if it belongs to the specified board and caller.</p>
     *
     * @param uid     client identifier from {@code X-Client-Id}
     * @param boardId board id
     * @param id      column id
     * @return 200 with the column, or 404 if not found/owned
     */
    @GetMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> getKanbanColumnById(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId,
            @PathVariable Long id) {
        userAccountService.touch(uid);
        return kanbanColumnService.getKanbanColumnById(id)
                .filter(c -> c.getBoard() != null
                          && c.getBoard().getId().equals(boardId)
                          && c.getBoard().getOwner() != null
                          && uid.equals(c.getBoard().getOwner().getUid()))
                .map(kanbanColumn -> ResponseEntity.ok(
                        new KanbanColumnDto(
                                kanbanColumn.getId(),
                                kanbanColumn.getName(),
                                kanbanColumn.getPosition(),
                                boardId
                        )))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST {@code /api/v1/boards/{boardId}/kanbanColumns}
     * <p>Creates a new column at the end of the specified board.</p>
     *
     * @param uid          client identifier from {@code X-Client-Id}
     * @param boardId      board id
     * @param kanbanColumn payload containing the column name
     * @return 200 with created column, or 404 if the board is not owned by the caller
     */
    @PostMapping
    public ResponseEntity<KanbanColumnDto> createKanbanColumn(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId,
            @RequestBody KanbanColumn kanbanColumn) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        KanbanColumn created = kanbanColumnService.createKanbanColumn(kanbanColumn, boardId);
        KanbanColumnDto dto = new KanbanColumnDto(
                created.getId(),
                created.getName(),
                created.getPosition(),
                boardId
        );
        return ResponseEntity.ok(dto);
    }

    /**
     * PUT {@code /api/v1/boards/{boardId}/kanbanColumns/{id}}
     * <p>Updates a column's attributes (e.g., name) if it belongs to the caller.</p>
     *
     * @param uid          client identifier from {@code X-Client-Id}
     * @param boardId      board id
     * @param id           column id
     * @param kanbanColumn payload with updated fields
     * @return 200 with updated column, or 404 if not found/owned
     */
    @PutMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> updateKanbanColumn(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId,
            @PathVariable Long id,
            @RequestBody KanbanColumn kanbanColumn) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        KanbanColumn updated = kanbanColumnService.updateKanbanColumn(id, kanbanColumn);
        KanbanColumnDto dto = new KanbanColumnDto(
                updated.getId(),
                updated.getName(),
                updated.getPosition(),
                boardId
        );
        return ResponseEntity.ok(dto);
    }

    /**
     * DELETE {@code /api/v1/boards/{boardId}/kanbanColumns/{id}}
     * <p>Deletes a column and its tasks if it belongs to the caller.</p>
     *
     * @param uid     client identifier from {@code X-Client-Id}
     * @param boardId board id
     * @param id      column id
     * @return 204 when deleted, or 404 if not found/owned
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKanbanColumn(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId,
            @PathVariable Long id) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        kanbanColumnService.deleteKanbanColumn(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * PUT {@code /api/v1/boards/{boardId}/kanbanColumns/move}
     * <p>Moves a column to a new position within its board.</p>
     *
     * @param uid     client identifier from {@code X-Client-Id}
     * @param boardId board id
     * @param moveDto payload containing the column id and target position
     * @return 200 on success, 400 if the move cannot be performed, or 404 if the board is not owned
     */
    @PutMapping("/move")
    public ResponseEntity<?> moveKanbanColumn(
            @RequestHeader("X-Client-Id") String uid,
            @PathVariable Long boardId,
            @RequestBody KanbanColumnMoveDto moveDto) {
        userAccountService.touch(uid);
        if (!boardService.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        try {
            kanbanColumnService.moveKanbanColumn(moveDto.getKanbanColumnId(), moveDto.getTargetPosition());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Move column failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
