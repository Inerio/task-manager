package com.inerio.taskmanager.service;

import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service metier pour la gestion des taches.
 * Gere les regles metier et la delegation vers le repository.
 */
@Service
public class TaskService {

    private final TaskRepository taskRepository;

    // Injection du repository via le constructeur
    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    /**
     * Retourne toutes les taches en base.
     */
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    /**
     * Retourne une tache par son ID.
     */
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Cree une nouvelle tache ou met a jour si l'ID existe deja.
     */
    public Task createTask(Task task) {
        return taskRepository.save(task);
    }

    /**
     * Supprime une tache par ID.
     * @throws TaskNotFoundException si l'ID est inconnu
     */
    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new TaskNotFoundException("Tache introuvable avec l'ID " + id);
        }
        taskRepository.deleteById(id);
    }

    /**
     * Supprime toutes les taches.
     */
    public void deleteAllTasks() {
        taskRepository.deleteAll();
    }

    /**
     * Met a jour une tache par ID.
     * @throws TaskNotFoundException si l'ID n'existe pas
     */
    public Task updateTask(Long id, Task updatedTask) {
        Task existing = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException("Tache introuvable avec l'ID " + id));

        existing.setTitle(updatedTask.getTitle());
        existing.setDescription(updatedTask.getDescription());
        existing.setCompleted(updatedTask.isCompleted());
        existing.setStatus(updatedTask.getStatus());

        return taskRepository.save(existing);
    }
}
