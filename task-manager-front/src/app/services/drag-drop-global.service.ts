import { Injectable, signal } from "@angular/core";

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
    width: number;
    height: number;
  } | null>(null);

  // ---- One-shot “pulse” markers (used for small UI glow feedback) ----
  readonly lastDroppedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastDroppedColumn = signal<{ id: number; token: number } | null>(
    null
  );
  readonly lastCreatedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastSavedTask = signal<{ id: number; token: number } | null>(null);

  constructor() {
    // Flush any stale pulses on bootstrap (defensive).
    setTimeout(() => {
      this.lastDroppedTask.set(null);
      this.lastDroppedColumn.set(null);
      this.lastCreatedTask.set(null);
      this.lastSavedTask.set(null);
    }, 0);
  }

  // ===========================================================================

  // === Drag type control ===
  startTaskDrag(taskId: number, columnId: number): void {
    this.currentDragType.set("task");
    this.currentTaskDrag.set({ taskId, columnId });
    this.currentColumnDrag.set(null);
    this.currentBoardDrag.set(null);
    this.currentFileDrag.set(false);
  }

  startColumnDrag(columnId: number): void {
    this.currentDragType.set("column");
    this.currentColumnDrag.set({ columnId });
    this.currentTaskDrag.set(null);
    this.currentBoardDrag.set(null);
    this.currentFileDrag.set(false);
  }

  startBoardDrag(boardId: number): void {
    this.currentDragType.set("board");
    this.currentBoardDrag.set({ boardId });
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
    this.currentFileDrag.set(false);
  }

  startFileDrag(): void {
    this.currentDragType.set("file");
    this.currentFileDrag.set(true);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
    this.currentBoardDrag.set(null);
  }

  /** Clear all drag state and preview sizing. */
  endDrag(): void {
    this.currentDragType.set(null);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
    this.currentBoardDrag.set(null);
    this.currentFileDrag.set(false);
    this.clearDragPreviewSize();
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

  // === Pulse markers (auto-expire to prevent stale pulses) ===
  markTaskDropped(id: number): void {
    const token = Date.now();
    this.lastDroppedTask.set({ id, token });
    setTimeout(() => {
      const cur = this.lastDroppedTask();
      if (cur && cur.id === id && cur.token === token)
        this.lastDroppedTask.set(null);
    }, 1500);
  }

  markColumnDropped(id: number): void {
    const token = Date.now();
    this.lastDroppedColumn.set({ id, token });
    setTimeout(() => {
      const cur = this.lastDroppedColumn();
      if (cur && cur.id === id && cur.token === token)
        this.lastDroppedColumn.set(null);
    }, 1500);
  }

  markTaskCreated(id: number): void {
    const token = Date.now();
    this.lastCreatedTask.set({ id, token });
    setTimeout(() => {
      const cur = this.lastCreatedTask();
      if (cur && cur.id === id && cur.token === token)
        this.lastCreatedTask.set(null);
    }, 1500);
  }

  markTaskSaved(id: number): void {
    const token = Date.now();
    this.lastSavedTask.set({ id, token });
    setTimeout(() => {
      const cur = this.lastSavedTask();
      if (cur && cur.id === id && cur.token === token)
        this.lastSavedTask.set(null);
    }, 1500);
  }
}
