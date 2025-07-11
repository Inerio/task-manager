package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.TaskListDto;
import com.inerio.taskmanager.model.TaskList;
import com.inerio.taskmanager.repository.TaskListRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service layer for TaskList business logic and repository access.
 */
@Service
public class TaskListService {

    // ------------------------------------------
    // DEPENDENCY INJECTION
    // ------------------------------------------
    private final TaskListRepository listRepository;

    public TaskListService(TaskListRepository listRepository) {
        this.listRepository = listRepository;
    }

    // ------------------------------------------
    // BASIC CRUD METHODS
    // ------------------------------------------

    /**
     * Retrieve all TaskList entities.
     */
    public List<TaskList> getAllLists() {
        return listRepository.findAll();
    }

    /**
     * Retrieve a TaskList by its ID.
     */
    public Optional<TaskList> getListById(Long id) {
        return listRepository.findById(id);
    }

    /**
     * Create and persist a new TaskList.
     */
    public TaskList createList(TaskList list) {
        return listRepository.save(list);
    }

    /**
     * Update an existing TaskList by ID.
     * Throws RuntimeException if the list does not exist.
     */
    public TaskList updateList(Long id, TaskList updated) {
        TaskList existing = listRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("TaskList not found with id " + id));
        existing.setName(updated.getName());
        return listRepository.save(existing);
    }

    /**
     * Delete a TaskList by its ID.
     */
    public void deleteList(Long id) {
        listRepository.deleteById(id);
    }

    // ------------------------------------------
    // DTO HELPERS
    // ------------------------------------------

    /**
     * Retrieve all TaskList entities as DTOs (id + name only).
     */
    public List<TaskListDto> getAllListDtos() {
        return listRepository.findAll().stream()
            .map(list -> new TaskListDto(list.getId(), list.getName()))
            .toList();
    }
}
