import type { BoardId } from "./board.model";

/**
 * Distinct alias for column identifiers.
 */
export type KanbanColumnId = number;

/**
 * Represents a single kanban column within a board.
 */
export interface KanbanColumn {
  /** Unique identifier (undefined for client-side drafts). */
  id?: KanbanColumnId;
  /** Parent board id (required). */
  boardId: BoardId;
  /** Display name of the column. */
  name: string;
  /** Display order within the board (lower = left). */
  position?: number;
}

/**
 * Creation payload helper (id is omitted; position optional for server-side assignment).
 */
export type KanbanColumnCreation = Omit<KanbanColumn, "id">;
