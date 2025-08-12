import { Injectable, signal } from "@angular/core";

/**
 * Global drag/drop context shared across components.
 *
 * Fix: auto-expire "pulse" markers (drop/create/save) to avoid
 * re-triggering animations when boards reload or components remount.
 */
@Injectable({ providedIn: "root" })
export class DragDropGlobalService {
  readonly currentDragType = signal<"task" | "column" | "file" | null>(null);

  readonly currentTaskDrag = signal<{
    taskId: number;
    columnId: number;
  } | null>(null);
  readonly currentColumnDrag = signal<{ columnId: number } | null>(null);
  readonly currentFileDrag = signal<boolean>(false);

  /** Last dropped elements (to trigger a visual pulse). */
  readonly lastDroppedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastDroppedColumn = signal<{ id: number; token: number } | null>(
    null
  );

  /** Pulse on create/save to reuse the same glow animation. */
  readonly lastCreatedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastSavedTask = signal<{ id: number; token: number } | null>(null);

  constructor() {
    // Clear any stale pulses on service init so initial renders don't pulse.
    setTimeout(() => {
      this.lastDroppedTask.set(null);
      this.lastDroppedColumn.set(null);
      this.lastCreatedTask.set(null);
      this.lastSavedTask.set(null);
    }, 0);
  }

  // === Drag type control ===
  startTaskDrag(taskId: number, columnId: number): void {
    this.currentDragType.set("task");
    this.currentTaskDrag.set({ taskId, columnId });
    this.currentColumnDrag.set(null);
    this.currentFileDrag.set(false);
  }

  startColumnDrag(columnId: number): void {
    this.currentDragType.set("column");
    this.currentColumnDrag.set({ columnId });
    this.currentTaskDrag.set(null);
    this.currentFileDrag.set(false);
  }

  startFileDrag(): void {
    this.currentDragType.set("file");
    this.currentFileDrag.set(true);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
  }

  endDrag(): void {
    this.currentDragType.set(null);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
    this.currentFileDrag.set(false);
  }

  isTaskDrag(): boolean {
    return this.currentDragType() === "task" && !!this.currentTaskDrag();
  }
  isColumnDrag(): boolean {
    return this.currentDragType() === "column" && !!this.currentColumnDrag();
  }
  isFileDrag(): boolean {
    return this.currentDragType() === "file" && this.currentFileDrag();
  }

  // === Pulse markers (auto-expire to prevent stale pulses) ===

  /** Markers to trigger a pulse on the dropped task. */
  markTaskDropped(id: number): void {
    const token = Date.now();
    this.lastDroppedTask.set({ id, token });
    // Auto-clear after the animation window so fresh mounts don't re-pulse.
    setTimeout(() => {
      const cur = this.lastDroppedTask();
      if (cur && cur.id === id && cur.token === token) {
        this.lastDroppedTask.set(null);
      }
    }, 1500);
  }

  markColumnDropped(id: number): void {
    const token = Date.now();
    this.lastDroppedColumn.set({ id, token });
    setTimeout(() => {
      const cur = this.lastDroppedColumn();
      if (cur && cur.id === id && cur.token === token) {
        this.lastDroppedColumn.set(null);
      }
    }, 1500);
  }

  /** Pulse helpers for create/save */
  markTaskCreated(id: number): void {
    const token = Date.now();
    this.lastCreatedTask.set({ id, token });
    setTimeout(() => {
      const cur = this.lastCreatedTask();
      if (cur && cur.id === id && cur.token === token) {
        this.lastCreatedTask.set(null);
      }
    }, 1500);
  }

  markTaskSaved(id: number): void {
    const token = Date.now();
    this.lastSavedTask.set({ id, token });
    setTimeout(() => {
      const cur = this.lastSavedTask();
      if (cur && cur.id === id && cur.token === token) {
        this.lastSavedTask.set(null);
      }
    }, 1500);
  }
}
