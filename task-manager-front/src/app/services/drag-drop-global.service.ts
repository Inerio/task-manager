import { Injectable, signal } from "@angular/core";

/**
 * Centralized service for global drag/drop state: task, column, file drag types.
 * Allows any component to check the current drag context.
 */
@Injectable({ providedIn: "root" })
export class DragDropGlobalService {
  /** The type of currently dragged element, or null if none. */
  readonly currentDragType = signal<"task" | "column" | "file" | null>(null);

  /** Details of currently dragged task (if any). */
  readonly currentTaskDrag = signal<{
    taskId: number;
    columnId: number;
  } | null>(null);

  /** Details of currently dragged column (if any). */
  readonly currentColumnDrag = signal<{ columnId: number } | null>(null);

  /** True if files are currently dragged. */
  readonly currentFileDrag = signal<boolean>(false);

  /** Start dragging a task. */
  startTaskDrag(taskId: number, columnId: number): void {
    this.currentDragType.set("task");
    this.currentTaskDrag.set({ taskId, columnId });
    this.currentColumnDrag.set(null);
    this.currentFileDrag.set(false);
  }

  /** Start dragging a column. */
  startColumnDrag(columnId: number): void {
    this.currentDragType.set("column");
    this.currentColumnDrag.set({ columnId });
    this.currentTaskDrag.set(null);
    this.currentFileDrag.set(false);
  }

  /** Start dragging files (attachments). */
  startFileDrag(): void {
    this.currentDragType.set("file");
    this.currentFileDrag.set(true);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
  }

  /** Reset all drag/drop state (call on dragend). */
  endDrag(): void {
    this.currentDragType.set(null);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
    this.currentFileDrag.set(false);
  }

  /** Utility: are we currently dragging a task? */
  isTaskDrag(): boolean {
    return this.currentDragType() === "task" && !!this.currentTaskDrag();
  }

  /** Utility: are we currently dragging a column? */
  isColumnDrag(): boolean {
    return this.currentDragType() === "column" && !!this.currentColumnDrag();
  }

  /** Utility: are we currently dragging files? */
  isFileDrag(): boolean {
    return this.currentDragType() === "file" && this.currentFileDrag();
  }
}
