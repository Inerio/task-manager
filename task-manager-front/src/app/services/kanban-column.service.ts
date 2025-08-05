import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { KanbanColumn } from "../models/kanban-column.model";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment.local";

/** Service for managing kanban columns, with signals and optimistic UI updates. */
@Injectable({ providedIn: "root" })
export class KanbanColumnService {
  private readonly _kanbanColumns = signal<KanbanColumn[]>([]);
  readonly kanbanColumns = computed(() => this._kanbanColumns());

  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  constructor(private http: HttpClient) {}

  /** Loads all columns for the given board. */
  loadKanbanColumns(boardId: number): void {
    if (!boardId) {
      this._kanbanColumns.set([]);
      return;
    }
    this._loading.set(true);
    const url = `${environment.apiUrl + "/boards"}/${boardId}/kanbanColumns`;
    this.http.get<KanbanColumn[]>(url).subscribe({
      next: (data) => this._kanbanColumns.set(data ?? []),
      error: () => this._kanbanColumns.set([]),
      complete: () => this._loading.set(false),
    });
  }

  /** Creates a new column in a board. */
  createKanbanColumn(name: string, boardId: number): Observable<KanbanColumn> {
    const url = `${environment.apiUrl + "/boards"}/${boardId}/kanbanColumns`;
    return this.http.post<KanbanColumn>(url, { name });
  }

  /** Updates a column. Throws if id/boardId is missing. */
  updateKanbanColumn(kanbanColumn: KanbanColumn): Observable<KanbanColumn> {
    if (!kanbanColumn.id) throw new Error("KanbanColumn ID required");
    if (!kanbanColumn.boardId) throw new Error("KanbanColumn boardId required");
    const url = `${environment.apiUrl + "/boards"}/${
      kanbanColumn.boardId
    }/kanbanColumns/${kanbanColumn.id}`;
    return this.http.put<KanbanColumn>(url, kanbanColumn);
  }

  /** Deletes a column, updates signal locally for instant feedback. */
  deleteKanbanColumn(
    kanbanColumnId: number,
    boardId: number
  ): Observable<void> {
    const url = `${
      environment.apiUrl + "/boards"
    }/${boardId}/kanbanColumns/${kanbanColumnId}`;
    return new Observable<void>((observer) => {
      this.http.delete<void>(url).subscribe({
        next: () => {
          this._kanbanColumns.set(
            this._kanbanColumns().filter((col) => col.id !== kanbanColumnId)
          );
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  /**
   * Moves a column to a new index (1-based for backend).
   * @param boardId Board identifier.
   * @param kanbanColumnId Column identifier.
   * @param targetIndex Zero-based target index (backend expects +1).
   */
  moveKanbanColumn(
    boardId: number,
    kanbanColumnId: number,
    targetIndex: number
  ): Observable<any> {
    const url = `${
      environment.apiUrl + "/boards"
    }/${boardId}/kanbanColumns/move`;
    return this.http.put(url, {
      kanbanColumnId,
      targetPosition: targetIndex + 1,
    });
  }

  /** Optimistically sets column order in signal for instant UI feedback. */
  reorderKanbanColumns(newOrder: KanbanColumn[]): void {
    this._kanbanColumns.set(newOrder);
  }
}
