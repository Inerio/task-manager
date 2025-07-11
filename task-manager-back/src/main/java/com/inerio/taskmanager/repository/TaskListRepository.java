package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.TaskList;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Repository for TaskList (columns/lists).
 */
public interface TaskListRepository extends JpaRepository<TaskList, Long> {
    Optional<TaskList> findByName(String name);
}
