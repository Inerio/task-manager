package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.KanbanColumnDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.BoardRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service layer for business logic related to Kanban columns (KanbanColumn) in a multi-board setup.
 * <p>
 * Handles CRUD operations, position management for drag and drop, and conversions to DTOs.
 * </p>
 *
 * <ul>
 *     <li>Ensures column order and unique naming within a board.</li>
 *     <li>Limits the number of columns per board if required by business logic.</li>
 *     <li>Provides helpers for UI-friendly API responses.</li>
 * </ul>
 */
@Service
public class KanbanColumnService {

    private final KanbanColumnRepository kanbanColumnRepository;
    private final BoardRepository boardRepository;

    /**
     * Constructs the service with required dependency injection.
     *
     * @param kanbanColumnRepository The JPA repository for KanbanColumn.
     * @param boardRepository        The JPA repository for Board.
     */
    public KanbanColumnService(KanbanColumnRepository kanbanColumnRepository, BoardRepository boardRepository) {
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.boardRepository = boardRepository;
    }

    // ==========================
    //     PUBLIC METHODS
    // ==========================

    /**
     * Retrieves all KanbanColumn entities for a board, ordered by their position for display.
     *
     * @param boardId ID of the Board.
     * @return Ordered list of KanbanColumn entities for the given board.
     */
    public List<KanbanColumn> getAllKanbanColumns(Long boardId) {
        Board board = getBoardOrThrow(boardId);
        return kanbanColumnRepository.findByBoardOrderByPositionAsc(board);
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
     * Creates a new KanbanColumn (Kanban column) at the last available position on the specified board.
     * <p>
     * Business rule: Maximum of 5 columns per board allowed.
     * </p>
     *
     * @param kanbanColumn KanbanColumn to persist (should have name set).
     * @param boardId      ID of the board to add the column to.
     * @return The persisted KanbanColumn with position and ID.
     * @throws IllegalStateException if max column limit reached on this board.
     */
    public KanbanColumn createKanbanColumn(KanbanColumn kanbanColumn, Long boardId) {
        Board board = getBoardOrThrow(boardId);
        long count = kanbanColumnRepository.countByBoard(board);
        if (count >= 5) {
            throw new IllegalStateException("Maximum number of columns (5) reached for this board");
        }
        // Determine the next available position (1-based).
        Integer maxPos = kanbanColumnRepository.findByBoardOrderByPositionAsc(board).stream()
                .map(KanbanColumn::getPosition)
                .max(Integer::compareTo)
                .orElse(0);
        kanbanColumn.setPosition(maxPos + 1);
        kanbanColumn.setBoard(board);
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
     * Deletes a KanbanColumn by ID and repacks all other columns to ensure positions are continuous within the board.
     * <p>
     * Ensures no "holes" remain in ordering after a column is deleted.
     * </p>
     *
     * @param id The ID of the column to delete.
     * @throws RuntimeException if the column does not exist.
     */
    public void deleteKanbanColumn(Long id) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + id));
        Board board = column.getBoard();
        kanbanColumnRepository.deleteById(id);

        // After deletion, ensure all column positions on the board are contiguous (starting from 1)
        List<KanbanColumn> remaining = kanbanColumnRepository.findByBoardOrderByPositionAsc(board);
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
     * Moves a KanbanColumn (column) to a new position and adjusts all other columns in the same board.
     * <p>
     * Used for drag-and-drop reordering of Kanban columns.
     * Guarantees that after the move, all columns on the board have unique and contiguous positions (starting at 1).
     * </p>
     *
     * @param kanbanColumnId  ID of the column to move.
     * @param targetPosition  New position (1-based index).
     * @throws RuntimeException if the column does not exist.
     */
    public void moveKanbanColumn(Long kanbanColumnId, int targetPosition) {
        KanbanColumn toMove = kanbanColumnRepository.findById(kanbanColumnId)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + kanbanColumnId));
        Board board = toMove.getBoard();

        // Get all columns, sorted by position
        List<KanbanColumn> columns = kanbanColumnRepository.findByBoardOrderByPositionAsc(board);

        // Remove the column to move from the list
        columns.removeIf(col -> col.getId().equals(kanbanColumnId));

        // Clamp the new position within allowed range
        int newPos = Math.max(1, Math.min(targetPosition, columns.size() + 1));

        // Insert the moved column at the desired position (index = newPos - 1)
        columns.add(newPos - 1, toMove);

        // Re-assign positions (1, 2, ..., N)
        for (int i = 0; i < columns.size(); i++) {
            KanbanColumn col = columns.get(i);
            col.setPosition(i + 1);
            kanbanColumnRepository.save(col);
        }
    }

    /**
     * Converts all KanbanColumn entities for a board into DTOs for API responses, ordered by position.
     *
     * @param boardId Board ID.
     * @return List of KanbanColumnDto.
     */
    public List<KanbanColumnDto> getAllKanbanColumnDtos(Long boardId) {
        Board board = getBoardOrThrow(boardId);
        return kanbanColumnRepository.findByBoardOrderByPositionAsc(board).stream()
                .map(kanbanColumn -> new KanbanColumnDto(
                        kanbanColumn.getId(),
                        kanbanColumn.getName(),
                        kanbanColumn.getPosition(),
                        board.getId()
                ))
                .toList();
    }

    // ============== INTERNAL HELPERS ==============

    private Board getBoardOrThrow(Long boardId) {
        return boardRepository.findById(boardId)
                .orElseThrow(() -> new RuntimeException("Board not found with id " + boardId));
    }
}
