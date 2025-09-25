import { Injectable, inject } from "@angular/core";
import { environment } from "../../../../environments/environment";
import { BoardService } from "../../../features/board/data/board.service";
import { KanbanColumnService } from "../../../features/board/data/kanban-column.service";
import { TaskService } from "../../../features/task/data/task.service";
import { readAnonId } from "../../interceptors/anon-id.interceptor";

/**
 * RealtimeService
 * - Manages two EventSource connections:
 *   • global stream (boards.*) scoped by UID
 *   • board stream (columns.changed / tasks.changed) for the active board
 * - On events, it asks the existing services to reload their data.
 */
@Injectable({ providedIn: "root" })
export class RealtimeService {
  private readonly api = environment.apiUrl;

  private readonly boards = inject(BoardService);
  private readonly columns = inject(KanbanColumnService);
  private readonly tasks = inject(TaskService);

  private globalEs: EventSource | null = null;
  private boardEs: EventSource | null = null;
  private activeBoardId: number | null = null;

  /** Start global stream once for the current UID. Safe to call multiple times. */
  connectGlobal(): void {
    if (this.globalEs) return;
    const uid = encodeURIComponent(readAnonId());
    const url = `${this.api}/events?uid=${uid}`;
    const es = new EventSource(url);

    // Boards list changes
    const reloadBoards = () => this.boards.loadBoards();

    es.addEventListener("boards.created", reloadBoards);
    es.addEventListener("boards.updated", reloadBoards);
    es.addEventListener("boards.deleted", reloadBoards);
    es.addEventListener("ping", () => {});

    es.onerror = () => {};

    this.globalEs = es;
  }

  /**
   * Switch the board-scoped SSE to the given board.
   * Passing null closes the current board stream.
   */
  switchBoard(boardId: number | null): void {
    if (this.activeBoardId === boardId) return;
    this.closeBoardStream();

    this.activeBoardId = boardId;
    if (boardId == null) return;

    const uid = encodeURIComponent(readAnonId());
    const url = `${this.api}/events/board/${boardId}?uid=${uid}`;
    const es = new EventSource(url);

    // When columns change, refetch columns for that board
    es.addEventListener("columns.changed", () => {
      this.columns.loadKanbanColumns(boardId);
    });

    // When tasks change, refresh tasks cache (service dedups repeated loads)
    es.addEventListener("tasks.changed", () => {
      this.tasks.loadTasks({ force: true });
    });

    es.addEventListener("ping", () => {});

    es.onerror = () => {};

    this.boardEs = es;
  }

  destroy(): void {
    try {
      this.globalEs?.close();
    } catch {}
    try {
      this.boardEs?.close();
    } catch {}
    this.globalEs = null;
    this.boardEs = null;
    this.activeBoardId = null;
  }

  private closeBoardStream(): void {
    try {
      this.boardEs?.close();
    } catch {}
    this.boardEs = null;
  }
}
