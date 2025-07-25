import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { KanbanColumn } from "../models/kanban-column.model";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment.local";

/* ==== KANBAN COLUMN SERVICE ==== */
@Injectable({ providedIn: "root" })
export class KanbanColumnService {
  // Internal signal for kanban columns (mutable only in service)
  private readonly _kanbanColumns = signal<KanbanColumn[]>([]);
  // Public computed signal for readonly access outside service
  readonly kanbanColumns = computed(() => this._kanbanColumns());

  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  constructor(private http: HttpClient) {}

  /**
   * Loads all columns for the given board.
   */
  loadKanbanColumns(boardId: number): void {
    if (!boardId) {
      this._kanbanColumns.set([]);
      return;
    }
    this._loading.set(true);
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns`;
    this.http.get<KanbanColumn[]>(url).subscribe({
      next: (data) => this._kanbanColumns.set(data ?? []),
      error: () => this._kanbanColumns.set([]),
      complete: () => this._loading.set(false),
    });
  }

  /**
   * Creates a new column in the specified board.
   */
  createKanbanColumn(name: string, boardId: number): Observable<KanbanColumn> {
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns`;
    return this.http.post<KanbanColumn>(url, { name });
  }

  /**
   * Updates an existing column.
   * @throws Error if id or boardId is missing.
   */
  updateKanbanColumn(kanbanColumn: KanbanColumn): Observable<KanbanColumn> {
    if (!kanbanColumn.id) throw new Error("KanbanColumn ID required");
    if (!kanbanColumn.boardId) throw new Error("KanbanColumn boardId required");
    const url = `${environment.apiUrlBoards}/${kanbanColumn.boardId}/kanbanColumns/${kanbanColumn.id}`;
    return this.http.put<KanbanColumn>(url, kanbanColumn);
  }

  /**
   * Deletes a column from the board and updates the local signal for instant UI feedback.
   */
  deleteKanbanColumn(
    kanbanColumnId: number,
    boardId: number
  ): Observable<void> {
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns/${kanbanColumnId}`;
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
   * Moves a column to a new index (1-based) in the board.
   * The backend expects targetPosition = targetIndex + 1
   */
  moveKanbanColumn(
    boardId: number,
    kanbanColumnId: number,
    targetIndex: number
  ): Observable<any> {
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns/move`;
    return this.http.put(url, {
      kanbanColumnId,
      targetPosition: targetIndex + 1,
    });
  }

  /**
   * Optimistically reorder columns locally for instant UI feedback.
   */
  reorderKanbanColumns(newOrder: KanbanColumn[]): void {
    this._kanbanColumns.set(newOrder);
  }
}
