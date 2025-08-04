import {
  Component,
  signal,
  computed,
  inject,
  Input,
  effect,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { KanbanColumnComponent } from "../kanban-column/kanban-column.component";
import { KanbanColumnService } from "../../services/kanban-column.service";
import { TaskService } from "../../services/task.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { KanbanColumn } from "../../models/kanban-column.model";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { AlertService } from "../../services/alert.service";
import {
  setColumnDragData,
  isColumnDragEvent,
} from "../../utils/drag-drop-utils";

/**
 * BoardComponent: Top-level Kanban board with columns (drag/drop/order/edit).
 */
@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [CommonModule, KanbanColumnComponent],
})
export class BoardComponent implements OnChanges {
  // === INPUT & STATE ===
  private readonly _boardId = signal<number | null>(null);
  @Input({ required: true }) boardId!: number;

  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly alert = inject(AlertService);

  readonly loading = this.kanbanColumnService.loading;
  addKanbanColumnError = signal<string | null>(null);
  readonly MAX_KANBANCOLUMNS = 5;

  editingTitleId = signal<number | null>(null);
  editingTitleValue = signal("");

  // Column drag state for reordering
  readonly draggedKanbanColumnId = computed(
    () => this.dragDropGlobal.currentColumnDrag()?.columnId ?? null
  );
  readonly dragOverIndex = signal<number | null>(null);

  /**
   * Computes the visible Kanban columns, reordering if dragging is active.
   */
  readonly kanbanColumns = computed(() => {
    const raw = this.kanbanColumnService.kanbanColumns();
    const draggedId = this.draggedKanbanColumnId();
    const overIdx = this.dragOverIndex();
    if (draggedId == null || overIdx == null) return raw;
    const currIdx = raw.findIndex((c) => c.id === draggedId);
    if (currIdx === -1 || currIdx === overIdx) return raw;
    const copy = raw.slice();
    const [dragged] = copy.splice(currIdx, 1);
    copy.splice(overIdx, 0, dragged);
    return copy;
  });

  constructor() {
    // Auto-load columns and tasks on board id change
    effect(() => {
      const id = this._boardId();
      if (id != null) {
        this.kanbanColumnService.loadKanbanColumns(id);
        this.taskService.loadTasks();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }

  // ==== DRAG & DROP (columns) ====

  /**
   * Start dragging a column. Triggers on dragstart of column container.
   */
  onColumnDragStart(id: number, idx: number, e: DragEvent) {
    if (this.editingTitleId()) return;
    setColumnDragData(e, id);
    this.dragDropGlobal.startColumnDrag(id);
    this.dragOverIndex.set(idx);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  /**
   * Triggered on dragenter for columns. Updates visual position for drop preview.
   */
  onColumnDragEnter(idx: number, e: DragEvent) {
    e.preventDefault();
    if (this.editingTitleId()) return;
    if (this.dragDropGlobal.isColumnDrag()) {
      this.dragOverIndex.set(idx);
    }
  }

  onColumnDragOver(idx: number, e: DragEvent) {
    e.preventDefault();
    if (this.editingTitleId()) return;
    if (this.dragDropGlobal.isColumnDrag()) {
      this.dragOverIndex.set(idx);
    }
  }

  /**
   * Drop a column: updates order locally and syncs with backend.
   */
  onColumnDrop(e: DragEvent) {
    if (this.editingTitleId()) return;
    if (!isColumnDragEvent(e)) {
      this.resetDragState();
      return;
    }
    e.preventDefault();
    const draggedId = this.draggedKanbanColumnId();
    const targetIdx = this.dragOverIndex();
    const boardId = this._boardId();
    if (draggedId == null || targetIdx == null || boardId == null) {
      this.resetDragState();
      return;
    }
    const kanbanColumnsRaw = this.kanbanColumnService.kanbanColumns();
    const currIdx = kanbanColumnsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === targetIdx) {
      this.resetDragState();
      return;
    }
    // Optimistically reorder in UI
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
        },
        error: () => {
          this.alert.show("error", "Move error: Could not move column.");
          this.resetDragState();
        },
      });
  }

  onColumnDragEnd() {
    this.resetDragState();
  }

  resetDragState() {
    this.dragDropGlobal.endDrag();
    this.dragOverIndex.set(null);
  }

  // ==== COLUMN ADD/DELETE/EDIT ====

  /** Add new Kanban column, then auto-start edit mode for its name */
  addKanbanColumnAndEdit(): void {
    const id = this._boardId();
    if (
      !id ||
      this.kanbanColumns().length >= this.MAX_KANBANCOLUMNS ||
      this.editingTitleId()
    )
      return;
    this.kanbanColumnService.createKanbanColumn("", id).subscribe({
      next: () => {
        this.kanbanColumnService.loadKanbanColumns(id);
        setTimeout(() => {
          const last = this.kanbanColumnService.kanbanColumns().at(-1);
          if (last) this.startEditTitle(last);
        }, 150);
      },
      error: () => {
        this.alert.show("error", "Failed to create kanban column.");
        this.addKanbanColumnError.set("Failed to create kanban column.");
      },
    });
  }

  /** Delete a whole Kanban column after confirmation */
  async deleteKanbanColumn(id: number, name: string) {
    if (this.editingTitleId()) return;
    const boardId = this._boardId();
    if (!boardId) return;
    const confirmed = await this.confirmDialog.open(
      "Delete column",
      `Delete column “${name}” and all its tasks?`
    );
    if (!confirmed) return;
    this.kanbanColumnService.deleteKanbanColumn(id, boardId).subscribe({
      error: () => this.alert.show("error", "Error while deleting column."),
    });
  }

  /** Delete all tasks in a column (only, not the column itself) */
  async deleteAllInColumn(id: number, name: string) {
    if (this.editingTitleId()) return;
    const confirmed = await this.confirmDialog.open(
      "Delete tasks",
      `Delete all tasks in “${name}”?`
    );
    if (!confirmed) return;
    try {
      this.taskService.deleteTasksByKanbanColumnId(id);
    } catch {
      this.alert.show("error", "Error while deleting all tasks in column.");
    }
  }

  /** Start editing a column name (focus the input for rename) */
  startEditTitle(column: KanbanColumn) {
    if (this.editingTitleId()) return;
    this.editingTitleId.set(column.id!);
    this.editingTitleValue.set(column.name);
    setTimeout(() => {
      const el = document.getElementById(
        `edit-kanbanColumn-title-${column.id}`
      ) as HTMLInputElement;
      el?.focus();
    });
  }

  /** Save column rename and sync with backend */
  saveTitleEdit(column: KanbanColumn) {
    const newName = this.editingTitleValue().trim();
    if (newName === column.name) {
      this.editingTitleId.set(null);
      return;
    }
    const boardId = this._boardId();
    if (!boardId) return;
    const updated: KanbanColumn = { ...column, name: newName, boardId };
    this.kanbanColumnService.updateKanbanColumn(updated).subscribe({
      next: () => {
        this.editingTitleId.set(null);
        this.kanbanColumnService.loadKanbanColumns(boardId);
      },
      error: () => {
        this.alert.show("error", "Error while renaming column.");
        this.editingTitleId.set(null);
      },
    });
  }

  /** Cancel title edit, if column was new and unnamed, auto-delete it */
  cancelTitleEdit() {
    const id = this.editingTitleId();
    const column = this.kanbanColumnService
      .kanbanColumns()
      .find((c) => c.id === id);
    const boardId = this._boardId();
    if (column && !column.name?.trim() && boardId) {
      this.kanbanColumnService
        .deleteKanbanColumn(column.id!, boardId)
        .subscribe({
          next: () => this.editingTitleId.set(null),
          error: () => {
            this.alert.show("error", "Error while cancelling column edition.");
            this.editingTitleId.set(null);
          },
        });
    } else {
      this.editingTitleId.set(null);
    }
  }

  /** Update local edit value from input change */
  onEditTitleInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.editingTitleValue.set(value);
  }

  /** Helper: is this column currently being edited? */
  isEditingTitle(column: KanbanColumn) {
    return this.editingTitleId() === column.id;
  }
}
