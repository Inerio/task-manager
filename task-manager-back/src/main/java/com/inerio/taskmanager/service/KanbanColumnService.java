package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.KanbanColumnDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service layer for business logic related to Kanban columns (KanbanColumn).
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
public class KanbanColumnService {

    /** Repository for persistence and queries on KanbanColumn entities. */
    private final KanbanColumnRepository kanbanColumnRepository;

    /**
     * Constructs the service with required dependency injection.
     *
     * @param kanbanColumnRepository The JPA repository for KanbanColumn.
     */
    public KanbanColumnService(KanbanColumnRepository kanbanColumnRepository) {
        this.kanbanColumnRepository = kanbanColumnRepository;
    }

    // ==========================
    //     PUBLIC METHODS
    // ==========================

    /**
     * Retrieves all KanbanColumn entities, ordered by their position for display.
     *
     * @return Ordered list of KanbanColumn entities.
     */
    public List<KanbanColumn> getAllKanbanColumns() {
        return kanbanColumnRepository.findAllByOrderByPositionAsc();
    }

    /**
     * Finds a KanbanColumn by its ID, if present.
     *
     * @param id Column ID.
     * @return Optional of KanbanColumn entity.
     */
    public Optional<KanbanColumn> getKanbanColumnById(Long id) {
        return kanbanColumnRepository.findById(id);
    }

    /**
     * Creates a new KanbanColumn (Kanban column) at the last available position.
     * <p>
     * Business rule: Maximum of 6 columns allowed.
     * </p>
     *
     * @param kanbanColumn KanbanColumn to persist (should have name set).
     * @return The persisted KanbanColumn with position and ID.
     * @throws IllegalStateException if max column limit reached.
     */
    public KanbanColumn createKanbanColumn(KanbanColumn kanbanColumn) {
        long count = kanbanColumnRepository.count();
        if (count >= 6) {
            throw new IllegalStateException("Maximum number of columns (6) reached");
        }
        // Determine the next available position (1-based).
        Integer maxPos = kanbanColumnRepository.findAll().stream()
                .map(KanbanColumn::getPosition)
                .max(Integer::compareTo)
                .orElse(0);
        kanbanColumn.setPosition(maxPos + 1);
        return kanbanColumnRepository.save(kanbanColumn);
    }

    /**
     * Updates an existing KanbanColumn's name and (optionally) its position.
     * <p>
     * Position is only updated if changed in input.
     * </p>
     *
     * @param id      The ID of the column to update.
     * @param updated The incoming column data (typically just name and maybe position).
     * @return The updated, persisted KanbanColumn.
     * @throws RuntimeException if no column with this ID exists.
     */
    public KanbanColumn updateKanbanColumn(Long id, KanbanColumn updated) {
        KanbanColumn existing = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + id));
        existing.setName(updated.getName());
        if (updated.getPosition() != existing.getPosition()) {
            existing.setPosition(updated.getPosition());
        }
        return kanbanColumnRepository.save(existing);
    }

    /**
     * Deletes a KanbanColumn by ID and repacks all other columns to ensure positions are continuous.
     * <p>
     * Ensures no "holes" remain in ordering after a column is deleted.
     * </p>
     *
     * @param id The ID of the column to delete.
     * @throws RuntimeException if the column does not exist.
     */
    public void deleteKanbanColumn(Long id) {
        if (!kanbanColumnRepository.existsById(id)) {
            throw new RuntimeException("KanbanColumn not found with id " + id);
        }
        kanbanColumnRepository.deleteById(id);

        // After deletion, ensure all column positions are contiguous (starting from 1)
        List<KanbanColumn> remaining = kanbanColumnRepository.findAllByOrderByPositionAsc();
        int pos = 1;
        for (KanbanColumn kanbanColumn : remaining) {
            if (kanbanColumn.getPosition() != pos) {
                kanbanColumn.setPosition(pos);
                kanbanColumnRepository.save(kanbanColumn);
            }
            pos++;
        }
    }

    /**
     * Moves a KanbanColumn (column) to a new position and adjusts all other columns.
     * <p>
     * Used for drag-and-drop reordering of Kanban columns.
     * </p>
     *
     * @param kanbanColumnId        ID of the column to move.
     * @param targetPosition New position (1-based index).
     * @throws RuntimeException if the column does not exist.
     */
    public void moveKanbanColumn(Long kanbanColumnId, int targetPosition) {
        List<KanbanColumn> kanbanColumns = kanbanColumnRepository.findAllByOrderByPositionAsc();
        KanbanColumn toMove = kanbanColumns.stream()
                .filter(l -> l.getId().equals(kanbanColumnId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + kanbanColumnId));

        int oldPosition = toMove.getPosition();
        int newPosition = Math.max(1, Math.min(targetPosition, kanbanColumns.size()));

        if (oldPosition == newPosition) return;

        for (KanbanColumn l : kanbanColumns) {
            if (l.getId().equals(kanbanColumnId)) continue;
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
        for (KanbanColumn l : kanbanColumns) {
            kanbanColumnRepository.save(l);
        }
    }

    /**
     * Converts all KanbanColumn entities into DTOs for API responses, ordered by position.
     *
     * @return List of KanbanColumnDto.
     */
    public List<KanbanColumnDto> getAllKanbanColumnDtos() {
        return kanbanColumnRepository.findAllByOrderByPositionAsc().stream()
                .map(kanbanColumn -> new KanbanColumnDto(kanbanColumn.getId(), kanbanColumn.getName(), kanbanColumn.getPosition()))
                .toList();
    }
}
