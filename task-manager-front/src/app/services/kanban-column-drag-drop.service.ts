import { Injectable, signal } from "@angular/core";
import { KanbanColumnService } from "./kanban-column.service";
import { setColumnDragData, isColumnDragEvent } from "../utils/drag-drop-utils";

/* ==== COLUMN DRAG & DROP SERVICE ==== */
@Injectable({ providedIn: "root" })
export class ColumnDragDropService {
  // Currently dragged column id, or null if none.
  readonly draggedKanbanColumnId = signal<number | null>(null);
  // Index currently hovered during drag, or null if none.
  readonly dragOverIndex = signal<number | null>(null);

  constructor(private kanbanColumnService: KanbanColumnService) {}

  /**
   * Called when a column drag starts.
   */
  onColumnDragStart(kanbanColumnId: number, idx: number, event: DragEvent) {
    this.draggedKanbanColumnId.set(kanbanColumnId);
    this.dragOverIndex.set(idx);
    setColumnDragData(event, kanbanColumnId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  /**
   * Called when a column drag enters a new index (target).
   */
  onColumnDragEnter(idx: number, event: DragEvent) {
    event.preventDefault();
    if (this.draggedKanbanColumnId() !== null) {
      this.dragOverIndex.set(idx);
    }
  }

  /**
   * Called repeatedly as a dragged column moves over other columns.
   */
  onColumnDragOver(idx: number, event: DragEvent) {
    event.preventDefault();
    if (this.draggedKanbanColumnId() !== null) {
      this.dragOverIndex.set(idx);
    }
  }

  /**
   * Handles drop event for column DnD.
   * Calls API to move column and refreshes local state.
   */
  onColumnDrop(boardId: number, event: DragEvent, afterDrop?: () => void) {
    if (!isColumnDragEvent(event)) {
      this.resetDragState();
      return;
    }
    event.preventDefault();
    const draggedId = this.draggedKanbanColumnId();
    const targetIdx = this.dragOverIndex();
    if (draggedId == null || targetIdx == null) {
      this.resetDragState();
      return;
    }
    const kanbanColumnsRaw = this.kanbanColumnService.kanbanColumns();
    const currIdx = kanbanColumnsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === targetIdx) {
      this.resetDragState();
      return;
    }
    this.kanbanColumnService
      .moveKanbanColumn(boardId, draggedId, targetIdx)
      .subscribe({
        next: () => {
          this.kanbanColumnService.loadKanbanColumns(boardId);
          this.resetDragState();
          afterDrop?.();
        },
        error: (err) => {
          console.error("Move error:", err);
          this.resetDragState();
        },
      });
  }

  /**
   * Resets the drag state (after drag ends or is cancelled).
   */
  onColumnDragEnd() {
    this.resetDragState();
  }

  /**
   * Clears the current drag and hover state.
   */
  resetDragState() {
    this.draggedKanbanColumnId.set(null);
    this.dragOverIndex.set(null);
  }
}
