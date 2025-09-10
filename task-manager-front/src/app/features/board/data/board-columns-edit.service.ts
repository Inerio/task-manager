import { Injectable, signal, inject, effect } from "@angular/core";
import { KanbanColumn, KanbanColumnId } from "../models/kanban-column.model";
import { KanbanColumnService } from "./kanban-column.service";
import { TaskService } from "../../task/data/task.service";
import { ConfirmDialogService } from "../../../core/services/dialog/confirm-dialog.service";
import { AlertService } from "../../../core/services/alert.service";
import { TranslocoService } from "@jsverse/transloco";

/** Handles inline title edit + CRUD for columns. Scoped to BoardColumnsComponent via providers[]. */
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

  /** Re-entrancy guards */
  private saving = false;
  private committingOnBoardChange = false;

  constructor() {
    // If the column being edited disappears from the current list (e.g. board switch),
    // finalize it: create the draft with current (possibly empty) title, then clear edit state.
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
        const name = this.editingTitleValue().trim(); // empty allowed
        try {
          await this.columns.createKanbanColumn(name, editing.boardId);
          this.columns.removeColumnRef(editing);
        } catch {
          // Error already surfaced via service alerts
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

    // If "+" is clicked while editing: commit current (even empty), then create the next one.
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

    // Service already shows an alert on error.
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

  startEditTitle(column: KanbanColumn): void {
    if (this.editingColumn()) return;
    this.editingColumn.set(column);
    this.editingTitleValue.set(column.name ?? "");

    // Focus after input mounts; use rAF+microtask to be extra resilient.
    const focusNow = () => {
      const el = document.getElementById(
        `edit-kanbanColumn-title-${column.id ?? "draft"}`
      ) as HTMLInputElement | null;
      if (el) {
        el.focus();
        // Put caret at end
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

    const newName = this.editingTitleValue().trim(); // empty allowed
    const currentlyEditing = this.editingColumn();
    if (!currentlyEditing) {
      this.saving = false;
      return;
    }

    try {
      if (!column.id) {
        // Create from a DRAFT (even with empty name).
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
      this.saving = false;
    }
  }

  /** ESC / click-outside now *commits* the draft with empty title instead of cancelling. */
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
}
