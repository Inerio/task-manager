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
 * <p>
 * Provides endpoints for CRUD operations and drag &amp; drop reordering of columns.
 * </p>
 */
@RestController
@RequestMapping("/api/v1/kanbanColumns")
@CrossOrigin(origins = "*") // TODO: Restrict in production for security!
public class KanbanColumnController {

    private final KanbanColumnService kanbanColumnService;

    /** Logger for this controller. */
    private static final Logger log = LoggerFactory.getLogger(KanbanColumnController.class);

    /**
     * Constructor with dependency injection.
     * 
     * @param kanbanColumnService the service handling business logic for columns
     */
    public KanbanColumnController(KanbanColumnService kanbanColumnService) {
        this.kanbanColumnService = kanbanColumnService;
    }

    // =================== CRUD ENDPOINTS FOR KANBANLISTS ===================

    /**
     * Get all Kanban lists, ordered by position.
     * 
     * @return list of KanbanColumnDto
     */
    @GetMapping
    public ResponseEntity<List<KanbanColumnDto>> getAllKanbanColumns() {
        List<KanbanColumnDto> dtos = kanbanColumnService.getAllKanbanColumnDtos();
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get a single column by its ID.
     * 
     * @param id the column ID
     * @return the KanbanColumnDto or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> getKanbanColumnById(@PathVariable Long id) {
        return kanbanColumnService.getKanbanColumnById(id)
            .map(kanbanColumn -> ResponseEntity.ok(new KanbanColumnDto(kanbanColumn.getId(), kanbanColumn.getName(), kanbanColumn.getPosition())))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new Kanban column.
     * 
     * @param kanbanColumn the column to create (only name required)
     * @return the created column as KanbanColumnDto
     */
    @PostMapping
    public ResponseEntity<KanbanColumnDto> createKanbanColumn(@RequestBody KanbanColumn kanbanColumn) {
        KanbanColumn created = kanbanColumnService.createKanbanColumn(kanbanColumn);
        KanbanColumnDto dto = new KanbanColumnDto(created.getId(), created.getName(), created.getPosition());
        return ResponseEntity.ok(dto);
    }

    /**
     * Update an existing column (by ID).
     * 
     * @param id the column ID
     * @param kanbanColumn the new column data (typically just name)
     * @return the updated KanbanColumnDto
     */
    @PutMapping("/{id}")
    public ResponseEntity<KanbanColumnDto> updateKanbanColumn(@PathVariable Long id, @RequestBody KanbanColumn kanbanColumn) {
        KanbanColumn updated = kanbanColumnService.updateKanbanColumn(id, kanbanColumn);
        KanbanColumnDto dto = new KanbanColumnDto(updated.getId(), updated.getName(), updated.getPosition());
        return ResponseEntity.ok(dto);
    }

    /**
     * Delete a column by its ID.
     * 
     * @param id the column ID
     * @return HTTP 204 No Content if deleted
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKanbanColumn(@PathVariable Long id) {
        kanbanColumnService.deleteKanbanColumn(id);
        return ResponseEntity.noContent().build();
    }

    // =================== DRAG & DROP REORDERING ===================

    /**
     * Move (reorder) a column to a new position.
     * 
     * @param moveDto contains kanbanColumnId and the targetPosition
     * @return HTTP 200 OK if moved
     */
    @PutMapping("/move")
    public ResponseEntity<?> moveKanbanColumn(@RequestBody KanbanColumnMoveDto moveDto) {
        try {
            kanbanColumnService.moveKanbanColumn(moveDto.getKanbanColumnId(), moveDto.getTargetPosition());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Move column failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
