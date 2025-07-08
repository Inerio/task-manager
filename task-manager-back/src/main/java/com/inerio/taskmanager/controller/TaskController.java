package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.service.TaskService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/tasks")
@CrossOrigin(origins = "*") // À restreindre si prod
public class TaskController {

    private final TaskService taskService;

    private static final Logger log = LoggerFactory.getLogger(TaskController.class);
    
    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** Liste toutes les tâches */
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks() {
        List<Task> tasks = taskService.getAllTasks();

        if (tasks.isEmpty()) {
            return ResponseEntity.noContent().build(); // 204 No Content
        }

        return ResponseEntity.ok(tasks); // 200 OK
    }

    /** Récupère une tâche par ID */
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id)
        		.map(ResponseEntity::ok)
        		.orElse(ResponseEntity.notFound().build()); // 404 Not Found
    }

    /** Crée une nouvelle tâche */
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        Task createdTask = taskService.createTask(task);

        URI location = URI.create("/" + createdTask.getId());
        return ResponseEntity
                .created(location) // 201 
                .body(createdTask);     
    }

    /** Supprime une tâche par ID */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        Optional<Task> taskOpt = taskService.getTaskById(id);
        if (taskOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }
    
    /** Supprime toutes les tâches d'une colonne/statut */
    @DeleteMapping("/status/{status}")
    public ResponseEntity<Void> deleteTasksByStatus(@PathVariable String status) {
        taskService.deleteTasksByStatus(status);
        return ResponseEntity.noContent().build();
    }

    /** Supprime toutes les tâches */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks() {
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build(); // 204
    }
    
    /** Met à jour une tâche */
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task updatedTask) {
        try {
            Task savedTask = taskService.updateTask(id, updatedTask);
            return ResponseEntity.ok(savedTask);
        } catch (RuntimeException e) {
        	log.warn("Tâche non trouvée pour mise à jour : " + id, e);
            return ResponseEntity.notFound().build();
        }
    }


}
