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
  /* ==== API & STATE SIGNALS ==== */
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlTasks;
  private readonly alertService = inject(AlertService);

  // Holds all tasks loaded from backend (single source of truth)
  private readonly tasksSignal: WritableSignal<Task[]> = signal([]);
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  /* ==== TASKS: READ / FETCH ==== */

  /** Loads all tasks from the backend and updates the signal. */
  loadTasks(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: (err) => {
        this.alertService.show("error", "Error loading tasks.");
      },
    });
  }

  /** Returns a reactive signal with tasks for a given kanbanColumn. */
  getTasksByKanbanColumnId(kanbanColumnId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter(
        (task) => task.kanbanColumnId === kanbanColumnId
      )
    );
  }

  /* ==== TASKS: CREATE & UPDATE ==== */

  /** Creates a new task and adds it to the state. */
  createTask(task: Task): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (newTask) => this.tasksSignal.set([...this.tasksSignal(), newTask]),
      error: (err) => {
        this.alertService.show("error", "Error creating task.");
      },
    });
  }

  /** Updates an existing task by id. */
  updateTask(id: number, updatedTask: Task): void {
    this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask).subscribe({
      next: (updated) => {
        const tasks = this.tasksSignal().map((t) =>
          t.id === id ? updated : t
        );
        this.tasksSignal.set(tasks);
      },
      error: (err) => {
        this.alertService.show("error", "Error updating task.");
      },
    });
  }

  /** Directly update the state with a Task returned from API (used for attachment upload/delete) */
  updateTaskFromApi(updated: Task): void {
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === updated.id ? updated : t))
    );
  }

  /* ==== TASKS: DELETE ==== */

  /** Deletes a single task by id. */
  deleteTask(id: number): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
      },
      error: (err) => {
        this.alertService.show("error", "Error deleting task.");
      },
    });
  }

  /** Deletes all tasks for a specific kanbanColumn (by column id). */
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
        error: (err) => {
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
}
