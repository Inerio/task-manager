import type { KanbanColumnId } from "./kanban-column.model";

/** Distinct alias for task identifiers. */
export type TaskId = number;

/** Single task entity displayed within a kanban column. */
export interface Task {
  /** Unique identifier (undefined for drafts/new tasks). */
  id?: TaskId;

  /** Parent kanban column identifier (required). */
  kanbanColumnId: KanbanColumnId;

  /** Display order within the column (lower = higher). */
  position?: number;

  /** Title (required). */
  title: string;

  /** Free-text description (may be empty). */
  description: string;

  /** Completion status. */
  completed: boolean;

  /** Due date (ISO `YYYY-MM-DD`) or `null`/`undefined` if not set. */
  dueDate?: string | null;

  /** Filenames associated to this task (as returned by the backend). */
  attachments?: readonly string[];

  /**
   * UI-only flag (not persisted). Used by components to toggle edit mode.
   * Keep this out of API payloads.
   */
  isEditing?: boolean;
}

/**
 * Creation payload helper: commonly sent to POST /tasks.
 * Keeps fields optional when server can default them.
 */
export type TaskCreation = Omit<
  Task,
  "id" | "attachments" | "position" | "completed" | "isEditing"
> & {
  attachments?: string[];
  completed?: boolean;
  position?: number;
};

/** Helper type used by TaskForm to carry yet-to-upload files. */
export type TaskWithPendingFiles = Partial<Task> & {
  _pendingFiles?: readonly File[];
};

/** Narrow runtime check for unknown API data before casting to Task. */
export function isTask(value: unknown): value is Task {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["title"] === "string" &&
    typeof v["kanbanColumnId"] === "number" &&
    typeof v["completed"] === "boolean" &&
    typeof v["description"] === "string"
  );
}
