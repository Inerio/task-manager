import { signal, WritableSignal } from "@angular/core";

/* ==== TASK MODEL ==== */

/**
 * Interface representing a task.
 */
export interface Task {
  id?: number;
  title: string;
  description: string;
  completed: boolean;
  kanbanColumnId: number;
  dueDate?: string | null;
  isEditing?: boolean;
  attachments?: string[];
  position?: number;
}

/**
 * Creates a WritableSignal from a plain Task object.
 * Useful for managing local reactive task state.
 */
export function createTaskSignal(task: Task): WritableSignal<Task> {
  return signal({ ...task });
}
