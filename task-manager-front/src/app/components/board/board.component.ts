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
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { AlertService } from "../../services/alert.service";
import { KanbanColumn, KanbanColumnId } from "../../models/kanban-column.model";
import {
  setColumnDragData,
  isColumnDragEvent,
} from "../../utils/drag-drop-utils";

/**
 * BoardComponent: top-level Kanban board with columns (drag/drop/order/edit).
 */
@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [CommonModule, KanbanColumnComponent],
})
export class BoardComponent implements OnChanges {
  /** Board ID (signal-based, for reactivity). */
  private readonly _boardId = signal<number | null>(null);
  @Input({ required: true }) boardId!: number;

  // Services
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly alert = inject(AlertService);

  /** Loading state from column service. */
  readonly loading = this.kanbanColumnService.loading;

  /** UI/logic constants and state. */
  readonly MAX_KANBANCOLUMNS = 5;
  readonly addKanbanColumnError = signal<string | null>(null);

  /** Edition state for columns' titles. */
  readonly editingColumn = signal<KanbanColumn | null>(null);
  readonly editingTitleValue = signal("");

  /** Drag & drop state. */
  readonly draggedKanbanColumnId = computed<KanbanColumnId | null>(
    () => this.dragDropGlobal.currentColumnDrag()?.columnId ?? null
  );
  readonly dragOverIndex = signal<number | null>(null);

  /** Pulse state for dropped column. */
  readonly columnPulseId = signal<number | null>(null);
  private _colPulseTimer: any = null;

  /** True if the board has at least one task (Set-based micro-optim). */
  readonly hasAnyTask = computed(() => {
    const ids = new Set(
      this.kanbanColumnService.kanbanColumns().map((c) => c.id)
    );
    return this.taskService.tasks().some((t) => ids.has(t.kanbanColumnId));
  });

  /** Columns to display (reordered if dragging). */
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
    effect(() => {
      const id = this._boardId();
      if (id != null) {
        this.kanbanColumnService.loadKanbanColumns(id);
        this.taskService.loadTasks();
      }
    });
    effect(() => {
      const evt = this.dragDropGlobal.lastDroppedColumn();
      if (evt) {
        this.columnPulseId.set(evt.id);
        clearTimeout(this._colPulseTimer);
        this._colPulseTimer = setTimeout(
          () => this.columnPulseId.set(null),
          950
        );
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }

  // ---- Helpers ----
  isEditingTitle(column: KanbanColumn): boolean {
    return this.editingColumn() === column;
  }
  isDraft(column: KanbanColumn): boolean {
    return !column.id;
  }

  // ==== DRAG & DROP (columns) ====

  onColumnDragStart(id: KanbanColumnId, idx: number, e: DragEvent): void {
    if (this.editingColumn()) return; // lock while editing
    setColumnDragData(e, id);
    this.dragDropGlobal.startColumnDrag(id);
    this.dragOverIndex.set(idx);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  onColumnDragHover(idx: number, e: DragEvent): void {
    e.preventDefault();
    if (this.editingColumn()) return;
    if (this.dragDropGlobal.isColumnDrag()) {
      this.dragOverIndex.set(idx);
    }
  }

  async onColumnDrop(e: DragEvent): Promise<void> {
    if (this.editingColumn()) return;
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

    const cols = this.kanbanColumnService.kanbanColumns();
    const currIdx = cols.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === targetIdx) {
      this.resetDragState();
      return;
    }

    // Optimistic UI update
    const newArr = [...cols];
    const [draggedColumn] = newArr.splice(currIdx, 1);
    newArr.splice(targetIdx, 0, draggedColumn);
    this.kanbanColumnService.reorderKanbanColumns(newArr);
    this.dragDropGlobal.markColumnDropped(draggedId);

    try {
      await this.kanbanColumnService.moveKanbanColumn(
        boardId,
        draggedId,
        targetIdx
      );
    } catch {
      this.alert.show("error", "Move error: Could not move column.");
    } finally {
      this.resetDragState();
    }
  }

  onColumnDragEnd(): void {
    this.resetDragState();
  }

  resetDragState(): void {
    this.dragDropGlobal.endDrag();
    this.dragOverIndex.set(null);
  }

  // ==== COLUMN CRUD ==== (unchanged)
  async addKanbanColumnAndEdit(): Promise<void> {
    const id = this._boardId();
    if (!id) return;

    if (
      this.kanbanColumns().length >= this.MAX_KANBANCOLUMNS ||
      this.editingColumn()
    ) {
      return;
    }

    const existingDraft = this.kanbanColumns().find((c) => !c.id);
    if (existingDraft) {
      this.startEditTitle(existingDraft);
      return;
    }

    const draft = this.kanbanColumnService.insertDraftColumn(id);
    this.startEditTitle(draft);
  }

  async deleteKanbanColumn(id: KanbanColumnId, name: string): Promise<void> {
    if (this.editingColumn()) return;
    const boardId = this._boardId();
    if (!boardId) return;

    const confirmed = await this.confirmDialog.open(
      "Delete column",
      `Delete column “${name}” and all its tasks?`
    );
    if (!confirmed) return;

    try {
      await this.kanbanColumnService.deleteKanbanColumn(id, boardId);
    } catch {
      this.alert.show("error", "Error while deleting column.");
    }
  }

  async deleteAllInColumn(id: KanbanColumnId, name: string): Promise<void> {
    if (this.editingColumn()) return;

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

  startEditTitle(column: KanbanColumn): void {
    if (this.editingColumn()) return;
    this.editingColumn.set(column);
    this.editingTitleValue.set(column.name);

    setTimeout(() => {
      const el = document.getElementById(
        `edit-kanbanColumn-title-${column.id ?? "draft"}`
      ) as HTMLInputElement | null;
      el?.focus();
    });
  }

  async saveTitleEdit(column: KanbanColumn): Promise<void> {
    const boardId = this._boardId();
    if (!boardId) return;

    const newName = this.editingTitleValue().trim();
    const currentlyEditing = this.editingColumn();
    if (!currentlyEditing) return;

    try {
      if (!column.id) {
        const created = await this.kanbanColumnService.createKanbanColumn(
          newName,
          boardId
        );
        this.kanbanColumnService.replaceRef(currentlyEditing, {
          ...created,
          boardId,
        });
      } else {
        const updated: KanbanColumn = { ...column, name: newName, boardId };
        await this.kanbanColumnService.updateKanbanColumn(updated);
      }
    } catch {
      this.alert.show("error", "Error while saving column.");
    } finally {
      this.editingColumn.set(null);
      this.editingTitleValue.set("");
      if (boardId) this.kanbanColumnService.loadKanbanColumns(boardId);
    }
  }

  cancelTitleEdit(): void {
    const editing = this.editingColumn();
    if (!editing) return;
    if (!editing.id) {
      this.kanbanColumnService.removeColumnRef(editing);
    }
    this.editingColumn.set(null);
    this.editingTitleValue.set("");
  }

  onEditTitleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editingTitleValue.set(value);
  }

  trackByColumnId(_index: number, col: KanbanColumn): number | undefined {
    return col.id;
  }
}
