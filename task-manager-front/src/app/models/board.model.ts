/**
 * Board domain model (top-level aggregate).
 */
export type BoardId = number;

/**
 * Represents a kanban board.
 */
export interface Board {
  /** Unique identifier (undefined for new/not yet persisted). */
  id?: BoardId;
  /** Board name (required). */
  name: string;
  /** Optional board description. */
  description?: string;
}

/**
 * Convenience type for creation payloads (POST).
 */
export type BoardCreation = Omit<Board, "id">;
