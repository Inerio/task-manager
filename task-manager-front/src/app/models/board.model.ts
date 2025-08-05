/**
 * Represents a kanban board (top-level entity).
 */
export interface Board {
  /** Board identifier (optional for new/unpersisted). */
  id?: number;
  /** Board name (required). */
  name: string;
  /** Optional board description. */
  description?: string;
}
