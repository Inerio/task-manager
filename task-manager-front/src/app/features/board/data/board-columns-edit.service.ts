import { Injectable, signal, inject, effect } from "@angular/core";
import { KanbanColumn, KanbanColumnId } from "../models/kanban-column.model";
import { KanbanColumnService } from "./kanban-column.service";
import { TaskService } from "../../task/data/task.service";
import { ConfirmDialogService } from "../../../core/services/dialog/confirm-dialog.service";
import { AlertService } from "../../../core/services/alert.service";
import { TranslocoService } from "@jsverse/transloco";

@Injectable()
export class BoardColumnsEditService {
  private readonly columns = inject(KanbanColumnService);
  private readonly tasks = inject(TaskService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);

  /** Max columns allowed on a board. */
  readonly MAX_COLUMNS = 5;

  /** Inline edit state */
  readonly editingColumn = signal<KanbanColumn | null>(null);
  readonly editingTitleValue = signal<string>("");
  /** Number of rows for the textarea during edit: 1 or 2. */
  readonly editingRows = signal<1 | 2>(1);

  /** Re-entrancy guards */
  private saving = false;
  private committingOnBoardChange = false;

  constructor() {
    effect(() => {
      const list = this.columns.kanbanColumns();
      const editing = this.editingColumn();
      if (!editing) return;

      const stillHere =
        list.some((c) => c === editing) ||
        (editing.id != null && list.some((c) => c.id === editing.id));

      if (!stillHere) {
        queueMicrotask(() => void this.commitDraftIfDetached(editing));
      }
    });
  }

  private async commitDraftIfDetached(editing: KanbanColumn): Promise<void> {
    if (this.committingOnBoardChange) return;
    this.committingOnBoardChange = true;
    try {
      if (!editing.id && editing.boardId) {
        const name = this.editingTitleValue().trim();
        try {
          await this.columns.createKanbanColumn(name, editing.boardId);
          this.columns.removeColumnRef(editing);
        } catch {
          // no-op
        }
      }
    } finally {
      this.editingColumn.set(null);
      this.editingTitleValue.set("");
      this.committingOnBoardChange = false;
    }
  }

  async addKanbanColumnAndEdit(boardId: number): Promise<void> {
    if (!boardId) return;
    if (this.columns.kanbanColumns().length >= this.MAX_COLUMNS) return;
    const current = this.editingColumn();
    if (current) {
      await this.saveTitleEdit(current, current.boardId ?? boardId);
    }
    try {
      const created = await this.columns.createKanbanColumn("", boardId);
      this.startEditTitle(created);
    } catch {
      // no-op: error toast already shown by KanbanColumnService
    }
  }

  async deleteKanbanColumn(
    id: KanbanColumnId,
    name: string,
    boardId: number
  ): Promise<void> {
    if (this.editingColumn()) return;
    if (!boardId) return;

    const confirmed = await this.confirm.open(
      this.i18n.translate("boards.column.delete"),
      this.i18n.translate("boards.column.deleteConfirm", { name })
    );
    if (!confirmed) return;
    await this.columns.deleteKanbanColumn(id, boardId);
  }

  async deleteAllInColumn(id: KanbanColumnId, name: string): Promise<void> {
    if (this.editingColumn()) return;

    const confirmed = await this.confirm.open(
      this.i18n.translate("boards.column.deleteTasksTitle"),
      this.i18n.translate("boards.column.deleteTasksConfirm", { name })
    );
    if (!confirmed) return;

    try {
      await this.tasks.deleteTasksByKanbanColumnId(id);
    } catch {
      this.alert.show(
        "error",
        this.i18n.translate("errors.deletingTasksInColumn")
      );
    }
  }

  /**
   * Start editing the column title.
   * @param fromEl
   */
  startEditTitle(column: KanbanColumn, fromEl?: HTMLElement | null): void {
    if (this.editingColumn()) return;

    const rows: 1 | 2 = fromEl ? this.computeRowsFromEl(fromEl) : 1;
    this.editingRows.set(rows);
    this.editingColumn.set(column);
    this.editingTitleValue.set(column.name ?? "");

    const focusNow = () => {
      const el = document.getElementById(
        `edit-kanbanColumn-title-${column.id ?? "draft"}`
      ) as HTMLInputElement | null;
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === "function") {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }
    };
    requestAnimationFrame(() => queueMicrotask(focusNow));
  }

  async saveTitleEdit(column: KanbanColumn, boardId: number): Promise<void> {
    if (!boardId) return;
    if (this.saving) return;
    this.saving = true;

    const newName = this.editingTitleValue().trim();
    const currentlyEditing = this.editingColumn();
    if (!currentlyEditing) {
      this.saving = false;
      return;
    }

    try {
      if (!column.id) {
        const before = this.columns.kanbanColumns();
        const draftIndex = before.indexOf(currentlyEditing);
        const created = await this.columns.createKanbanColumn(newName, boardId);
        this.columns.removeColumnRef(currentlyEditing);
        const after = this.columns.kanbanColumns();
        const createdIdx = after.findIndex((c) => c.id === created.id);
        if (createdIdx !== -1 && draftIndex >= 0 && draftIndex !== createdIdx) {
          const copy = after.slice();
          const [row] = copy.splice(createdIdx, 1);
          const insertAt = Math.min(draftIndex, copy.length);
          copy.splice(insertAt, 0, row);
          this.columns.reorderKanbanColumns(copy);
        }
      } else {
        const updated: KanbanColumn = { ...column, name: newName, boardId };
        await this.columns.updateKanbanColumn(updated);
      }
    } catch {
    } finally {
      this.editingColumn.set(null);
      this.editingTitleValue.set("");
      this.editingRows.set(1); // reset
      this.saving = false;
    }
  }

  cancelTitleEdit(): void {
    const editing = this.editingColumn();
    if (!editing) return;
    const boardId = editing.boardId ?? 0;
    void this.saveTitleEdit(editing, boardId);
  }

  onEditTitleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editingTitleValue.set(value);
  }

  private computeRowsFromEl(host: HTMLElement): 1 | 2 {
    try {
      const cs = getComputedStyle(host);
      const lh = parseFloat(cs.lineHeight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const contentH = Math.max(0, host.clientHeight - pt - pb);
      const lines = lh > 0 ? Math.round(contentH / lh + 0.01) : 1;
      return lines > 1 ? 2 : 1;
    } catch {
      return 1;
    }
  }
}
