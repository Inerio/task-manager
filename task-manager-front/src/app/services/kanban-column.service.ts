import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { KanbanColumn } from "../models/kanban-column.model";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment.local";

@Injectable({ providedIn: "root" })
export class KanbanColumnService {
  // On n'a plus besoin d'une seule URL : elle dépend du board sélectionné
  private readonly _kanbanColumns = signal<KanbanColumn[]>([]);
  readonly kanbanColumns = computed(() => this._kanbanColumns());
  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  constructor(private http: HttpClient) {}

  /** Charge les colonnes pour un board donné ! */
  loadKanbanColumns(boardId: number): void {
    console.log("Reload kanban columns", boardId);
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

  /** Crée une colonne dans le board sélectionné */
  createKanbanColumn(name: string, boardId: number): Observable<KanbanColumn> {
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns`;
    return this.http.post<KanbanColumn>(url, { name });
  }

  /** Update sur la colonne : on va supposer que le boardId est stocké dessus */
  updateKanbanColumn(kanbanColumn: KanbanColumn): Observable<KanbanColumn> {
    if (!kanbanColumn.id) throw new Error("KanbanColumn ID required");
    if (!kanbanColumn.boardId) throw new Error("KanbanColumn boardId required");
    const url = `${environment.apiUrlBoards}/${kanbanColumn.boardId}/kanbanColumns/${kanbanColumn.id}`;
    return this.http.put<KanbanColumn>(url, kanbanColumn);
  }

  /** Suppression */
  deleteKanbanColumn(
    kanbanColumnId: number,
    boardId: number
  ): Observable<void> {
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns/${kanbanColumnId}`;
    return this.http.delete<void>(url);
  }

  /** Déplacement de colonne */
  moveKanbanColumn(
    kanbanColumnId: number,
    targetIndex: number,
    boardId: number
  ): Observable<any> {
    const url = `${environment.apiUrlBoards}/${boardId}/kanbanColumns/move`;
    return this.http.put(url, {
      kanbanColumnId,
      targetPosition: targetIndex + 1,
    });
  }
}
