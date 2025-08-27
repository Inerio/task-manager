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
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
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
import { LoadingOverlayComponent } from "../loading-overlay/loading-overlay.component";

/**
 * Kanban board container: displays and reorders columns.
 * Uses signals for all local UI state; no Rx subscriptions here.
 */
@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [
    CommonModule,
    TranslocoModule,
    KanbanColumnComponent,
    LoadingOverlayComponent,
  ],
})
export class BoardComponent implements OnChanges {
  // --------------------
  // Inputs
  // --------------------
  @Input({ required: true }) boardId!: number;

  // Keep a signal mirror of the current board id for effects.
  private readonly _boardId = signal<number | null>(null);

  // --------------------
  // Injections
  // --------------------
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);

  // --------------------
  // Constants
  // --------------------
  /** Max number of columns allowed on a board. */
  readonly MAX_COLUMNS = 5;

  // --------------------
  // Signals (UI state)
  // --------------------
  /** Local loading state is exposed by the service (as a signal). */
  readonly loading = this.kanbanColumnService.loading;

  /** Column title inline edition state. */
  readonly editingColumn = signal<KanbanColumn | null>(null);
  readonly editingTitleValue = signal<string>("");

  /** Column DnD state. */
  readonly dragOverIndex = signal<number | null>(null);
  readonly draggedKanbanColumnId = computed<KanbanColumnId | null>(
    () => this.dragDropGlobal.currentColumnDrag()?.columnId ?? null
  );

  /** Visual pulse when a column has just been dropped. */
  readonly columnPulseId = signal<number | null>(null);
  private _colPulseTimer: number | null = null;

  // --------------------
  // Derived/Computed
  // --------------------
  /** True if the board has at least one task (Set for O(1) lookups). */
  readonly hasAnyTask = computed(() => {
    const columnIds = new Set(
      this.kanbanColumnService.kanbanColumns().map((c) => c.id)
    );
    return this.taskService
      .tasks()
      .some((t) => columnIds.has(t.kanbanColumnId));
  });

  /** Displayed columns; when dragging, show the in-flight reordering. */
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

  // --------------------
  // Effects (side-effects wired to signals)
  // --------------------
  constructor() {
    // Load board data when board id changes.
    effect(() => {
      const id = this._boardId();
      if (id != null) {
        this.kanbanColumnService.loadKanbanColumns(id);
        // Load tasks once (service guards repeated loads internally).
        this.taskService.loadTasks();
      }
    });

    // One-shot pulse on column drop.
    effect(() => {
      const evt = this.dragDropGlobal.lastDroppedColumn();
      if (!evt) return;

      this.columnPulseId.set(evt.id);
      if (this._colPulseTimer != null) {
        clearTimeout(this._colPulseTimer);
      }
      this._colPulseTimer = window.setTimeout(() => {
        this.columnPulseId.set(null);
        this._colPulseTimer = null;
      }, 950);
    });
  }

  // --------------------
  // Lifecycle
  // --------------------
  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }

  // --------------------
  // DnD: columns
  // --------------------
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

    // Optimistic UI update.
    const next = [...cols];
    const [draggedColumn] = next.splice(currIdx, 1);
    next.splice(targetIdx, 0, draggedColumn);
    this.kanbanColumnService.reorderKanbanColumns(next);
    this.dragDropGlobal.markColumnDropped(draggedId);

    try {
      await this.kanbanColumnService.moveKanbanColumn(
        boardId,
        draggedId,
        targetIdx
      );
    } catch {
      this.alert.show("error", this.i18n.translate("errors.movingColumn"));
    } finally {
      this.resetDragState();
    }
  }

  onColumnDragEnd(): void {
    this.resetDragState();
  }

  private resetDragState(): void {
    this.dragDropGlobal.endDrag();
    this.dragOverIndex.set(null);
  }

  // --------------------
  // Column CRUD
  // --------------------
  async addKanbanColumnAndEdit(): Promise<void> {
    const id = this._boardId();
    if (!id) return;

    if (
      this.kanbanColumns().length >= this.MAX_COLUMNS ||
      this.editingColumn()
    ) {
      return;
    }

    // Reuse an existing draft if present.
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
      this.i18n.translate("boards.column.delete"),
      this.i18n.translate("boards.column.deleteConfirm", { name })
    );
    if (!confirmed) return;

    try {
      await this.kanbanColumnService.deleteKanbanColumn(id, boardId);
    } catch {
      this.alert.show("error", this.i18n.translate("errors.deletingColumn"));
    }
  }

  async deleteAllInColumn(id: KanbanColumnId, name: string): Promise<void> {
    if (this.editingColumn()) return;

    const confirmed = await this.confirmDialog.open(
      this.i18n.translate("boards.column.deleteTasksTitle"),
      this.i18n.translate("boards.column.deleteTasksConfirm", { name })
    );
    if (!confirmed) return;

    try {
      this.taskService.deleteTasksByKanbanColumnId(id);
    } catch {
      this.alert.show(
        "error",
        this.i18n.translate("errors.deletingTasksInColumn")
      );
    }
  }

  startEditTitle(column: KanbanColumn): void {
    if (this.editingColumn()) return;
    this.editingColumn.set(column);
    this.editingTitleValue.set(column.name);

    // NOTE: direct DOM id focus is acceptable here (per-column dynamic input).
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
      this.alert.show("error", this.i18n.translate("errors.updatingColumn"));
    } finally {
      this.editingColumn.set(null);
      this.editingTitleValue.set("");
      this.kanbanColumnService.loadKanbanColumns(boardId);
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

  // --------------------
  // Template utilities
  // --------------------
  trackByColumnId(_index: number, col: KanbanColumn): number | undefined {
    return col.id;
  }

  isEditingTitle(column: KanbanColumn): boolean {
    return this.editingColumn() === column;
  }

  isDraft(column: KanbanColumn): boolean {
    return !column.id;
  }
}
