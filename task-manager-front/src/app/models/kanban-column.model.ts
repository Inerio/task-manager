import type { BoardId } from "./board.model";

/** Distinct alias for column identifiers. */
export type KanbanColumnId = number;

/** Single kanban column within a board. */
export interface KanbanColumn {
  /** Unique identifier (undefined for client-side drafts). */
  id?: KanbanColumnId;

  /** Parent board id (required). */
  boardId: BoardId;

  /** Display name. */
  name: string;

  /** Display order within the board (lower = left). */
  position?: number;
}

/** Creation payload helper (id omitted; position optional for server assignment). */
export type KanbanColumnCreation = Omit<KanbanColumn, "id">;
