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
import { ColumnDragDropService } from "../../services/kanban-column-drag-drop.service";
import { AlertService } from "../../services/alert.service";

/* ==== BOARD COMPONENT ==== */
@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [CommonModule, KanbanColumnComponent],
})
export class BoardComponent implements OnChanges {
  /* ==== INPUT ==== */
  private readonly _boardId = signal<number | null>(null);
  @Input({ required: true }) boardId!: number;

  /* ==== SERVICES ==== */
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly columnDnD = inject(ColumnDragDropService);
  private readonly alert = inject(AlertService);

  /* ==== STATE ==== */
  readonly loading = this.kanbanColumnService.loading;
  addKanbanColumnError = signal<string | null>(null);
  readonly MAX_KANBANCOLUMNS = 5;

  editingTitleId = signal<number | null>(null);
  editingTitleValue = signal("");

  readonly draggedKanbanColumnId = this.columnDnD.draggedKanbanColumnId;
  readonly dragOverIndex = this.columnDnD.dragOverIndex;

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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }

  /* ==== DRAG & DROP ==== */
  onColumnDragStart(id: number, idx: number, e: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragStart(id, idx, e);
  }

  onColumnDragEnter(idx: number, e: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragEnter(idx, e);
  }

  onColumnDragOver(idx: number, e: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragOver(idx, e);
  }

  onColumnDrop(e: DragEvent) {
    if (this.editingTitleId()) return;
    const id = this._boardId();
    if (id != null) this.columnDnD.onColumnDrop(id, e);
  }

  onColumnDragEnd() {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragEnd();
  }

  /* ==== ADD ==== */
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

  /* ==== DELETE ==== */
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

  /* ==== EDIT ==== */
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

  onEditTitleInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.editingTitleValue.set(value);
  }

  isEditingTitle(column: KanbanColumn) {
    return this.editingTitleId() === column.id;
  }
}
