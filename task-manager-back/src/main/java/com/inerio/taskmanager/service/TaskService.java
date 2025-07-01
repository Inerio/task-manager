package com.inerio.taskmanager.service;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service métier pour la gestion des tâches.
 * Contient les règles de gestion et délègue les opérations à la couche repository.
 */
@Service
public class TaskService {

    private final TaskRepository taskRepository;

    // Injection du repository via le constructeur
    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    /**
     * Récupère toutes les tâches stockées.
     * @return liste complète des tâches
     */
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    /**
     * Récupère une tâche par son identifiant.
     * @param id identifiant de la tâche
     * @return Optional contenant la tâche si elle existe
     */
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Crée une nouvelle tâche (ou met à jour si l'ID est déjà présent).
     * @param task tâche à sauvegarder
     * @return tâche persistée
     */
    public Task createTask(Task task) {
        return taskRepository.save(task);
    }

    /**
     * Supprime une tâche selon son ID.
     * @param id identifiant de la tâche
     */
    public void deleteTask(Long id) {
        taskRepository.deleteById(id);
    }

    /**
     * Supprime toutes les tâches de la base.
     */
    public void deleteAllTasks() {
        taskRepository.deleteAll();
    }

    /**
     * Met à jour une tâche existante en base.
     * @param id identifiant de la tâche à modifier
     * @param updatedTask données mises à jour
     * @return tâche mise à jour
     * @throws RuntimeException si la tâche n'existe pas
     */
    public Task updateTask(Long id, Task updatedTask) {
        Task existing = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable avec l'ID " + id));

        existing.setTitle(updatedTask.getTitle());
        existing.setDescription(updatedTask.getDescription());
        existing.setCompleted(updatedTask.isCompleted());
        existing.setStatus(updatedTask.getStatus());

        return taskRepository.save(existing);
    }
}
