/**
 * Represents a single kanban column within a board.
 */
export interface KanbanColumn {
  /** Column identifier (undefined for client-side new columns). */
  id?: number;
  /** Parent board ID (always required). */
  boardId: number;
  /** Name of the column. */
  name: string;
  /** Optional position (order in board). */
  position?: number;
}
