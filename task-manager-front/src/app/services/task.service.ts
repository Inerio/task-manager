import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.local';
import { Task } from '../models/task.model';

/**
 * Service Angular pour interagir avec l'API de gestion des tâches.
 * Fournit les opérations CRUD principales.
 */
@Injectable({
  providedIn: 'root',
})
export class TaskService {
  /** URL de base de l'API REST côté Spring */
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Récupère toutes les tâches */
  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  /**
   * Crée une nouvelle tâche
   * @param task L'objet tâche à envoyer
   */
  createTask(task: Task): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task);
  }

  /**
   * Met à jour une tâche existante
   * @param id ID de la tâche à modifier
   * @param task Données mises à jour
   */
  updateTask(id: number, task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}`, task);
  }

  /**
   * Supprime une tâche par son ID
   * @param id ID de la tâche à supprimer
   */
  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Supprime toutes les tâches
   */
  deleteAllTasks(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`);
  }
}
