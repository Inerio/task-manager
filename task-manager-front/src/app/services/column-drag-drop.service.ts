import { Injectable, signal, computed } from "@angular/core";
import { TaskListService } from "./task-list.service";
import {
  setColumnDragData,
  getColumnDragData,
  isColumnDragEvent,
} from "../utils/drag-drop-utils";

@Injectable({ providedIn: "root" })
export class ColumnDragDropService {
  // Etat du DnD colonne
  readonly draggedListId = signal<number | null>(null);
  readonly dragOverIndex = signal<number | null>(null);

  constructor(private taskListService: TaskListService) {}

  // DnD Handlers

  onColumnDragStart(listId: number, idx: number, event: DragEvent) {
    this.draggedListId.set(listId);
    this.dragOverIndex.set(idx);
    setColumnDragData(event, listId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  onColumnDragEnter(idx: number, event: DragEvent) {
    if (!isColumnDragEvent(event)) return;
    event.preventDefault();
    if (this.draggedListId() !== null) {
      this.dragOverIndex.set(idx);
    }
  }

  onColumnDragOver(idx: number, event: DragEvent) {
    if (!isColumnDragEvent(event)) return;
    event.preventDefault();
    if (this.draggedListId() !== null) {
      this.dragOverIndex.set(idx);
    }
  }

  onColumnDrop(event: DragEvent, afterDrop?: () => void) {
    if (!isColumnDragEvent(event)) {
      this.resetDragState();
      return;
    }
    event.preventDefault();
    const draggedId = this.draggedListId();
    const targetIdx = this.dragOverIndex();
    if (draggedId == null || targetIdx == null) {
      this.resetDragState();
      return;
    }
    // Met à jour l'ordre local
    const listsRaw = this.taskListService.lists();
    const currIdx = listsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === targetIdx) {
      this.resetDragState();
      return;
    }
    // Appel API pour déplacer
    this.taskListService.moveList(draggedId, targetIdx).subscribe({
      next: () => {
        this.taskListService.loadLists();
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
    this.draggedListId.set(null);
    this.dragOverIndex.set(null);
  }
}
