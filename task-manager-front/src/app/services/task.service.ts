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
  /** Angular's HttpClient for API calls */
  private http = inject(HttpClient);
  /** Backend API root URL */
  private apiUrl = environment.apiUrl;

  /** Internal signal: global list of tasks (source of truth) */
  private tasksSignal: WritableSignal<Task[]> = signal([]);

  /** Readonly signal for consuming components */
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // --------------------------------------------------------------------
  // [TASKS : READ / FETCH]
  // --------------------------------------------------------------------

  /** Load all tasks from backend */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: (err) => console.error("Erreur chargement des tâches", err),
    });
  }

  /** Get a reactive filtered list by column status */
  getTasksByStatus(status: string): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter((task) => task.status === status)
    );
  }

  // --------------------------------------------------------------------
  // [TASKS : CREATE & UPDATE]
  // --------------------------------------------------------------------

  /** Create a new task (POST) */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: (err) => console.error("Erreur création tâche", err),
    });
  }

  /** Update an existing task (PUT) */
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

  /** Delete a single task by ID */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
      },
      error: (err) => console.error("Erreur suppression tâche", err),
    });
  }

  /** Delete all tasks for a given status/column */
  deleteTasksByStatus(status: string): void {
    this.http.delete<void>(`${this.apiUrl}/status/${status}`).subscribe({
      next: () => {
        // Remove tasks with this status locally
        this.tasksSignal.set(
          this.tasksSignal().filter((t) => t.status !== status)
        );
      },
      error: (err) =>
        console.error("Erreur suppression tâches par colonne", err),
    });
  }

  /** Delete ALL tasks (returns Observable for chaining) */
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

  /** Upload a file for a task */
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

  /** Download an attached file for a task */
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

  /** Delete an attached file for a task */
  async deleteAttachment(taskId: number, filename: string): Promise<void> {
    const updated = await firstValueFrom(
      this.http.delete<Task>(
        `${this.apiUrl}/${taskId}/attachments/${encodeURIComponent(filename)}`
      )
    );
    if (!updated) return; // No update returned, skip
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === taskId ? updated : t))
    );
  }
}
