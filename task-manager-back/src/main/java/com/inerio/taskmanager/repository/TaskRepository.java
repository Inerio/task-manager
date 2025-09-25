package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for {@link Task} entities.
 * <p>
 * Provides position-aware lookups within a column and a fast ownership guard
 * used to enforce per-user data scoping.
 * </p>
 */
public interface TaskRepository extends JpaRepository<Task, Long> {

    /**
     * Returns all tasks for the given column ordered by their persistent position (ascending).
     *
     * @param kanbanColumn column entity
     * @return ordered list of tasks
     */
    List<Task> findByKanbanColumnOrderByPositionAsc(KanbanColumn kanbanColumn);

    /**
     * Returns all tasks filtered by completion status.
     *
     * @param completed completion flag
     * @return list of matching tasks
     */
    List<Task> findByCompleted(boolean completed);

    /**
     * Returns all tasks in the given column filtered by completion status.
     *
     * @param kanbanColumn column entity
     * @param completed    completion flag
     * @return list of matching tasks
     */
    List<Task> findByKanbanColumnAndCompleted(KanbanColumn kanbanColumn, boolean completed);

    /**
     * Returns all tasks for the given column (unordered).
     *
     * @param kanbanColumn column entity
     * @return list of tasks
     */
    List<Task> findByKanbanColumn(KanbanColumn kanbanColumn);

    /**
     * Returns tasks in the column with position greater than or equal to the given value,
     * ordered by position (ascending).
     *
     * @param kanbanColumn column entity
     * @param position     minimum position (inclusive)
     * @return ordered list of tasks
     */
    List<Task> findByKanbanColumnAndPositionGreaterThanEqualOrderByPositionAsc(
            KanbanColumn kanbanColumn, int position);

    /**
     * Returns tasks in the column with position greater than the given value,
     * ordered by position (ascending).
     *
     * @param kanbanColumn column entity
     * @param position     minimum position (exclusive)
     * @return ordered list of tasks
     */
    List<Task> findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(
            KanbanColumn kanbanColumn, int position);

    /**
     * Returns tasks in the column with position less than the given value,
     * ordered by position (ascending).
     *
     * @param kanbanColumn column entity
     * @param position     maximum position (exclusive)
     * @return ordered list of tasks
     */
    List<Task> findByKanbanColumnAndPositionLessThanOrderByPositionAsc(
            KanbanColumn kanbanColumn, int position);

    /**
     * Fast ownership guard used by controllers/services:
     * checks whether a task id belongs to a board owned by the specified UID.
     *
     * @param id  task id
     * @param uid owner UID
     * @return {@code true} if the task belongs to a board owned by the UID, otherwise {@code false}
     */
    boolean existsByIdAndKanbanColumnBoardOwnerUid(Long id, String uid);

    /**
     * Returns all tasks for the given column ordered by position ascending, then by id ascending.
     * <p>
     * The secondary key (id) guarantees a deterministic order when multiple rows
     * temporarily share the same {@code position} value (e.g., during migrations,
     * optimistic UI updates, or partial writes). This is useful for stable UI rendering
     * and for server-side reorder operations that need a consistent, tie-broken order.
     * </p>
     *
     * @param kanbanColumn the column whose tasks should be fetched (required)
     * @return the list of tasks ordered by {@code position ASC}, then {@code id ASC}
     */
    List<Task> findByKanbanColumnOrderByPositionAscIdAsc(KanbanColumn kanbanColumn);
    
    /**
     * Returns all tasks that belong to boards owned by the given UID.
     * Results are ordered to be stable for UI rendering: by board -> column -> task position.
     */
    @Query("""
    	       SELECT t
    	       FROM Task t
    	       WHERE t.kanbanColumn.board.owner.uid = :uid
    	       ORDER BY t.kanbanColumn.board.id ASC,
    	                t.kanbanColumn.position ASC,
    	                t.position ASC,
    	                t.id ASC
    	       """)
    List<Task> findAllForOwnerOrdered(@Param("uid") String uid);
}
