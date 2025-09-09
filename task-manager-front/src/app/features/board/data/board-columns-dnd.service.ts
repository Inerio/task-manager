import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { DragDropGlobalService } from "../../../core/services/dnd/drag-drop-global.service";
import { KanbanColumnService } from "./kanban-column.service";
import { AlertService } from "../../../core/services/alert.service";
import { TranslocoService } from "@jsverse/transloco";
import { KanbanColumnId } from "../models/kanban-column.model";
import {
  isColumnDragEvent,
  setColumnDragData,
} from "../../../shared/utils/drag-drop-utils";
import { BoardColumnsEditService } from "./board-columns-edit.service";

/** Handles DnD state + persistence for columns. Scoped to BoardColumnsComponent via providers[]. */
@Injectable()
export class BoardColumnsDndService {
  private readonly columns = inject(KanbanColumnService);
  private readonly drag = inject(DragDropGlobalService);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);
  private readonly edit = inject(BoardColumnsEditService);

  /** Index currently hovered during drag. */
  readonly dragOverIndex = signal<number | null>(null);

  /** Column id currently dragged (computed from global drag service). */
  readonly draggedKanbanColumnId = computed<KanbanColumnId | null>(
    () => this.drag.currentColumnDrag()?.columnId ?? null
  );

  /** Visual pulse when a column has just been dropped. */
  readonly columnPulseId = signal<number | null>(null);
  private _colPulseTimer: number | null = null;

  constructor() {
    // One-shot pulse on column drop.
    effect(() => {
      const evt = this.drag.lastDroppedColumn();
      if (!evt) return;

      this.columnPulseId.set(evt.id);
      if (this._colPulseTimer != null) clearTimeout(this._colPulseTimer);
      this._colPulseTimer = window.setTimeout(() => {
        this.columnPulseId.set(null);
        this._colPulseTimer = null;
      }, 950);
    });
  }

  onColumnDragStart(id: KanbanColumnId, idx: number, e: DragEvent): void {
    if (this.edit.editingColumn()) return; // lock while editing
    setColumnDragData(e, id);
    this.drag.startColumnDrag(id);
    this.dragOverIndex.set(idx);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  onColumnDragHover(idx: number, e: DragEvent): void {
    if (this.edit.editingColumn()) return;
    if (!this.drag.isColumnDrag()) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    e.preventDefault();
    this.dragOverIndex.set(idx);
  }

  async onColumnDrop(boardId: number | null, e: DragEvent): Promise<void> {
    if (this.edit.editingColumn()) return;

    if (!this.drag.isColumnDrag() && !isColumnDragEvent(e)) {
      this.resetDragState();
      return;
    }
    e.preventDefault();

    const draggedId = this.draggedKanbanColumnId();
    const targetIdx = this.dragOverIndex();
    if (draggedId == null || targetIdx == null || boardId == null) {
      this.resetDragState();
      return;
    }

    const cols = this.columns.kanbanColumns();
    const currIdx = cols.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === targetIdx) {
      this.resetDragState();
      return;
    }

    // Optimistic UI
    const next = [...cols];
    const [draggedColumn] = next.splice(currIdx, 1);
    next.splice(targetIdx, 0, draggedColumn);
    this.columns.reorderKanbanColumns(next);
    this.drag.markColumnDropped(draggedId);

    try {
      await this.columns.moveKanbanColumn(boardId, draggedId, targetIdx);
    } catch {
      this.alert.show("error", this.i18n.translate("errors.movingColumn"));
    } finally {
      this.resetDragState();
    }
  }

  onColumnDragEnd(): void {
    this.resetDragState();
  }

  resetDragState(): void {
    this.drag.endDrag();
    this.dragOverIndex.set(null);
  }
}
