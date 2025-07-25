package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.KanbanColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Spring Data JPA repository for {@link Task} entities.
 * <p>
 * Used for CRUD operations and advanced queries on Kanban tasks, including
 * ordered retrieval and drag-and-drop support.
 * </p>
 *
 * <ul>
 *   <li>Extends JpaRepository: all CRUD methods are inherited.</li>
 *   <li>Defines position-aware queries for Kanban board ordering.</li>
 *   <li>Provides utilities for bulk task reordering and filtering.</li>
 * </ul>
 */
public interface TaskRepository extends JpaRepository<Task, Long> {

    /**
     * Finds all tasks for a given Kanban column, ordered by their persistent position field.
     * <p>
     * Used for displaying column tasks in the correct order.
     * </p>
     *
     * @param kanbanColumn the target Kanban column (KanbanColumn entity)
     * @return ordered list of {@link Task} for this column
     */
    List<Task> findByKanbanColumnOrderByPositionAsc(KanbanColumn kanbanColumn);

    /**
     * Finds all tasks that match the given completed status.
     * <p>
     * Used for global or filtered "done"/"not done" queries.
     * </p>
     *
     * @param completed true for completed tasks, false for not completed
     * @return list of matching tasks
     */
    List<Task> findByCompleted(boolean completed);

    /**
     * Finds all tasks in a specific Kanban column with a specific completed status.
     *
     * @param kanbanColumn      the Kanban column
     * @param completed the completed status to filter on
     * @return list of tasks matching criteria
     */
    List<Task> findByKanbanColumnAndCompleted(KanbanColumn kanbanColumn, boolean completed);

    /**
     * Finds all tasks for a given column (without ordering).
     * <p>
     * Used for operations where ordering does not matter (e.g., bulk delete).
     * </p>
     *
     * @param kanbanColumn the Kanban column
     * @return list of all tasks in this column
     */
    List<Task> findByKanbanColumn(KanbanColumn kanbanColumn);

    /**
     * Finds all tasks in a column with position >= {@code min}, ordered by position ASC.
     * <p>
     * Used when shifting tasks "down" during a drag-and-drop operation.
     * </p>
     *
     * @param kanbanColumn     the Kanban column
     * @param position the minimum (inclusive) position
     * @return ordered list of tasks matching criteria
     */
    List<Task> findByKanbanColumnAndPositionGreaterThanEqualOrderByPositionAsc(KanbanColumn kanbanColumn, int position);

    /**
     * Finds all tasks in a column with position > {@code min}, ordered by position ASC.
     * <p>
     * Used to update positions after a task has been moved or deleted.
     * </p>
     *
     * @param kanbanColumn     the Kanban column
     * @param position the minimum (exclusive) position
     * @return ordered list of tasks to update
     */
    List<Task> findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(KanbanColumn kanbanColumn, int position);

    /**
     * Finds all tasks in a column with position &lt; {@code max}, ordered by position ASC.
     * <p>
     * Can be used to get tasks above a certain index.
     * </p>
     *
     * @param kanbanColumn     the Kanban column
     * @param position the maximum (exclusive) position
     * @return ordered list of tasks
     */
    List<Task> findByKanbanColumnAndPositionLessThanOrderByPositionAsc(KanbanColumn kanbanColumn, int position);
}
