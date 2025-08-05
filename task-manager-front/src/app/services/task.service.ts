import { HttpClient } from "@angular/common/http";
import {
  computed,
  inject,
  Injectable,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";
import { catchError, Observable, tap } from "rxjs";
import { environment } from "../../environments/environment.local";
import { Task } from "../models/task.model";
import { AlertService } from "./alert.service";

/** Service for managing tasks (CRUD, reorder, signals). */
@Injectable({ providedIn: "root" })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/tasks";
  private readonly alertService = inject(AlertService);

  /** Reactive signal: All tasks loaded from backend (single source of truth). */
  private readonly tasksSignal: WritableSignal<Task[]> = signal([]);
  /** Public, readonly signal for tasks. */
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // === Fetch ===

  /** Loads all tasks from backend. */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: () => this.alertService.show("error", "Error loading tasks."),
    });
  }

  /** Reactive signal of tasks for a given column. */
  getTasksByKanbanColumnId(kanbanColumnId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter(
        (task) => task.kanbanColumnId === kanbanColumnId
      )
    );
  }

  // === Create & Update ===

  /** Creates a new task (pushes to signal on success). */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: () => this.alertService.show("error", "Error creating task."),
    });
  }

  /**
   * Updates a task by id (returns Promise for chaining).
   * If you don't need a Promise, use updateTaskFromApi after API call.
   */
  updateTask(id: number, updatedTask: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask).subscribe({
        next: (updated) => {
          this.tasksSignal.set(
            this.tasksSignal().map((t) => (t.id === id ? updated : t))
          );
          resolve();
        },
        error: (err) => {
          this.alertService.show("error", "Error updating task.");
          reject(err);
        },
      });
    });
  }

  /** Updates a task in the signal (for API returns: attachment upload/delete, etc). */
  updateTaskFromApi(updated: Task): void {
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === updated.id ? updated : t))
    );
  }

  // === Delete ===

  /** Deletes a task by id. */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () =>
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id)),
      error: () => this.alertService.show("error", "Error deleting task."),
    });
  }

  /** Deletes all tasks in a given column. */
  deleteTasksByKanbanColumnId(kanbanColumnId: number): void {
    this.http
      .delete<void>(`${this.apiUrl}/kanbanColumn/${kanbanColumnId}`)
      .subscribe({
        next: () =>
          this.tasksSignal.set(
            this.tasksSignal().filter(
              (t) => t.kanbanColumnId !== kanbanColumnId
            )
          ),
        error: () =>
          this.alertService.show("error", "Error deleting tasks in column."),
      });
  }

  /** Deletes all tasks for a board (across all its columns). */
  deleteAllTasksByBoardId(boardId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/board/${boardId}`).pipe(
      tap(() => this.loadTasks()),
      catchError((err) => {
        this.alertService.show("error", "Error deleting all tasks for board.");
        throw err;
      })
    );
  }

  /** Deletes all tasks in the workspace. */
  deleteAllTasks(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`).pipe(
      tap(() => this.tasksSignal.set([])),
      catchError((err) => {
        this.alertService.show("error", "Error deleting all tasks.");
        throw err;
      })
    );
  }

  // === Reorder ===

  /**
   * Reorders given tasks in the signal, syncs with backend.
   * The local signal is updated optimistically for immediate UI feedback.
   */
  reorderTasks(tasks: Task[]): void {
    const updatedIds = new Set(tasks.map((t) => t.id));
    const nextState = [
      ...this.tasksSignal().filter((t) => !updatedIds.has(t.id)),
      ...tasks,
    ].sort((a, b) =>
      a.kanbanColumnId !== b.kanbanColumnId
        ? (a.kanbanColumnId ?? 0) - (b.kanbanColumnId ?? 0)
        : (a.position ?? 0) - (b.position ?? 0)
    );

    this.tasksSignal.set(nextState);

    // Minimal backend DTO (decoupled from model)
    const reorderDto = tasks.map((t) => ({
      id: t.id,
      position: t.position,
    }));

    this.http.put<void>(`${this.apiUrl}/reorder`, reorderDto).subscribe({
      error: () => this.alertService.show("error", "Error reordering tasks."),
    });
  }
}
