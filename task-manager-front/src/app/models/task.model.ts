import { signal, WritableSignal } from '@angular/core';

/**
 * Modèle représentant une tâche dans l'application.
 */
export interface Task {
  id?: number;
  title: string;
  description: string;
  completed: boolean;
  status: string; // 'todo' | 'in-progress' | 'done'
  isEditing?: boolean; // État d'édition (UI uniquement)
}

/**
 * Crée un WritableSignal à partir d'une tâche simple.
 * Utile pour encapsuler une tâche dans un signal local.
 */
export function createTaskSignal(task: Task): WritableSignal<Task> {
  return signal({ ...task });
}
