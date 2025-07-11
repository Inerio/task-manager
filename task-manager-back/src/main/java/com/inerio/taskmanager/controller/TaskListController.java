package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.TaskListDto;
import com.inerio.taskmanager.model.TaskList;
import com.inerio.taskmanager.service.TaskListService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing Kanban lists (columns).
 */
@RestController
@RequestMapping("/api/v1/lists")
@CrossOrigin(origins = "*") // TODO: Restrict in production
public class TaskListController {

    // ------------------------------------------
    // DEPENDENCY INJECTION
    // ------------------------------------------
    private final TaskListService listService;

    public TaskListController(TaskListService listService) {
        this.listService = listService;
    }

    // ------------------------------------------
    // GET ALL LISTS
    // ------------------------------------------
    /**
     * Returns all lists as DTOs.
     */
    @GetMapping
    public ResponseEntity<List<TaskListDto>> getAllLists() {
        return ResponseEntity.ok(listService.getAllListDtos());
    }

    // ------------------------------------------
    // GET LIST BY ID
    // ------------------------------------------
    /**
     * Returns a list by its ID, or 404 if not found.
     */
    @GetMapping("/{id}")
    public ResponseEntity<TaskListDto> getListById(@PathVariable Long id) {
        return listService.getListById(id)
                .map(list -> ResponseEntity.ok(new TaskListDto(list.getId(), list.getName())))
                .orElse(ResponseEntity.notFound().build());
    }

    // ------------------------------------------
    // CREATE LIST
    // ------------------------------------------
    /**
     * Creates a new list, returns the created DTO.
     */
    @PostMapping
    public ResponseEntity<TaskListDto> createList(@RequestBody TaskList list) {
        TaskList created = listService.createList(list);
        TaskListDto dto = new TaskListDto(created.getId(), created.getName());
        return ResponseEntity.ok(dto);
    }

    // ------------------------------------------
    // UPDATE LIST
    // ------------------------------------------
    /**
     * Updates a list, returns the updated DTO.
     */
    @PutMapping("/{id}")
    public ResponseEntity<TaskListDto> updateList(@PathVariable Long id, @RequestBody TaskList list) {
        TaskList updated = listService.updateList(id, list);
        TaskListDto dto = new TaskListDto(updated.getId(), updated.getName());
        return ResponseEntity.ok(dto);
    }

    // ------------------------------------------
    // DELETE LIST
    // ------------------------------------------
    /**
     * Deletes a list by ID, returns 204.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteList(@PathVariable Long id) {
        listService.deleteList(id);
        return ResponseEntity.noContent().build();
    }
}
