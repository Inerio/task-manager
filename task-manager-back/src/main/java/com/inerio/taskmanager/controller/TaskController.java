package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.service.TaskService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/tasks")
@CrossOrigin(origins = "*") // À restreindre en prod
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** Liste toutes les tâches */
    @GetMapping
    public List<Task> getAllTasks() {
        return taskService.getAllTasks();
    }

    /** Récupère une tâche par ID */
    @GetMapping("/{id}")
    public Task getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id).orElse(null);
    }

    /** Crée une nouvelle tâche */
    @PostMapping
    public Task createTask(@RequestBody Task task) {
        return taskService.createTask(task);
    }

    /** Supprime une tâche par ID */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }
    
    /** Supprime toutes les tâches */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAllTasks() {
        taskService.deleteAllTasks();
        return ResponseEntity.noContent().build();
    }
    
    /** Met à jour une tâche */
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task updatedTask) {
        Optional<Task> existingTaskOpt = taskService.getTaskById(id);
        if (existingTaskOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Task existingTask = existingTaskOpt.get();
        existingTask.setTitle(updatedTask.getTitle());
        existingTask.setDescription(updatedTask.getDescription());
        existingTask.setCompleted(updatedTask.isCompleted());
        existingTask.setStatus(updatedTask.getStatus());

        Task savedTask = taskService.createTask(existingTask); // ou updateTask()
        return ResponseEntity.ok(savedTask);
    }

}
