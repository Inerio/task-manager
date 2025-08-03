import { Injectable, signal, inject } from "@angular/core";
import { KanbanColumnService } from "./kanban-column.service";
import { setColumnDragData, isColumnDragEvent } from "../utils/drag-drop-utils";
import { AlertService } from "./alert.service";

/* ==== COLUMN DRAG & DROP SERVICE ==== */
@Injectable({ providedIn: "root" })
export class ColumnDragDropService {
  // Currently dragged column id, or null if none.
  readonly draggedKanbanColumnId = signal<number | null>(null);
  // Index currently hovered during drag, or null if none.
  readonly dragOverIndex = signal<number | null>(null);

  // Modern Angular injection
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly alert = inject(AlertService);

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
   * Instantly reorders UI for smooth experience.
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

    // Optimistic update: instant UI reorder before backend call
    const newArr = [...kanbanColumnsRaw];
    const [draggedColumn] = newArr.splice(currIdx, 1);
    newArr.splice(targetIdx, 0, draggedColumn);
    this.kanbanColumnService.reorderKanbanColumns(newArr);

    // Sync backend after
    this.kanbanColumnService
      .moveKanbanColumn(boardId, draggedId, targetIdx)
      .subscribe({
        next: () => {
          this.kanbanColumnService.loadKanbanColumns(boardId);
          this.resetDragState();
          afterDrop?.();
        },
        error: (err) => {
          this.alert.show("error", "Move error: Could not move column.");
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
