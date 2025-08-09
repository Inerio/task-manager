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
  readonly editingTitleId = signal<KanbanColumnId | null>(null);
  readonly editingTitleValue = signal("");

  /** Drag & drop state. */
  readonly draggedKanbanColumnId = computed<KanbanColumnId | null>(
    () => this.dragDropGlobal.currentColumnDrag()?.columnId ?? null
  );
  readonly dragOverIndex = signal<number | null>(null);

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

  /** Start dragging a column (called on dragstart of column header). */
  onColumnDragStart(id: KanbanColumnId, idx: number, e: DragEvent): void {
    if (this.editingTitleId()) return;
    setColumnDragData(e, id);
    this.dragDropGlobal.startColumnDrag(id);
    this.dragOverIndex.set(idx);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  /** Shared handler for dragenter/dragover to preview target index. */
  onColumnDragHover(idx: number, e: DragEvent): void {
    e.preventDefault();
    if (this.editingTitleId()) return;
    if (this.dragDropGlobal.isColumnDrag()) {
      this.dragOverIndex.set(idx);
    }
  }

  /** Drop a column: reorder locally (optimistic) and sync with backend. */
  async onColumnDrop(e: DragEvent): Promise<void> {
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

    // Backend sync
    try {
      await this.kanbanColumnService.moveKanbanColumn(
        boardId,
        draggedId,
        targetIdx
      );
      this.kanbanColumnService.loadKanbanColumns(boardId);
    } catch {
      this.alert.show("error", "Move error: Could not move column.");
    } finally {
      this.resetDragState();
    }
  }

  /** End of column drag operation (cleans state). */
  onColumnDragEnd(): void {
    this.resetDragState();
  }

  /** Helper: resets all D&D states. */
  resetDragState(): void {
    this.dragDropGlobal.endDrag();
    this.dragOverIndex.set(null);
  }

  // ==== COLUMN CRUD ====

  /** Add new Kanban column and auto-start its rename. */
  async addKanbanColumnAndEdit(): Promise<void> {
    const id = this._boardId();
    if (
      !id ||
      this.kanbanColumns().length >= this.MAX_KANBANCOLUMNS ||
      this.editingTitleId()
    ) {
      return;
    }

    try {
      await this.kanbanColumnService.createKanbanColumn("", id);
      this.kanbanColumnService.loadKanbanColumns(id);
      // Focus the newly created column title input after list refresh
      setTimeout(() => {
        const last = this.kanbanColumnService.kanbanColumns().at(-1);
        if (last) this.startEditTitle(last);
      }, 150);
    } catch {
      this.alert.show("error", "Failed to create kanban column.");
      this.addKanbanColumnError.set("Failed to create kanban column.");
    }
  }

  /** Delete a Kanban column (with confirmation). */
  async deleteKanbanColumn(id: KanbanColumnId, name: string): Promise<void> {
    if (this.editingTitleId()) return;
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

  /** Delete all tasks in a column (not the column itself). */
  async deleteAllInColumn(id: KanbanColumnId, name: string): Promise<void> {
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

  /** Start editing the title of a column (focus the input). */
  startEditTitle(column: KanbanColumn): void {
    if (this.editingTitleId()) return;
    this.editingTitleId.set(column.id!);
    this.editingTitleValue.set(column.name);
    setTimeout(() => {
      const el = document.getElementById(
        `edit-kanbanColumn-title-${column.id}`
      ) as HTMLInputElement | null;
      el?.focus();
    });
  }

  /** Save renamed column, sync backend. */
  async saveTitleEdit(column: KanbanColumn): Promise<void> {
    const newName = this.editingTitleValue().trim();
    if (newName === column.name) {
      this.editingTitleId.set(null);
      return;
    }
    const boardId = this._boardId();
    if (!boardId) return;

    const updated: KanbanColumn = { ...column, name: newName, boardId };
    try {
      await this.kanbanColumnService.updateKanbanColumn(updated);
      this.editingTitleId.set(null);
      this.kanbanColumnService.loadKanbanColumns(boardId);
    } catch {
      this.alert.show("error", "Error while renaming column.");
      this.editingTitleId.set(null);
    }
  }

  /** Cancel title edit. */
  cancelTitleEdit(): void {
    this.editingTitleId.set(null);
  }

  /** Handle input for inline edit of column name. */
  onEditTitleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editingTitleValue.set(value);
  }

  /** True if this column is currently being edited. */
  isEditingTitle(column: KanbanColumn): boolean {
    return this.editingTitleId() === column.id;
  }

  /** Track function for columns. */
  trackByColumnId(_index: number, col: KanbanColumn): number | undefined {
    return col.id;
  }
}
