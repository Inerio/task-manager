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
import { environment } from "../../../../environments/environment";
import { type Task, type TaskId } from "../models/task.model";
import { AlertService } from "../../../core/services/alert.service";
import { LoadingService } from "../../../core/services/loading.service";

/** Tasks CRUD + reordering. Signals are the single source of truth. */
@Injectable({ providedIn: "root" })
export class TaskService {
  // ---- deps & config ----
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tasks`;
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);
  private readonly loading = inject(LoadingService);

  // ---- state ----
  private readonly tasksSignal: WritableSignal<Task[]> = signal([]);
  /** Read-only signal consumed by components. */
  readonly tasks: Signal<Task[]> = computed(() => this.tasksSignal());

  /** Load barrier to avoid repeated refetches. */
  private readonly _loaded = signal(false);
  readonly loaded = computed(() => this._loaded());

  // ===========================================================================

  // === Fetch ===

  /**
   * Load all tasks (overlay scope: "board").
   * Pass `{ force: true }` to bypass the "already loaded" guard.
   */
  loadTasks(options?: { force?: boolean }): void {
    if (!options?.force && this._loaded()) return;

    this.loading.wrap$(this.http.get<Task[]>(this.apiUrl), "board").subscribe({
      next: (data) => {
        this.tasksSignal.set(data ?? []);
        this._loaded.set(true);
      },
      error: () =>
        this.alert.show("error", this.i18n.translate("errors.loadingTasks")),
    });
  }

  /** Derived signal containing only tasks for a given kanban column. */
  getTasksByKanbanColumnId(kanbanColumnId: number): Signal<Task[]> {
    return computed(() =>
      this.tasksSignal().filter((t) => t.kanbanColumnId === kanbanColumnId)
    );
  }

  /** Fetch a task by id (null on error). */
  async fetchTaskById(taskId: TaskId): Promise<Task | null> {
    try {
      return await firstValueFrom(
        this.http.get<Task>(`${this.apiUrl}/${taskId}`)
      );
    } catch {
      return null;
    }
  }

  /** Refetch a task and update local state. */
  async refreshTaskById(taskId: TaskId): Promise<void> {
    const fresh = await this.fetchTaskById(taskId);
    if (fresh) this.updateTaskFromApi(fresh);
  }

  // === Create & Update ===

  /** Create a task; updates local state on success. */
  async createTask(task: Task): Promise<Task> {
    try {
      const created = await firstValueFrom(
        this.http.post<Task>(this.apiUrl, task)
      );
      this.tasksSignal.set([...this.tasksSignal(), created]);
      return created;
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.creatingTask"));
      throw err;
    }
  }

  /** Update a task; replaces it in local state on success. */
  async updateTask(id: TaskId, updatedTask: Task): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.http.put<Task>(`${this.apiUrl}/${id}`, updatedTask)
      );
      this.replaceInState(updated);
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.updatingTask"));
      throw err;
    }
  }

  /** Replace a task in state from an API-returned payload. */
  updateTaskFromApi(updated: Task): void {
    this.replaceInState(updated);
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
      this.loadTasks({ force: true });
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

  /**
   * Optimistically reorder a subset of tasks and sync with backend.
   * Accepts a readonly array to prevent accidental mutation by callers.
   */
  async reorderTasks(tasks: ReadonlyArray<Task>): Promise<void> {
    const updatedIds = new Set(tasks.map((t) => t.id));
    const nextState = [
      ...this.tasksSignal().filter((t) => !updatedIds.has(t.id)),
      ...tasks,
    ].sort((a, b) =>
      a.kanbanColumnId !== b.kanbanColumnId
        ? a.kanbanColumnId - b.kanbanColumnId
        : (a.position ?? 0) - (b.position ?? 0)
    );

    this.tasksSignal.set(nextState);

    // Guard: only send persisted ids to the backend.
    const dto = tasks
      .filter((t): t is Task & { id: number } => typeof t.id === "number")
      .map((t) => ({ id: t.id, position: t.position ?? 0 }));

    try {
      await firstValueFrom(this.http.put<void>(`${this.apiUrl}/reorder`, dto));
    } catch (err) {
      this.alert.show("error", this.i18n.translate("errors.reorderingTasks"));
      throw err;
    }
  }

  /**
   * Optimistic cross-column move + reorder.
   * - Immediately updates local `tasksSignal` (UI feels instant).
   * - Persists `kanbanColumnId` change and new positions in parallel.
   * - Rolls back on failure.
   */
  async moveTaskOptimistic(
    taskId: TaskId,
    toColumnId: number,
    targetIndex: number
  ): Promise<void> {
    const current = this.tasksSignal();
    const dragged = current.find((t) => t.id === taskId);
    if (!dragged) return;

    const fromColumnId = dragged.kanbanColumnId;

    // Same-column: delegate to reorder (already optimistic).
    if (fromColumnId === toColumnId) {
      const inCol = current.filter((t) => t.kanbanColumnId === fromColumnId);
      const fromIdx = inCol.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;
      const copy = inCol.slice();
      copy.splice(fromIdx, 1);
      const insertAt = Math.max(0, Math.min(targetIndex, copy.length));
      copy.splice(insertAt, 0, dragged);
      const reordered = copy.map((t, idx) => ({ ...t, position: idx }));
      await this.reorderTasks(reordered);
      return;
    }
    const snapshot: Task[] = current.map((t) => ({ ...t }));

    // Build new source/target arrays with updated positions.
    const source = current.filter(
      (t) => t.kanbanColumnId === fromColumnId && t.id !== taskId
    );
    const targetBase = current.filter((t) => t.kanbanColumnId === toColumnId);

    const insertAt = Math.max(0, Math.min(targetIndex, targetBase.length));
    const moved: Task = { ...dragged, kanbanColumnId: toColumnId };

    const targetAfter = targetBase.slice();
    targetAfter.splice(insertAt, 0, moved);

    const updatedMap = new Map<number, Task>();
    source.forEach((t, idx) => updatedMap.set(t.id!, { ...t, position: idx }));
    targetAfter.forEach((t, idx) =>
      updatedMap.set(t.id!, { ...t, position: idx })
    );

    // Apply optimistic state.
    const next = current.map((t) => {
      const upd = t.id != null ? updatedMap.get(t.id) : undefined;
      return upd ? upd : t;
    });
    this.tasksSignal.set(next);

    // Persist concurrently:
    // - update kanbanColumnId of the moved task
    // - reorder all affected tasks (both columns)
    const reorderDto = Array.from(updatedMap.values())
      .filter((t): t is Task & { id: number } => typeof t.id === "number")
      .map((t) => ({ id: t.id, position: t.position ?? 0 }));

    try {
      await Promise.all([
        firstValueFrom(
          this.http.put<Task>(`${this.apiUrl}/${taskId}`, {
            ...dragged,
            kanbanColumnId: toColumnId,
          } as Task)
        ),
        firstValueFrom(
          this.http.put<void>(`${this.apiUrl}/reorder`, reorderDto)
        ),
      ]);
    } catch (err) {
      // Rollback visual state if server rejects.
      this.tasksSignal.set(snapshot);
      this.alert.show(
        "error",
        this.i18n.translate("errors.movingTask") || "Failed to move task"
      );
      throw err;
    }
  }

  // === Private helpers ===

  /** Replace by id in local state; no-op if not found. */
  private replaceInState(updated: Task): void {
    this.tasksSignal.set(
      this.tasksSignal().map((t) => (t.id === updated.id ? updated : t))
    );
  }
}
