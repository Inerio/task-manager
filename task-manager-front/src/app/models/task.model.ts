/**
 * Interface représentant une tâche de la TODO list.
 */
export interface Task {
  id?: number;
  title: string;
  description: string;
  completed: boolean;
  status: string; // 'todo', 'in-progress', 'done'
  isEditing?: boolean;
}
