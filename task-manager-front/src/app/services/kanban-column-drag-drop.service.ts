import { Injectable, signal, computed } from "@angular/core";
import { KanbanColumnService } from "./kanban-column.service";
import { setColumnDragData, isColumnDragEvent } from "../utils/drag-drop-utils";

@Injectable({ providedIn: "root" })
export class ColumnDragDropService {
  // Etat du DnD colonne
  readonly draggedKanbanColumnId = signal<number | null>(null);
  readonly dragOverIndex = signal<number | null>(null);

  constructor(private kanbanColumnService: KanbanColumnService) {}

  // DnD Handlers

  onColumnDragStart(kanbanColumnId: number, idx: number, event: DragEvent) {
    this.draggedKanbanColumnId.set(kanbanColumnId);
    this.dragOverIndex.set(idx);
    setColumnDragData(event, kanbanColumnId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  onColumnDragEnter(idx: number, event: DragEvent) {
    event.preventDefault();
    if (this.draggedKanbanColumnId() !== null) {
      this.dragOverIndex.set(idx);
    }
  }

  onColumnDragOver(idx: number, event: DragEvent) {
    event.preventDefault();
    if (this.draggedKanbanColumnId() !== null) {
      this.dragOverIndex.set(idx);
    }
  }

  // Correction : ajoute boardId en paramètre !
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
    // Met à jour l'ordre local
    const kanbanColumnsRaw = this.kanbanColumnService.kanbanColumns();
    const currIdx = kanbanColumnsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === targetIdx) {
      this.resetDragState();
      return;
    }
    // Appel API pour déplacer
    this.kanbanColumnService
      .moveKanbanColumn(boardId, draggedId, targetIdx)
      .subscribe({
        next: () => {
          this.kanbanColumnService.loadKanbanColumns(boardId); // Charge les colonnes du bon board !
          this.resetDragState();
          afterDrop?.();
        },
        error: (err) => {
          console.error("Move error:", err);
          this.resetDragState();
        },
      });
  }

  onColumnDragEnd() {
    this.resetDragState();
  }

  resetDragState() {
    this.draggedKanbanColumnId.set(null);
    this.dragOverIndex.set(null);
  }
}
