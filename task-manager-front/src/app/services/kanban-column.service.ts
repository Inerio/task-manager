import { Injectable, computed, signal, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import {
  type KanbanColumn,
  type KanbanColumnId,
} from "../models/kanban-column.model";
import { environment } from "../../environments/environment.local";
import { firstValueFrom } from "rxjs";
import { AlertService } from "./alert.service";

/** Kanban columns CRUD + ordering with signals and optimistic updates. */
@Injectable({ providedIn: "root" })
export class KanbanColumnService {
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);

  private readonly _kanbanColumns = signal<KanbanColumn[]>([]);
  readonly kanbanColumns = computed(() => this._kanbanColumns());

  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  /** Load columns for a board. */
  loadKanbanColumns(boardId: number): void {
    if (!boardId) {
      this._kanbanColumns.set([]);
      return;
    }
    this._loading.set(true);
    const url = `${environment.apiUrl}/boards/${boardId}/kanbanColumns`;
    this.http.get<KanbanColumn[]>(url).subscribe({
      next: (cols) => this._kanbanColumns.set(cols ?? []),
      error: () => {
        this._kanbanColumns.set([]);
        this.alert.show("error", "Error loading columns.");
      },
      complete: () => this._loading.set(false),
    });
  }

  /** Create a column; updates local signal on success. */
  async createKanbanColumn(
    name: string,
    boardId: number
  ): Promise<KanbanColumn> {
    const url = `${environment.apiUrl}/boards/${boardId}/kanbanColumns`;
    try {
      const created = await firstValueFrom(
        this.http.post<KanbanColumn>(url, { name })
      );
      this._kanbanColumns.update((list) => [...list, created]);
      return created;
    } catch (err) {
      this.alert.show("error", "Error creating column.");
      throw err;
    }
  }

  /** Update a column; replaces it in the local signal on success. */
  async updateKanbanColumn(kanbanColumn: KanbanColumn): Promise<KanbanColumn> {
    if (!kanbanColumn.id) throw new Error("KanbanColumn ID required");
    if (!kanbanColumn.boardId) throw new Error("KanbanColumn boardId required");
    const url = `${environment.apiUrl}/boards/${kanbanColumn.boardId}/kanbanColumns/${kanbanColumn.id}`;
    try {
      const updated = await firstValueFrom(
        this.http.put<KanbanColumn>(url, kanbanColumn)
      );
      this._kanbanColumns.update((list) =>
        list.map((c) => (c.id === updated.id ? updated : c))
      );
      return updated;
    } catch (err) {
      this.alert.show("error", "Error updating column.");
      throw err;
    }
  }

  /** Delete a column; removes it from the local signal on success. */
  async deleteKanbanColumn(
    kanbanColumnId: KanbanColumnId,
    boardId: number
  ): Promise<void> {
    const url = `${environment.apiUrl}/boards/${boardId}/kanbanColumns/${kanbanColumnId}`;
    try {
      await firstValueFrom(this.http.delete<void>(url));
      this._kanbanColumns.update((list) =>
        list.filter((c) => c.id !== kanbanColumnId)
      );
    } catch (err) {
      this.alert.show("error", "Error deleting column.");
      throw err;
    }
  }

  /**
   * Move a column to a new index.
   * @param targetIndex Zero-based client index (backend expects +1).
   */
  async moveKanbanColumn(
    boardId: number,
    kanbanColumnId: KanbanColumnId,
    targetIndex: number
  ): Promise<void> {
    const url = `${environment.apiUrl}/boards/${boardId}/kanbanColumns/move`;
    try {
      await firstValueFrom(
        this.http.put<void>(url, {
          kanbanColumnId,
          targetPosition: targetIndex + 1,
        })
      );
    } catch (err) {
      this.alert.show("error", "Error moving column.");
      throw err;
    }
  }

  /** Optimistically set order in local state. */
  reorderKanbanColumns(newOrder: ReadonlyArray<KanbanColumn>): void {
    this._kanbanColumns.set([...newOrder]);
  }

  /**
   * Insert a client-only draft column at the end of the list.
   * Drafts have no `id` and will be persisted on save.
   */
  insertDraftColumn(boardId: number): KanbanColumn {
    const draft: KanbanColumn = { boardId, name: "" };
    this._kanbanColumns.update((list) => [...list, draft]);
    return draft;
  }

  /** Remove a column by reference (works for drafts without id). */
  removeColumnRef(ref: KanbanColumn): void {
    this._kanbanColumns.update((list) => list.filter((c) => c !== ref));
  }

  /** Replace a column by reference (used to swap a draft with the created one). */
  replaceRef(oldRef: KanbanColumn, replacement: KanbanColumn): void {
    this._kanbanColumns.update((list) =>
      list.map((c) => (c === oldRef ? replacement : c))
    );
  }
}
