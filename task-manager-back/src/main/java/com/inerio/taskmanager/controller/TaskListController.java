package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.ListMoveDto;
import com.inerio.taskmanager.dto.TaskListDto;
import com.inerio.taskmanager.model.TaskList;
import com.inerio.taskmanager.service.TaskListService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing Kanban lists (columns).
 * <p>
 * Provides endpoints for CRUD operations and drag &amp; drop reordering of lists.
 * </p>
 */
@RestController
@RequestMapping("/api/v1/lists")
@CrossOrigin(origins = "*") // TODO: Restrict in production for security!
public class TaskListController {

    private final TaskListService listService;

    /** Logger for this controller. */
    private static final Logger log = LoggerFactory.getLogger(TaskListController.class);

    /**
     * Constructor with dependency injection.
     * 
     * @param listService the service handling business logic for lists
     */
    public TaskListController(TaskListService listService) {
        this.listService = listService;
    }

    // =================== CRUD ENDPOINTS FOR LISTS ===================

    /**
     * Get all Kanban lists, ordered by position.
     * 
     * @return list of TaskListDto
     */
    @GetMapping
    public ResponseEntity<List<TaskListDto>> getAllLists() {
        List<TaskListDto> dtos = listService.getAllListDtos();
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get a single list by its ID.
     * 
     * @param id the list ID
     * @return the TaskListDto or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<TaskListDto> getListById(@PathVariable Long id) {
        return listService.getListById(id)
            .map(list -> ResponseEntity.ok(new TaskListDto(list.getId(), list.getName(), list.getPosition())))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new Kanban list (column).
     * 
     * @param list the list to create (only name required)
     * @return the created list as TaskListDto
     */
    @PostMapping
    public ResponseEntity<TaskListDto> createList(@RequestBody TaskList list) {
        // Optionally: validate that list.getName() is not blank/null here
        TaskList created = listService.createList(list);
        TaskListDto dto = new TaskListDto(created.getId(), created.getName(), created.getPosition());
        return ResponseEntity.ok(dto);
    }

    /**
     * Update an existing list (by ID).
     * 
     * @param id the list ID
     * @param list the new list data (typically just name)
     * @return the updated TaskListDto
     */
    @PutMapping("/{id}")
    public ResponseEntity<TaskListDto> updateList(@PathVariable Long id, @RequestBody TaskList list) {
        TaskList updated = listService.updateList(id, list);
        TaskListDto dto = new TaskListDto(updated.getId(), updated.getName(), updated.getPosition());
        return ResponseEntity.ok(dto);
    }

    /**
     * Delete a list by its ID.
     * 
     * @param id the list ID
     * @return HTTP 204 No Content if deleted
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteList(@PathVariable Long id) {
        listService.deleteList(id);
        return ResponseEntity.noContent().build();
    }

    // =================== DRAG & DROP REORDERING ===================

    /**
     * Move (reorder) a list to a new position.
     * 
     * @param moveDto contains listId and the targetPosition
     * @return HTTP 200 OK if moved
     */
    @PutMapping("/move")
    public ResponseEntity<?> moveList(@RequestBody ListMoveDto moveDto) {
        // Optionally: validate that position is valid in the service!
        try {
            listService.moveList(moveDto.getListId(), moveDto.getTargetPosition());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Move list failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
