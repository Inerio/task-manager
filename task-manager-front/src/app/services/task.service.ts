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
  // ------------------------------------------
  // API & STATE SIGNALS
  // ------------------------------------------
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlTasks;

  // Holds all tasks loaded from backend (single source of truth)
  private readonly tasksSignal: WritableSignal<Task[]> = signal([]);
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // ------------------------------------------
  // TASKS: READ / FETCH
  // ------------------------------------------
  /** Loads all tasks from the backend and updates the signal */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: (err) => console.error("Error loading tasks", err),
    });
  }

  /** Reactive computed: returns only tasks belonging to a given list */
  getTasksByListId(listId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter((task) => task.listId === listId)
    );
  }

  // ------------------------------------------
  // TASKS: CREATE & UPDATE
  // ------------------------------------------
  /** Creates a new task and adds it to the state */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: (err) => console.error("Error creating task", err),
    });
  }

  /** Updates an existing task (by id) */
  updateTask(id: number, updatedTask: Task): void {
    this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask).subscribe({
      next: (updated) => {
        const tasks = this.tasksSignal().map((t) =>
          t.id === id ? updated : t
        );
        this.tasksSignal.set(tasks);
      },
      error: (err) => console.error("Error updating task", err),
    });
  }

  // ------------------------------------------
  // TASKS: DELETE
  // ------------------------------------------
  /** Deletes a single task by id */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
      },
      error: (err) => console.error("Error deleting task", err),
    });
  }

  /** Deletes all tasks for a specific list (column) by its id */
  deleteTasksByListId(listId: number): void {
    this.http.delete<void>(`${this.apiUrl}/list/${listId}`).subscribe({
      next: () => {
        this.tasksSignal.set(
          this.tasksSignal().filter((t) => t.listId !== listId)
        );
      },
      error: (err) => console.error("Error deleting tasks by list", err),
    });
  }

  /** Deletes ALL tasks (irreversible!) */
  deleteAllTasks(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`).pipe(
      tap(() => this.tasksSignal.set([])),
      catchError((err) => {
        console.error("Error deleting all tasks", err);
        throw err;
      })
    );
  }

  // ------------------------------------------
  // ATTACHMENTS: FILE UPLOAD / DOWNLOAD / DELETE
  // ------------------------------------------
  /** Uploads a file attachment for a given task */
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

  /** Downloads an attachment file for a given task */
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

  /** Deletes an attachment for a given task */
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
