// import { signal, WritableSignal } from '@angular/core';
import type { KanbanColumnId } from "./kanban-column.model";

/** Distinct alias for task identifiers. */
export type TaskId = number;

/**
 * Represents a single task in a kanban column.
 */
export interface Task {
  /** Unique identifier (undefined for drafts). */
  id?: TaskId;
  /** Title (required). */
  title: string;
  /** Free-text description (may be empty). */
  description: string;
  /** Completion status. */
  completed: boolean;
  /** Parent kanban column identifier. */
  kanbanColumnId: KanbanColumnId;
  /** Due date in ISO format (YYYY-MM-DD) or null if not set. */
  dueDate?: string | null;
  /**
   * UI-only flag used by components (never persisted).
   * Prefer keeping this out of API payloads.
   */
  isEditing?: boolean;
  /** Filenames associated to this task (as returned by the backend). */
  attachments?: readonly string[];
  /** Position inside the column (0/1-based depending on backend). */
  position?: number;
}

/**
 * Creation payload helper: shape commonly sent to POST /tasks.
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

/**
 * Helper type used by the TaskForm to carry yet-to-upload files.
 */
export type TaskWithPendingFiles = Partial<Task> & { _pendingFiles?: File[] };

/**
 * Type guard for runtime safety when consuming unknown API responses.
 */
export function isTask(value: unknown): value is Task {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["title"] === "string" && typeof v["kanbanColumnId"] === "number"
  );
}

/**
 * @deprecated Prefer using Angular's `signal()` directly in the component
 * that needs it, e.g. `const s = signal(task);`. Keeping this for backward
 * compatibility; safe to remove once no call sites remain.
 */
// export function createTaskSignal(task: Task): WritableSignal<Task> {
//   return signal({ ...task });
// }
