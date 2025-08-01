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

@Injectable({ providedIn: "root" })
export class TaskService {
  // === API & State Signals ===
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlTasks;
  private readonly alertService = inject(AlertService);

  // Holds all tasks loaded from backend (single source of truth)
  private readonly tasksSignal: WritableSignal<Task[]> = signal([]);
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // === Tasks: Fetch ===

  /** Loads all tasks from the backend and updates the signal. */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: () => {
        this.alertService.show("error", "Error loading tasks.");
      },
    });
  }

  /** Returns a reactive signal with tasks for a given kanban column. */
  getTasksByKanbanColumnId(kanbanColumnId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter(
        (task) => task.kanbanColumnId === kanbanColumnId
      )
    );
  }

  // === Tasks: Create & Update ===

  /** Creates a new task and adds it to the state. */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: () => {
        this.alertService.show("error", "Error creating task.");
      },
    });
  }

  /** Updates an existing task by id (returns a Promise for async chain). */
  updateTask(id: number, updatedTask: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask).subscribe({
        next: (updated) => {
          const tasks = this.tasksSignal().map((t) =>
            t.id === id ? updated : t
          );
          this.tasksSignal.set(tasks);
          resolve();
        },
        error: (err) => {
          this.alertService.show("error", "Error updating task.");
          reject(err);
        },
      });
    });
  }

  /** Directly update the state with a Task returned from API (used for attachment upload/delete). */
  updateTaskFromApi(updated: Task): void {
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === updated.id ? updated : t))
    );
  }

  // === Tasks: Delete ===

  /** Deletes a single task by id. */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
      },
      error: () => {
        this.alertService.show("error", "Error deleting task.");
      },
    });
  }

  /** Deletes all tasks for a specific kanban column (by column id). */
  deleteTasksByKanbanColumnId(kanbanColumnId: number): void {
    this.http
      .delete<void>(`${this.apiUrl}/kanbanColumn/${kanbanColumnId}`)
      .subscribe({
        next: () => {
          this.tasksSignal.set(
            this.tasksSignal().filter(
              (t) => t.kanbanColumnId !== kanbanColumnId
            )
          );
        },
        error: () => {
          this.alertService.show("error", "Error deleting tasks in column.");
        },
      });
  }

  /** Deletes all tasks for a given board (across all its columns). */
  deleteAllTasksByBoardId(boardId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/board/${boardId}`).pipe(
      tap(() => {
        this.loadTasks();
      }),
      catchError((err) => {
        this.alertService.show("error", "Error deleting all tasks for board.");
        throw err;
      })
    );
  }

  /** Deletes all tasks. */
  deleteAllTasks(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`).pipe(
      tap(() => this.tasksSignal.set([])),
      catchError((err) => {
        this.alertService.show("error", "Error deleting all tasks.");
        throw err;
      })
    );
  }

  // === Tasks: Reorder ===

  /**
   * Reorders tasks in a column (or after moving).
   * Updates local state for immediate effect, then synchronizes with backend.
   */
  reorderTasks(tasks: Task[]): void {
    const updatedIds = new Set(tasks.map((t) => t.id));
    const nextState = [
      ...this.tasksSignal().filter((t) => !updatedIds.has(t.id)),
      ...tasks,
    ].sort((a, b) => {
      if (a.kanbanColumnId !== b.kanbanColumnId)
        return (a.kanbanColumnId ?? 0) - (b.kanbanColumnId ?? 0);
      return (a.position ?? 0) - (b.position ?? 0);
    });

    this.tasksSignal.set(nextState);

    const reorderDto = tasks.map((t) => ({
      id: t.id,
      position: t.position,
    }));

    this.http.put<void>(`${this.apiUrl}/reorder`, reorderDto).subscribe({
      error: () => this.alertService.show("error", "Error reordering tasks."),
    });
  }
}
