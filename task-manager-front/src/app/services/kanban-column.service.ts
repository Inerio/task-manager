import { Injectable, computed, signal, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TranslocoService } from "@jsverse/transloco";
import {
  type KanbanColumn,
  type KanbanColumnId,
} from "../models/kanban-column.model";
import { environment } from "../../environments/environment";
import { firstValueFrom } from "rxjs";
import { AlertService } from "./alert.service";
import { LoadingService } from "./loading.service";

/** Kanban columns CRUD + ordering with signals and optimistic updates. */
@Injectable({ providedIn: "root" })
export class KanbanColumnService {
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);
  private readonly loadingSvc = inject(LoadingService);

  private readonly _kanbanColumns = signal<KanbanColumn[]>([]);
  readonly kanbanColumns = computed(() => this._kanbanColumns());

  private readonly _loading = signal(false);
  /** Local loading state used by components (e.g. to disable UI). */
  readonly loading = computed(() => this._loading());

  /** Load columns for a board (scoped overlay: "board"). */
  loadKanbanColumns(boardId: number): void {
    if (!boardId) {
      this._kanbanColumns.set([]);
      return;
    }
    this._loading.set(true);

    const url = `${environment.apiUrl}/boards/${boardId}/kanbanColumns`;
    this.loadingSvc
      .wrap$(this.http.get<KanbanColumn[]>(url), "board")
      .subscribe({
        next: (cols) => this._kanbanColumns.set(cols ?? []),
        error: () => {
          this._kanbanColumns.set([]);
          this.alert.show(
            "error",
            this.i18n.translate("errors.loadingColumns")
          );
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
      this.alert.show("error", this.i18n.translate("errors.creatingColumn"));
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
      this.alert.show("error", this.i18n.translate("errors.updatingColumn"));
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
      this.alert.show("error", this.i18n.translate("errors.deletingColumn"));
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
      this.alert.show("error", this.i18n.translate("errors.movingColumn"));
      throw err;
    }
  }

  /** Optimistically set order in local state. */
  reorderKanbanColumns(newOrder: ReadonlyArray<KanbanColumn>): void {
    this._kanbanColumns.set([...newOrder]);
  }

  // ------- Draft helpers used by BoardComponent -------

  /** Insert a client-side draft column (id undefined) at the end. */
  insertDraftColumn(boardId: number): KanbanColumn {
    const draft: KanbanColumn = {
      id: undefined,
      boardId,
      name: "",
      position: this._kanbanColumns().length,
    };
    this._kanbanColumns.update((arr) => [...arr, draft]);
    return draft;
  }

  /** Replace a reference in the array */
  replaceRef(from: KanbanColumn, to: KanbanColumn): void {
    this._kanbanColumns.update((arr) => {
      const idx = arr.indexOf(from);
      if (idx === -1) return arr;
      const copy = arr.slice();
      copy[idx] = to;
      return copy;
    });
  }

  /** Remove a column by reference (used to cancel a draft). */
  removeColumnRef(ref: KanbanColumn): void {
    this._kanbanColumns.update((arr) => arr.filter((c) => c !== ref));
  }
}
