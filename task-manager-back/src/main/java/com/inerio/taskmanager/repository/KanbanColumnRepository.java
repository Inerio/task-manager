package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link KanbanColumn} entities.
 * <p>
 * Used for CRUD operations and custom queries on Kanban board columns (KanbanColumns).
 * </p>
 *
 * <ul>
 *   <li>Extends JpaRepository: provides all basic CRUD operations.</li>
 *   <li>Defines specific queries for name lookup and position-based ordering.</li>
 * </ul>
 */
public interface KanbanColumnRepository extends JpaRepository<KanbanColumn, Long> {

    /**
     * Finds a KanbanColumn (column) by its unique name.
     *
     * @param name the unique column name
     * @return an {@code Optional} containing the found {@link KanbanColumn}, or empty if not found
     */
    Optional<KanbanColumn> findByName(String name);

    /**
     * Retrieves all KanbanColumns ordered by their persistent position (for stable board rendering).
     * <p>
     * Lower position = further left.
     * </p>
     *
     * @return a list of all KanbanColumns ordered by their position field (ascending)
     */
    List<KanbanColumn> findAllByOrderByPositionAsc();

    /**
     * Finds all columns belonging to a given board, ordered by position (by board ID).
     * <p>
     * Used for legacy or direct ID-based access.
     * </p>
     * @param boardId ID of the parent board
     * @return List of columns for the board
     */
    List<KanbanColumn> findByBoardIdOrderByPositionAsc(Long boardId);

    /**
     * Finds all columns belonging to a given board, ordered by position (by Board object).
     * <p>
     * Preferred in service/business logic.
     * </p>
     * @param board the parent Board entity
     * @return List of columns for the board
     */
    List<KanbanColumn> findByBoardOrderByPositionAsc(Board board);

    /**
     * Counts columns belonging to a given board.
     * @param board the parent Board entity
     * @return count of columns in the board
     */
    long countByBoard(Board board);
}
