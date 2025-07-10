import { signal, WritableSignal } from "@angular/core";

/**
 * Interface representing a task in the app.
 */
export interface Task {
  id?: number;
  title: string;
  description: string;
  completed: boolean;
  status: string; // 'todo' | 'in-progress' | 'done'
  dueDate?: string | null;
  isEditing?: boolean; // Edit state (UI only)
  attachments?: string[];
}

/**
 * Utility: creates a WritableSignal from a plain task.
 * Useful for wrapping a task in a local signal.
 */
export function createTaskSignal(task: Task): WritableSignal<Task> {
  return signal({ ...task });
}
