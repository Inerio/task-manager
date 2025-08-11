import { Injectable, signal } from "@angular/core";

/**
 * Global drag/drop context shared across components.
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

  /** Last dropped elements (used to trigger a visual pulse). */
  readonly lastDroppedTask = signal<{ id: number; token: number } | null>(null);
  readonly lastDroppedColumn = signal<{ id: number; token: number } | null>(
    null
  );

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

  /** Markers to trigger a pulse on the dropped element. */
  markTaskDropped(id: number): void {
    this.lastDroppedTask.set({ id, token: Date.now() });
  }
  markColumnDropped(id: number): void {
    this.lastDroppedColumn.set({ id, token: Date.now() });
  }
}
