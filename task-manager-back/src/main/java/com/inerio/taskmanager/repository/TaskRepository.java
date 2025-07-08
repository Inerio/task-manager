package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
	
	void deleteByStatus(String status);
    // Optionnelles, selon l'évolution du projet
    List<Task> findByStatus(String status);
    // Peut être utile
    List<Task> findByCompleted(boolean completed);
    List<Task> findByStatusAndCompleted(String status, boolean completed);
}
