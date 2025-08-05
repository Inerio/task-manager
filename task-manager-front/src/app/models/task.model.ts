import { signal, WritableSignal } from "@angular/core";

/* ==== TASK MODEL ==== */

/**
 * Represents a single task item in the kanban board.
 */
export interface Task {
  /** Task unique identifier (may be undefined for drafts/new). */
  id?: number;
  /** Title (required, always present in DB). */
  title: string;
  /** Description (required, may be empty). */
  description: string;
  /** Is the task marked as completed? */
  completed: boolean;
  /** Parent kanban column identifier. */
  kanbanColumnId: number;
  /** Due date (YYYY-MM-DD), or null/undefined if not set. */
  dueDate?: string | null;
  /** Edit mode state, local UI only (never from backend). */
  isEditing?: boolean;
  /** Filenames of attachments. */
  attachments?: string[];
  /** Position in column (0-based or 1-based as per backend). */
  position?: number;
}

/**
 * Helper: returns a reactive signal from a Task object.
 * Useful for local editing or derived state in components.
 */
export function createTaskSignal(task: Task): WritableSignal<Task> {
  return signal({ ...task });
}
