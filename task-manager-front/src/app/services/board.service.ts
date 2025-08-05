import { Injectable, signal, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Board } from "../models/board.model";
import { environment } from "../../environments/environment.local";
import { Observable } from "rxjs";

/** Service for managing boards (CRUD, signal-based state). */
@Injectable({ providedIn: "root" })
export class BoardService {
  private readonly apiUrl = environment.apiUrl + "/boards";

  /** All boards in workspace (reactive signal). */
  private readonly _boards = signal<Board[]>([]);
  readonly boards = computed(() => this._boards());

  constructor(private http: HttpClient) {}

  /** Loads all boards from backend. */
  loadBoards(): void {
    this.http.get<Board[]>(this.apiUrl).subscribe({
      next: (boards) => this._boards.set(boards ?? []),
      error: () => this._boards.set([]),
    });
  }

  /** Creates a new board. */
  createBoard(name: string): Observable<Board> {
    return this.http.post<Board>(this.apiUrl, { name });
  }

  /** Deletes a board by id. */
  deleteBoard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Updates a board's name. */
  updateBoard(id: number, name: string): Observable<Board> {
    return this.http.put<Board>(`${this.apiUrl}/${id}`, { name });
  }
}
