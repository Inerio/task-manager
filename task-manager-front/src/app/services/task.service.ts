import { HttpClient } from "@angular/common/http";
import {
  computed,
  inject,
  Injectable,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";
import { catchError, firstValueFrom, Observable, tap } from "rxjs";
import { environment } from "../../environments/environment.local";
import { Task } from "../models/task.model";

@Injectable({ providedIn: "root" })
export class TaskService {
  // --------------------------------------------------------------------
  // [STATE & SETUP]
  // --------------------------------------------------------------------
  private http = inject(HttpClient);
  /** Backend API root URL pour les tâches */
  private apiUrl = environment.apiUrlTasks;

  /** Internal signal: global list of tasks (source of truth) */
  private tasksSignal: WritableSignal<Task[]> = signal([]);

  /** Readonly signal for consuming components */
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // --------------------------------------------------------------------
  // [TASKS : READ / FETCH]
  // --------------------------------------------------------------------

  /** Charge toutes les tâches depuis le backend */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: (err) => console.error("Erreur chargement des tâches", err),
    });
  }

  /** Reactive: récupère les tâches associées à une liste par son id */
  getTasksByListId(listId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter((task) => task.listId === listId)
    );
  }

  // --------------------------------------------------------------------
  // [TASKS : CREATE & UPDATE]
  // --------------------------------------------------------------------

  /** Crée une nouvelle tâche */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: (err) => console.error("Erreur création tâche", err),
    });
  }

  /** Modifie une tâche existante */
  updateTask(id: number, updatedTask: Task): void {
    this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask).subscribe({
      next: (updated) => {
        const tasks = this.tasksSignal().map((t) =>
          t.id === id ? updated : t
        );
        this.tasksSignal.set(tasks);
      },
      error: (err) => console.error("Erreur mise à jour tâche", err),
    });
  }

  // --------------------------------------------------------------------
  // [TASKS : DELETE]
  // --------------------------------------------------------------------

  /** Supprime une tâche par son id */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
      },
      error: (err) => console.error("Erreur suppression tâche", err),
    });
  }

  /** Supprime toutes les tâches d'une liste (colonne) via son id */
  deleteTasksByListId(listId: number): void {
    this.http.delete<void>(`${this.apiUrl}/list/${listId}`).subscribe({
      next: () => {
        this.tasksSignal.set(
          this.tasksSignal().filter((t) => t.listId !== listId)
        );
      },
      error: (err) =>
        console.error("Erreur suppression tâches de la colonne", err),
    });
  }

  /** Supprime TOUTES les tâches */
  deleteAllTasks(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`).pipe(
      tap(() => this.tasksSignal.set([])),
      catchError((err) => {
        console.error("Erreur suppression complète", err);
        throw err;
      })
    );
  }

  // --------------------------------------------------------------------
  // [ATTACHMENTS : FILE OPERATIONS]
  // --------------------------------------------------------------------

  /** Upload un fichier en pièce jointe */
  async uploadAttachment(taskId: number, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const updated = await firstValueFrom(
      this.http.post<Task>(`${this.apiUrl}/${taskId}/attachments`, formData)
    );
    if (!updated) return;
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === taskId ? updated : t))
    );
  }

  /** Télécharge une pièce jointe */
  downloadAttachment(taskId: number, filename: string): void {
    this.http
      .get(
        `${this.apiUrl}/${taskId}/attachments/${encodeURIComponent(filename)}`,
        { responseType: "blob" }
      )
      .subscribe((blob) => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(link.href);
      });
  }

  /** Supprime une pièce jointe */
  async deleteAttachment(taskId: number, filename: string): Promise<void> {
    const updated = await firstValueFrom(
      this.http.delete<Task>(
        `${this.apiUrl}/${taskId}/attachments/${encodeURIComponent(filename)}`
      )
    );
    if (!updated) return;
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === taskId ? updated : t))
    );
  }
}
