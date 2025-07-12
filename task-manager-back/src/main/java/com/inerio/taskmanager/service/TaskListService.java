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
    // BASIC CRUD METHODS (with position logic)
    // ------------------------------------------

    /**
     * Retrieve all TaskList entities, ordered by position.
     */
    public List<TaskList> getAllLists() {
        return listRepository.findAllByOrderByPositionAsc();
    }

    /**
     * Retrieve a TaskList by its ID.
     */
    public Optional<TaskList> getListById(Long id) {
        return listRepository.findById(id);
    }

    /**
     * Create and persist a new TaskList at the last position (max 6).
     */
    public TaskList createList(TaskList list) {
        long count = listRepository.count();
        if (count >= 6) throw new IllegalStateException("Maximum number of lists (6) reached");
        // Give next available position
        Integer maxPos = listRepository.findAll().stream()
                .map(TaskList::getPosition)
                .max(Integer::compareTo)
                .orElse(0);
        list.setPosition(maxPos + 1);
        return listRepository.save(list);
    }

    /**
     * Update an existing TaskList by ID (name only, position stays unless explicitly set).
     */
    public TaskList updateList(Long id, TaskList updated) {
        TaskList existing = listRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("TaskList not found with id " + id));
        existing.setName(updated.getName());
        // Optionally: allow position change (drag & drop: à prévoir si besoin)
        if (updated.getPosition() != existing.getPosition()) {
            existing.setPosition(updated.getPosition());
        }
        return listRepository.save(existing);
    }

    /**
     * Delete a TaskList by its ID, then repack positions for remaining lists.
     */
    public void deleteList(Long id) {
    	// Only check if the list exists before deleting
        if (!listRepository.existsById(id)) {
            throw new RuntimeException("TaskList not found with id " + id);
        }
        listRepository.deleteById(id);

        // Repack all positions to ensure continuity (no gap)
        List<TaskList> remaining = listRepository.findAllByOrderByPositionAsc();
        int pos = 1;
        for (TaskList list : remaining) {
            if (list.getPosition() != pos) {
                list.setPosition(pos);
                listRepository.save(list);
            }
            pos++;
        }
    }



    // ------------------------------------------
    // DTO HELPERS
    // ------------------------------------------

    /**
     * Retrieve all TaskList entities as DTOs (id + name + position), ordered by position.
     */
    public List<TaskListDto> getAllListDtos() {
        return listRepository.findAllByOrderByPositionAsc().stream()
            .map(list -> new TaskListDto(list.getId(), list.getName(), list.getPosition()))
            .toList();
    }
}
