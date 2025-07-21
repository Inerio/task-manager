import { Injectable, signal, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Board } from "../models/board.model";
import { environment } from "../../environments/environment.local";
import { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class BoardService {
  private readonly apiUrl = environment.apiUrlBoards;
  private readonly _boards = signal<Board[]>([]);
  readonly boards = computed(() => this._boards());

  constructor(private http: HttpClient) {}

  loadBoards(): void {
    this.http.get<Board[]>(this.apiUrl).subscribe({
      next: (boards) => this._boards.set(boards ?? []),
      error: () => this._boards.set([]),
    });
  }

  createBoard(name: string): Observable<Board> {
    return this.http.post<Board>(this.apiUrl, { name });
  }

  deleteBoard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ... add update, getBoardById, etc
}
