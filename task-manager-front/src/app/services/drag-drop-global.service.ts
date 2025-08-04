import { Injectable, signal } from "@angular/core";

/**
 * DragDropGlobalService: Centralizes drag state for tasks, columns, and files.
 * Allows any component to reliably detect current drag context and type.
 */
@Injectable({ providedIn: "root" })
export class DragDropGlobalService {
  /** Type of the currently dragged element: "task" | "column" | "file" | null */
  readonly currentDragType = signal<"task" | "column" | "file" | null>(null);

  /** State for currently dragged task (if any) */
  readonly currentTaskDrag = signal<{
    taskId: number;
    columnId: number;
  } | null>(null);

  /** State for currently dragged column (if any) */
  readonly currentColumnDrag = signal<{ columnId: number } | null>(null);

  /** Whether files are being dragged (we don't need their details) */
  readonly currentFileDrag = signal<boolean>(false);

  /** Call when starting to drag a task */
  startTaskDrag(taskId: number, columnId: number): void {
    this.currentDragType.set("task");
    this.currentTaskDrag.set({ taskId, columnId });
    this.currentColumnDrag.set(null);
    this.currentFileDrag.set(false);
  }

  /** Call when starting to drag a column */
  startColumnDrag(columnId: number): void {
    this.currentDragType.set("column");
    this.currentColumnDrag.set({ columnId });
    this.currentTaskDrag.set(null);
    this.currentFileDrag.set(false);
  }

  /** Call when starting to drag files (for attachments) */
  startFileDrag(): void {
    this.currentDragType.set("file");
    this.currentFileDrag.set(true);
    this.currentTaskDrag.set(null);
    this.currentColumnDrag.set(null);
  }

  /** Reset all drag state (call on dragend) */
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
