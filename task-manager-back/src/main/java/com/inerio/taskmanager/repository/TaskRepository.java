package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Repository interface for Task entities.
 * Inherits CRUD from JpaRepository, plus custom queries.
 */
public interface TaskRepository extends JpaRepository<Task, Long> {
    /**
     * Delete all tasks by status (used for column/kanban delete).
     */
    void deleteByStatus(String status);

    // --- Optional finders for flexibility ---
    List<Task> findByStatus(String status);
    List<Task> findByCompleted(boolean completed);
    List<Task> findByStatusAndCompleted(String status, boolean completed);
}
