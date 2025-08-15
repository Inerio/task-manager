package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data JPA repository for {@link KanbanColumn} entities.
 * <p>
 * Provides position-aware lookups within a board and a fast ownership check
 * used to enforce per-user data scoping.
 * </p>
 */
public interface KanbanColumnRepository extends JpaRepository<KanbanColumn, Long> {

    /**
     * Returns all columns for the given board id (unordered).
     *
     * @param boardId board identifier
     * @return list of columns
     */
    List<KanbanColumn> findByBoardId(Long boardId);

    /**
     * Returns all columns ordered by their persistent position (ascending).
     *
     * @return ordered list of columns
     */
    List<KanbanColumn> findAllByOrderByPositionAsc();

    /**
     * Returns all columns for the given board id ordered by position (ascending).
     *
     * @param boardId board identifier
     * @return ordered list of columns
     */
    List<KanbanColumn> findByBoardIdOrderByPositionAsc(Long boardId);

    /**
     * Returns all columns for the given board ordered by position (ascending).
     *
     * @param board board entity
     * @return ordered list of columns
     */
    List<KanbanColumn> findByBoardOrderByPositionAsc(Board board);

    /**
     * Counts the number of columns for the given board.
     *
     * @param board board entity
     * @return number of columns
     */
    long countByBoard(Board board);

    /**
     * Fast ownership guard used by controllers/services:
     * checks whether a column id belongs to a board owned by the specified UID.
     *
     * @param id  column id
     * @param uid owner UID
     * @return {@code true} if the column belongs to a board owned by the UID, otherwise {@code false}
     */
    boolean existsByIdAndBoardOwnerUid(Long id, String uid);
}
