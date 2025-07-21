package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.KanbanColumnMoveDto;
import com.inerio.taskmanager.dto.KanbanColumnDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.service.KanbanColumnService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing Kanban columns.
 * Provides endpoints for CRUD operations and drag and drop reordering.
 */
@RestController
@RequestMapping("/api/v1/boards/{boardId}/kanbanColumns")
@CrossOrigin(origins = "*") // TODO: Restrict in production for security!
public class KanbanColumnController {

    private final KanbanColumnService kanbanColumnService;
    private static final Logger log = LoggerFactory.getLogger(KanbanColumnController.class);

    /**
     * Creates a KanbanColumnController with the provided service.
     * @param kanbanColumnService Service for KanbanColumn operations.
     */
    public KanbanColumnController(KanbanColumnService kanbanColumnService) {
        this.kanbanColumnService = kanbanColumnService;
    }

    /**
     * Get all Kanban columns for a board, ordered by position.
     * @param boardId Board ID
     * @return list of KanbanColumnDto
     */
    @GetMapping
    public ResponseEntity<List<KanbanColumnDto>> getAllKanbanColumns(@PathVariable Long boardId) {
        List<KanbanColumnDto> dtos = kanbanColumnService.getAllKanbanColumnDtos(boardId);
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get a single column by its ID.
     * @param boardId Board ID
     * @param id Column ID
     * @return the KanbanColumnDto or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> getKanbanColumnById(@PathVariable Long boardId, @PathVariable Long id) {
        return kanbanColumnService.getKanbanColumnById(id)
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
     * Create a new Kanban column in the given board.
     * @param boardId Board ID
     * @param kanbanColumn the column to create (only name required)
     * @return the created column as KanbanColumnDto
     */
    @PostMapping
    public ResponseEntity<KanbanColumnDto> createKanbanColumn(@PathVariable Long boardId, @RequestBody KanbanColumn kanbanColumn) {
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
     * Update an existing column (by ID).
     * @param boardId Board ID
     * @param id the column ID
     * @param kanbanColumn the new column data (typically just name)
     * @return the updated KanbanColumnDto
     */
    @PutMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> updateKanbanColumn(
            @PathVariable Long boardId,
            @PathVariable Long id,
            @RequestBody KanbanColumn kanbanColumn) {
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
     * Delete a column by its ID.
     * @param boardId Board ID
     * @param id Column ID
     * @return HTTP 204 No Content if deleted
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKanbanColumn(@PathVariable Long boardId, @PathVariable Long id) {
        kanbanColumnService.deleteKanbanColumn(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Move (reorder) a column to a new position within its board.
     * @param boardId Board ID
     * @param moveDto contains kanbanColumnId and the targetPosition
     * @return HTTP 200 OK if moved, 400 if error
     */
    @PutMapping("/move")
    public ResponseEntity<?> moveKanbanColumn(
            @PathVariable Long boardId,
            @RequestBody KanbanColumnMoveDto moveDto) {
        try {
            kanbanColumnService.moveKanbanColumn(moveDto.getKanbanColumnId(), moveDto.getTargetPosition());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Move column failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
