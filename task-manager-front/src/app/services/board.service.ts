import { Injectable, signal, computed, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { type Board, type BoardId } from "../models/board.model";
import { environment } from "../../environments/environment.local";
import { Observable, tap } from "rxjs";
import { AlertService } from "./alert.service";

/** Boards CRUD + signal state. */
@Injectable({ providedIn: "root" })
export class BoardService {
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);
  private readonly apiUrl = environment.apiUrl + "/boards";

  /** Workspace boards state. */
  private readonly _boards = signal<Board[]>([]);
  readonly boards = computed(() => this._boards());

  /** Load all boards. */
  loadBoards(): void {
    this.http.get<Board[]>(this.apiUrl).subscribe({
      next: (boards) => this._boards.set(boards ?? []),
      error: () => {
        this._boards.set([]);
        this.alert.show("error", "Error loading boards.");
      },
    });
  }

  /** Create a board (optimistic append). */
  createBoard(name: string): Observable<Board> {
    return this.http
      .post<Board>(this.apiUrl, { name })
      .pipe(tap((b) => this._boards.update((list) => [...list, b])));
  }

  /** Delete a board (optimistic remove). */
  deleteBoard(id: BoardId): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() =>
          this._boards.update((list) => list.filter((b) => b.id !== id))
        )
      );
  }

  /** Update a board's name (optimistic replace). */
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
}
