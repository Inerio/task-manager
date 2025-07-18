import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { KanbanColumn } from "../models/kanban-column.model";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment.local";

@Injectable({ providedIn: "root" })
export class KanbanColumnService {
  private readonly apiUrl = environment.apiUrlKanbanColumns;
  private readonly _kanbanColumns = signal<KanbanColumn[]>([]);
  readonly kanbanColumns = computed(() => this._kanbanColumns());
  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  constructor(private http: HttpClient) {}

  loadKanbanColumns(): void {
    this._loading.set(true);
    this.http.get<KanbanColumn[]>(this.apiUrl).subscribe({
      next: (data) => {
        this._kanbanColumns.set(data ?? []);
      },
      error: () => this._kanbanColumns.set([]),
      complete: () => this._loading.set(false),
    });
  }

  createKanbanColumn(name: string): Observable<KanbanColumn> {
    return this.http.post<KanbanColumn>(this.apiUrl, { name });
  }

  updateKanbanColumn(kanbanColumn: KanbanColumn): Observable<KanbanColumn> {
    if (!kanbanColumn.id) throw new Error("KanbanColumn ID required");
    return this.http.put<KanbanColumn>(
      `${this.apiUrl}/${kanbanColumn.id}`,
      kanbanColumn
    );
  }

  deleteKanbanColumn(kanbanColumnId: number): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.delete<void>(`${this.apiUrl}/${kanbanColumnId}`).subscribe({
        next: () => {
          this._kanbanColumns.set(
            this._kanbanColumns().filter((l) => l.id !== kanbanColumnId)
          );
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  /** Ajoute la méthode pour déplacer une colonne (PUT /kanbanColumns/move) */
  moveKanbanColumn(
    kanbanColumnId: number,
    targetIndex: number
  ): Observable<any> {
    // Correction : JS index (0-based) -> SQL position (1-based)
    return this.http.put(`${this.apiUrl}/move`, {
      kanbanColumnId,
      targetPosition: targetIndex + 1, // <= ajout du +1 ici
    });
  }
}
