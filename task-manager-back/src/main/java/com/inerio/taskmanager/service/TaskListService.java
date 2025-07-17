package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.TaskListDto;
import com.inerio.taskmanager.model.TaskList;
import com.inerio.taskmanager.repository.TaskListRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service layer for business logic related to Kanban columns (TaskList).
 * <p>
 * Handles CRUD operations, position management for drag &amp; drop, and conversions to DTOs.
 * </p>
 *
 * <ul>
 *     <li>Ensures column order and unique naming.</li>
 *     <li>Limits the number of columns if required by business logic.</li>
 *     <li>Provides helpers for UI-friendly API responses.</li>
 * </ul>
 */
@Service
public class TaskListService {

    /** Repository for persistence and queries on TaskList entities. */
    private final TaskListRepository listRepository;

    /**
     * Constructs the service with required dependency injection.
     *
     * @param listRepository The JPA repository for TaskList.
     */
    public TaskListService(TaskListRepository listRepository) {
        this.listRepository = listRepository;
    }

    // ==========================
    //     PUBLIC METHODS
    // ==========================

    /**
     * Retrieves all TaskList entities, ordered by their position for display.
     *
     * @return Ordered list of TaskList entities.
     */
    public List<TaskList> getAllLists() {
        return listRepository.findAllByOrderByPositionAsc();
    }

    /**
     * Finds a TaskList by its ID, if present.
     *
     * @param id List/column ID.
     * @return Optional of TaskList entity.
     */
    public Optional<TaskList> getListById(Long id) {
        return listRepository.findById(id);
    }

    /**
     * Creates a new TaskList (Kanban column) at the last available position.
     * <p>
     * Business rule: Maximum of 6 lists allowed.
     * </p>
     *
     * @param list TaskList to persist (should have name set).
     * @return The persisted TaskList with position and ID.
     * @throws IllegalStateException if max column limit reached.
     */
    public TaskList createList(TaskList list) {
        long count = listRepository.count();
        if (count >= 6) {
            throw new IllegalStateException("Maximum number of lists (6) reached");
        }
        // Determine the next available position (1-based).
        Integer maxPos = listRepository.findAll().stream()
                .map(TaskList::getPosition)
                .max(Integer::compareTo)
                .orElse(0);
        list.setPosition(maxPos + 1);
        return listRepository.save(list);
    }

    /**
     * Updates an existing TaskList's name and (optionally) its position.
     * <p>
     * Position is only updated if changed in input.
     * </p>
     *
     * @param id      The ID of the list to update.
     * @param updated The incoming list data (typically just name and maybe position).
     * @return The updated, persisted TaskList.
     * @throws RuntimeException if no list with this ID exists.
     */
    public TaskList updateList(Long id, TaskList updated) {
        TaskList existing = listRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("TaskList not found with id " + id));
        existing.setName(updated.getName());
        if (updated.getPosition() != existing.getPosition()) {
            existing.setPosition(updated.getPosition());
        }
        return listRepository.save(existing);
    }

    /**
     * Deletes a TaskList by ID and repacks all other lists to ensure positions are continuous.
     * <p>
     * Ensures no "holes" remain in ordering after a column is deleted.
     * </p>
     *
     * @param id The ID of the list/column to delete.
     * @throws RuntimeException if the list does not exist.
     */
    public void deleteList(Long id) {
        if (!listRepository.existsById(id)) {
            throw new RuntimeException("TaskList not found with id " + id);
        }
        listRepository.deleteById(id);

        // After deletion, ensure all list positions are contiguous (starting from 1)
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

    /**
     * Moves a TaskList (column) to a new position and adjusts all other columns.
     * <p>
     * Used for drag-and-drop reordering of Kanban columns.
     * </p>
     *
     * @param listId        ID of the column to move.
     * @param targetPosition New position (1-based index).
     * @throws RuntimeException if the list does not exist.
     */
    public void moveList(Long listId, int targetPosition) {
        List<TaskList> lists = listRepository.findAllByOrderByPositionAsc();
        TaskList toMove = lists.stream()
                .filter(l -> l.getId().equals(listId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("TaskList not found with id " + listId));

        int oldPosition = toMove.getPosition();
        int newPosition = Math.max(1, Math.min(targetPosition, lists.size()));

        if (oldPosition == newPosition) return;

        for (TaskList l : lists) {
            if (l.getId().equals(listId)) continue;
            int pos = l.getPosition();
            if (oldPosition < newPosition) {
                // Shift left: decrement positions of columns between old and new.
                if (pos > oldPosition && pos <= newPosition) l.setPosition(pos - 1);
            } else {
                // Shift right: increment positions of columns between new and old.
                if (pos < oldPosition && pos >= newPosition) l.setPosition(pos + 1);
            }
        }
        toMove.setPosition(newPosition);

        // Save all affected columns.
        for (TaskList l : lists) {
            listRepository.save(l);
        }
    }

    /**
     * Converts all TaskList entities into DTOs for API responses, ordered by position.
     *
     * @return List of TaskListDto.
     */
    public List<TaskListDto> getAllListDtos() {
        return listRepository.findAllByOrderByPositionAsc().stream()
                .map(list -> new TaskListDto(list.getId(), list.getName(), list.getPosition()))
                .toList();
    }
}
