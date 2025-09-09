import { Injectable, signal, inject } from "@angular/core";
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

  async addKanbanColumnAndEdit(boardId: number): Promise<void> {
    if (!boardId) return;
    if (
      this.columns.kanbanColumns().length >= this.MAX_COLUMNS ||
      this.editingColumn()
    )
      return;

    const existingDraft = this.columns.kanbanColumns().find((c) => !c.id);
    if (existingDraft) {
      this.startEditTitle(existingDraft);
      return;
    }

    const draft = this.columns.insertDraftColumn(boardId);
    this.startEditTitle(draft);
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

    try {
      await this.columns.deleteKanbanColumn(id, boardId);
    } catch {
      this.alert.show("error", this.i18n.translate("errors.deletingColumn"));
    }
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
    this.editingTitleValue.set(column.name);

    // Focus after input mounts
    queueMicrotask(() => {
      const el = document.getElementById(
        `edit-kanbanColumn-title-${column.id ?? "draft"}`
      ) as HTMLInputElement | null;
      el?.focus();
    });
  }

  async saveTitleEdit(column: KanbanColumn, boardId: number): Promise<void> {
    if (!boardId) return;

    const newName = this.editingTitleValue().trim();
    const currentlyEditing = this.editingColumn();
    if (!currentlyEditing) return;

    // Prevent creating/updating with an empty title (UX safeguard).
    if (!newName) {
      if (!column.id) {
        this.columns.removeColumnRef(currentlyEditing);
      }
      this.editingColumn.set(null);
      this.editingTitleValue.set("");
      return;
    }

    try {
      if (!column.id) {
        // Creating from a DRAFT: service appends the created item.
        const before = this.columns.kanbanColumns();
        const draftIndex = before.indexOf(currentlyEditing);

        const created = await this.columns.createKanbanColumn(newName, boardId);

        // Remove draft entry so we don't have two items with the same id.
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
      this.alert.show("error", this.i18n.translate("errors.updatingColumn"));
    } finally {
      this.editingColumn.set(null);
      this.editingTitleValue.set("");
    }
  }

  cancelTitleEdit(): void {
    const editing = this.editingColumn();
    if (!editing) return;

    if (!editing.id) {
      this.columns.removeColumnRef(editing);
    }
    this.editingColumn.set(null);
    this.editingTitleValue.set("");
  }

  onEditTitleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editingTitleValue.set(value);
  }
}
