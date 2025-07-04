import { HttpClient } from '@angular/common/http';
import {
  computed,
  inject,
  Injectable,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment.local';
import { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /** Signal global contenant la liste des tâches */
  private tasksSignal: WritableSignal<Task[]> = signal([]);

  /** Accès en lecture seule au signal */
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // ----------------------------
  // Lecture / récupération
  // ----------------------------

  /** Charge toutes les tâches depuis l'API */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: (err) => console.error('Erreur chargement des tâches', err),
    });
  }

  /** Retourne une liste réactive des tâches filtrées par statut */
  getTasksByStatus(status: string): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter((task) => task.status === status),
    );
  }

  // ----------------------------
  // Création / mise à jour
  // ----------------------------

  /** Crée une nouvelle tâche */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: (err) => console.error('Erreur création tâche', err),
    });
  }

  /** Met à jour une tâche existante */
  updateTask(id: number, updatedTask: Task): void {
    this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask).subscribe({
      next: (updated) => {
        const tasks = this.tasksSignal().map((t) =>
          t.id === id ? updated : t,
        );
        this.tasksSignal.set(tasks);
      },
      error: (err) => console.error('Erreur mise à jour tâche', err),
    });
  }

  // ----------------------------
  // Suppression
  // ----------------------------

  /** Supprime une tâche par ID */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
      },
      error: (err) => console.error('Erreur suppression tâche', err),
    });
  }

  /** Supprime toutes les tâches et retourne un Observable */
  deleteAllTasks(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`).pipe(
      tap(() => this.tasksSignal.set([])),
      catchError((err) => {
        console.error('Erreur suppression complète', err);
        throw err;
      }),
    );
  }
}
