import { Injectable, signal, computed, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TranslocoService } from "@jsverse/transloco";
import { type Board, type BoardId } from "../models/board.model";
import { environment } from "../../environments/environment";
import { Observable, tap, catchError, throwError } from "rxjs";
import { AlertService } from "./alert.service";

/** Boards CRUD + signal state. */
@Injectable({ providedIn: "root" })
export class BoardService {
  // ---- deps ----
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);
  private readonly apiUrl = `${environment.apiUrl}/boards`;

  // ---- state ----
  private readonly _boards = signal<Board[]>([]);
  readonly boards = computed(() => this._boards());

  // ===========================================================================

  /** Load all boards. */
  loadBoards(): void {
    this.http.get<Board[]>(this.apiUrl).subscribe({
      next: (boards) => this._boards.set(boards ?? []),
      error: () => {
        this._boards.set([]);
        this.alert.show("error", this.i18n.translate("errors.loadingBoards"));
      },
    });
  }

  /** Create a board. */
  createBoard(name: string): Observable<Board> {
    return this.http
      .post<Board>(this.apiUrl, { name })
      .pipe(tap((b) => this._boards.update((list) => [...list, b])));
  }

  /** Delete a board. */
  deleteBoard(id: BoardId): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() =>
          this._boards.update((list) => list.filter((b) => b.id !== id))
        )
      );
  }

  /** Update a board's name. */
  updateBoard(id: BoardId, name: string): Observable<Board> {
    return this.http
      .put<Board>(`${this.apiUrl}/${id}`, { name })
      .pipe(
        tap((updated) =>
          this._boards.update((list) =>
            list.map((b) => (b.id === id ? updated : b))
          )
        )
      );
  }

  /** Optimistic reordering (client state only). */
  reorderBoardsLocal(newOrder: ReadonlyArray<Board>): void {
    const normalized = newOrder.map((b, idx) => ({ ...b, position: idx }));
    this._boards.set(normalized);
  }

  /** Persist reordering to backend. */
  reorderBoards(items: { id: number; position: number }[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/reorder`, items).pipe(
      catchError((err) => {
        this.alert.show(
          "error",
          this.i18n.translate("errors.reorderingBoards")
        );
        return throwError(() => err);
      })
    );
  }
}
