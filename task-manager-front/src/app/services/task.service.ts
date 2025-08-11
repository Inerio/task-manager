import { HttpClient } from "@angular/common/http";
import {
  computed,
  inject,
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";
import { firstValueFrom } from "rxjs";
import { environment } from "../../environments/environment.local";
import { type Task, type TaskId } from "../models/task.model";
import { AlertService } from "./alert.service";
import { LoadingService } from "./loading.service";

/** Tasks CRUD + reordering with signals as the single source of truth. */
@Injectable({ providedIn: "root" })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/tasks";
  private readonly alert = inject(AlertService);
  private readonly loading = inject(LoadingService);
  private readonly i18n = inject(TranslocoService);

  /** All tasks loaded from backend (SSOT). */
  private readonly tasksSignal: WritableSignal<Task[]> = signal([]);
  /** Readonly tasks signal for consumers. */
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  // === Fetch ===

  /** Load all tasks. Shown under the global loading overlay. */
  loadTasks(): void {
    this.loading.wrap$(this.http.get<Task[]>(this.apiUrl)).subscribe({
      next: (data) => this.tasksSignal.set(data ?? []),
      error: () =>
        this.alert.show("error", this.i18n.translate("errors.loadingTasks")),
    });
  }

  /** Derived signal of a column's tasks. */
  getTasksByKanbanColumnId(kanbanColumnId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter((t) => t.kanbanColumnId === kanbanColumnId)
    );
  }

  async fetchTaskById(taskId: TaskId): Promise<Task | null> {
    try {
      return await firstValueFrom(
        this.http.get<Task>(`${this.apiUrl}/${taskId}`)
      );
    } catch {
      return null;
    }
  }

  async refreshTaskById(taskId: TaskId): Promise<void> {
    const fresh = await this.fetchTaskById(taskId);
    if (fresh) this.updateTaskFromApi(fresh);
  }

  // === Create & Update ===

  /** Create a task; updates state on success. */
  async createTask(task: Task): Promise<Task> {
    try {
      const newTask = await firstValueFrom(
        this.http.post<Task>(this.apiUrl, task)
      );
      this.tasksSignal.set([...this.tasksSignal(), newTask]);
      return newTask;
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.creatingTask"));
      throw err;
    }
  }

  /** Update a task; updates state on success. */
  async updateTask(id: TaskId, updatedTask: Task): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask)
      );
      this.tasksSignal.set(
        this.tasksSignal().map((t) => (t.id === id ? updated : t))
      );
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.updatingTask"));
      throw err;
    }
  }

  /** Replace a task in state from an API-returned payload. */
  updateTaskFromApi(updated: Task): void {
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === updated.id ? updated : t))
    );
  }

  // === Delete ===

  async deleteTask(id: TaskId): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
      this.tasksSignal.set(this.tasksSignal().filter((t) => t.id !== id));
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.deletingTask"));
      throw err;
    }
  }

  async deleteTasksByKanbanColumnId(kanbanColumnId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<void>(`${this.apiUrl}/kanbanColumn/${kanbanColumnId}`)
      );
      this.tasksSignal.set(
        this.tasksSignal().filter((t) => t.kanbanColumnId !== kanbanColumnId)
      );
    } catch (err) {
      this.alert.show(
        "error",
        this.i18n.translate("errors.deletingTasksInColumn")
      );
      throw err;
    }
  }

  async deleteAllTasksByBoardId(boardId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<void>(`${this.apiUrl}/board/${boardId}`)
      );
      this.loadTasks();
    } catch (err) {
      this.alert.show(
        "error",
        this.i18n.translate("errors.deletingAllTasksForBoard")
      );
      throw err;
    }
  }

  async deleteAllTasks(): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/all`));
      this.tasksSignal.set([]);
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.deletingTask"));
      throw err;
    }
  }

  // === Reorder ===

  /** Optimistically reorder a subset of tasks and sync with backend. */
  async reorderTasks(tasks: Task[]): Promise<void> {
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

    const dto = tasks.map((t) => ({ id: t.id, position: t.position }));

    try {
      await firstValueFrom(this.http.put<void>(`${this.apiUrl}/reorder`, dto));
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.reorderingTasks"));
      throw err;
    }
  }
}
