package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.TaskList;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Repository interface for Task entities.
 * Inherits CRUD operations from JpaRepository and provides custom queries.
 */
public interface TaskRepository extends JpaRepository<Task, Long> {

    /**
     * Find all tasks that belong to a specific TaskList (Kanban column).
     */
    List<Task> findByList(TaskList list);

    /**
     * Find all tasks with a given completed status (true/false).
     */
    List<Task> findByCompleted(boolean completed);

    /**
     * Find all tasks for a given list and completion status.
     */
    List<Task> findByListAndCompleted(TaskList list, boolean completed);

}
