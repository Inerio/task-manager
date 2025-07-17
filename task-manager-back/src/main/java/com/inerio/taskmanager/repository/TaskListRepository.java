package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.TaskList;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link TaskList} entities.
 * <p>
 * Used for CRUD operations and custom queries on Kanban board columns (TaskLists).
 * </p>
 *
 * <ul>
 *   <li>Extends JpaRepository: provides all basic CRUD operations.</li>
 *   <li>Defines specific queries for name lookup and position-based ordering.</li>
 * </ul>
 */
public interface TaskListRepository extends JpaRepository<TaskList, Long> {

    /**
     * Finds a TaskList (column) by its unique name.
     *
     * @param name the unique column name
     * @return an {@code Optional} containing the found {@link TaskList}, or empty if not found
     */
    Optional<TaskList> findByName(String name);

    /**
     * Retrieves all TaskLists ordered by their persistent position (for stable board rendering).
     * <p>
     * Lower position = further left.
     * </p>
     *
     * @return a list of all TaskLists ordered by their position field (ascending)
     */
    List<TaskList> findAllByOrderByPositionAsc();

}
