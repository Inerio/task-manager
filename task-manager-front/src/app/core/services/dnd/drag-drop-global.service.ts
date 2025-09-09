import {
  Injectable,
  signal,
  computed,
  type WritableSignal,
} from "@angular/core";

/** Drag kind handled by the global service. */
export type DragType = "task" | "column" | "board" | "file" | null;

/** Minimal contexts carried during a drag operation. */
export interface TaskDragCtx {
  taskId: number;
  columnId: number;
}
export interface ColumnDragCtx {
  columnId: number;
}
export interface BoardDragCtx {
  boardId: number;
}

/**
 * Global drag/drop context shared across components.
 * Keeps only the minimal state needed for rendering + drop logic.
 */
@Injectable({ providedIn: "root" })
export class DragDropGlobalService {
  // ---- Current drag kind ----
  readonly currentDragType = signal<DragType>(null);

  // ---- Contexts for each drag kind ----
  readonly currentTaskDrag = signal<TaskDragCtx | null>(null);
  readonly currentColumnDrag = signal<ColumnDragCtx | null>(null);
  readonly currentBoardDrag = signal<BoardDragCtx | null>(null);
  readonly currentFileDrag = signal<boolean>(false);

  // ---- Task preview sizing (used by column placeholders) ----
  readonly taskDragPreviewSize = signal<{
    readonly width: number;
    readonly height: number;
  } | null>(null);

  // ---- Live "which column is hovered" during task drag (single owner) ----
  readonly hoveredTaskColumnId = signal<number | null>(null);

  // ---- One-shot “pulse” markers (used for small UI glow feedback) ----
  readonly lastDroppedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastDroppedColumn = signal<{ id: number; token: number } | null>(
    null
  );
  readonly lastCreatedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastSavedTask = signal<{ id: number; token: number } | null>(null);

  // ---- Derived state ----
  readonly isDragging = computed(() => this.currentDragType() !== null);

  constructor() {
    // Flush any stale pulses on bootstrap (defensive).
    setTimeout(() => this.flushPulses(), 0);
  }

  // ===========================================================================

  // === Drag type control ===
  startTaskDrag(taskId: number, columnId: number): void {
    this.resetDrag();
    this.currentDragType.set("task");
    this.currentTaskDrag.set({ taskId, columnId });
  }

  startColumnDrag(columnId: number): void {
    this.resetDrag();
    this.currentDragType.set("column");
    this.currentColumnDrag.set({ columnId });
  }

  startBoardDrag(boardId: number): void {
    this.resetDrag();
    this.currentDragType.set("board");
    this.currentBoardDrag.set({ boardId });
  }

  startFileDrag(): void {
    this.resetDrag();
    this.currentDragType.set("file");
    this.currentFileDrag.set(true);
  }

  /** Clear all drag state and preview sizing. */
  endDrag(): void {
    this.resetDrag();
    this.clearDragPreviewSize();
    this.hoveredTaskColumnId.set(null);
  }

  // Convenience guards (used by components)
  isTaskDrag(): boolean {
    return this.currentDragType() === "task" && !!this.currentTaskDrag();
  }
  isColumnDrag(): boolean {
    return this.currentDragType() === "column" && !!this.currentColumnDrag();
  }
  isBoardDrag(): boolean {
    return this.currentDragType() === "board" && !!this.currentBoardDrag();
  }
  isFileDrag(): boolean {
    return this.currentDragType() === "file" && this.currentFileDrag();
  }

  // === Drag preview sizing ===
  /** Set the visual size of the dragged task to size placeholders accurately. */
  setDragPreviewSize(width: number, height: number): void {
    this.taskDragPreviewSize.set({ width, height });
  }
  /** Clear stored preview size (on drag end). */
  clearDragPreviewSize(): void {
    this.taskDragPreviewSize.set(null);
  }

  /** Update which column is currently hovered during a task drag. */
  setTaskHoverColumn(columnId: number | null): void {
    // Only meaningful during a task drag.
    if (!this.isTaskDrag()) return;
    this.hoveredTaskColumnId.set(columnId);
  }

  // === Pulse markers (auto-expire to prevent stale pulses) ===
  markTaskDropped(id: number): void {
    this.setPulse(this.lastDroppedTask, id);
  }

  markColumnDropped(id: number): void {
    this.setPulse(this.lastDroppedColumn, id);
  }

  markTaskCreated(id: number): void {
    this.setPulse(this.lastCreatedTask, id);
  }

  markTaskSaved(id: number): void {
    this.setPulse(this.lastSavedTask, id);
  }

  // ===========================================================================

  /** Reset all drag-related contexts and type. */
  private resetDrag(): void {
    this.currentDragType.set(null);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
    this.currentBoardDrag.set(null);
    this.currentFileDrag.set(false);
  }

  /** Clear any lingering pulse markers. */
  private flushPulses(): void {
    this.lastDroppedTask.set(null);
    this.lastDroppedColumn.set(null);
    this.lastCreatedTask.set(null);
    this.lastSavedTask.set(null);
  }

  /** Set a pulse value that auto-expires; prevents code duplication. */
  private setPulse(
    sig: WritableSignal<{ id: number; token: number } | null>,
    id: number,
    ttlMs = 1500
  ): void {
    const token = Date.now();
    sig.set({ id, token });

    // Auto-expire only if nobody overwrote the same signal in the meantime.
    setTimeout(() => {
      const cur = sig();
      if (cur && cur.id === id && cur.token === token) {
        sig.set(null);
      }
    }, ttlMs);
  }
}
