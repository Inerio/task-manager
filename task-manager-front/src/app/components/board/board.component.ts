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

/* ==== BOARD COMPONENT ==== */
@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [CommonModule, KanbanColumnComponent],
})
export class BoardComponent implements OnChanges {
  /* ==== INPUTS ==== */
  private readonly _boardId = signal<number | null>(null);
  @Input({ required: true }) boardId!: number;

  /* ==== SERVICES ==== */
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly columnDnD = inject(ColumnDragDropService);

  /* ==== STATE ==== */
  readonly loading = this.kanbanColumnService.loading;
  addKanbanColumnError = signal<string | null>(null);
  readonly MAX_KANBANCOLUMNS = 5;

  editingTitleId = signal<number | null>(null);
  editingTitleValue = signal("");

  readonly draggedKanbanColumnId = this.columnDnD.draggedKanbanColumnId;
  readonly dragOverIndex = this.columnDnD.dragOverIndex;

  /* ==== KANBAN COLUMNS ORDER (with preview) ==== */
  readonly kanbanColumns = computed(() => {
    const kanbanColumnsRaw = this.kanbanColumnService.kanbanColumns();
    const draggedId = this.draggedKanbanColumnId();
    const overIdx = this.dragOverIndex();
    if (draggedId == null || overIdx == null) return kanbanColumnsRaw;
    const currIdx = kanbanColumnsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === overIdx) return kanbanColumnsRaw;
    const newArr = kanbanColumnsRaw.slice();
    const [dragged] = newArr.splice(currIdx, 1);
    newArr.splice(overIdx, 0, dragged);
    return newArr;
  });

  constructor() {
    effect(() => {
      const boardId = this._boardId();
      if (boardId) {
        this.kanbanColumnService.loadKanbanColumns(boardId);
        this.taskService.loadTasks();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }

  /* ==== DRAG & DROP COLUMNS ==== */
  onColumnDragStart(kanbanColumnId: number, idx: number, event: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragStart(kanbanColumnId, idx, event);
  }
  onColumnDragEnter(idx: number, event: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragEnter(idx, event);
  }
  onColumnDragOver(idx: number, event: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragOver(idx, event);
  }
  onColumnDrop(event: DragEvent) {
    if (this.editingTitleId()) return;
    const boardId = this._boardId();
    if (boardId) this.columnDnD.onColumnDrop(boardId, event);
  }
  onColumnDragEnd() {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragEnd();
  }

  /* ==== ADD COLUMN ==== */
  addKanbanColumnAndEdit(): void {
    if (this.kanbanColumns().length >= this.MAX_KANBANCOLUMNS) return;
    if (this.editingTitleId()) return;
    const boardId = this._boardId();
    if (!boardId) return;
    this.kanbanColumnService.createKanbanColumn("", boardId).subscribe({
      next: () => {
        this.kanbanColumnService.loadKanbanColumns(boardId);
        setTimeout(() => {
          const last = this.kanbanColumnService.kanbanColumns().slice(-1)[0];
          if (last) this.startEditTitle(last);
        }, 150);
      },
      error: () =>
        this.addKanbanColumnError.set("Failed to create kanban column."),
    });
  }

  /* ==== DELETE COLUMN ==== */
  async deleteKanbanColumn(kanbanColumnId: number, kanbanColumnName: string) {
    if (this.editingTitleId()) return;
    const boardId = this._boardId();
    if (!boardId) return;
    const confirmed = await this.confirmDialog.open(
      "Delete column",
      `Delete column “${kanbanColumnName}” and all its tasks?`
    );
    if (!confirmed) return;
    this.kanbanColumnService
      .deleteKanbanColumn(kanbanColumnId, boardId)
      .subscribe({
        next: () => {},
        error: (err) => {
          alert("Error while deleting column");
          console.error(err);
        },
      });
  }

  /* ==== DELETE ALL TASKS IN COLUMN ==== */
  async deleteAllInColumn(kanbanColumnId: number, kanbanColumnName: string) {
    if (this.editingTitleId()) return;
    const confirmed = await this.confirmDialog.open(
      "Delete tasks",
      `Delete all tasks in “${kanbanColumnName}”?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(kanbanColumnId);
  }

  /* ==== EDIT COLUMN TITLE ==== */
  startEditTitle(kanbanColumn: KanbanColumn) {
    if (this.editingTitleId()) return;
    this.editingTitleId.set(kanbanColumn.id!);
    this.editingTitleValue.set(kanbanColumn.name);
    setTimeout(() => {
      const input = document.getElementById(
        `edit-kanbanColumn-title-${kanbanColumn.id}`
      ) as HTMLInputElement | null;
      if (input) input.focus();
    }, 0);
  }

  saveTitleEdit(kanbanColumn: KanbanColumn) {
    const newName = this.editingTitleValue().trim();
    if (!newName) return;
    if (newName === kanbanColumn.name) {
      this.editingTitleId.set(null);
      return;
    }
    const boardId = this._boardId();
    if (!boardId) return;
    const updated: KanbanColumn = {
      ...kanbanColumn,
      name: newName,
      position: kanbanColumn.position,
      boardId: boardId,
    };
    this.kanbanColumnService.updateKanbanColumn(updated).subscribe({
      next: () => {
        this.editingTitleId.set(null);
        this.kanbanColumnService.loadKanbanColumns(boardId);
      },
      error: (err) => {
        alert("Error while renaming column");
        console.error(err);
        this.editingTitleId.set(null);
      },
    });
  }

  cancelTitleEdit() {
    const id = this.editingTitleId();
    const currKanbanColumn = this.kanbanColumnService
      .kanbanColumns()
      .find((l) => l.id === id);
    const boardId = this._boardId();
    if (
      currKanbanColumn &&
      (!currKanbanColumn.name || currKanbanColumn.name.trim() === "") &&
      boardId
    ) {
      this.kanbanColumnService
        .deleteKanbanColumn(currKanbanColumn.id!, boardId)
        .subscribe({
          next: () => this.editingTitleId.set(null),
          error: () => this.editingTitleId.set(null),
        });
    } else {
      this.editingTitleId.set(null);
    }
  }

  onEditTitleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingTitleValue.set(input.value);
  }

  isEditingTitle(kanbanColumn: KanbanColumn) {
    return this.editingTitleId() === kanbanColumn.id;
  }
}
