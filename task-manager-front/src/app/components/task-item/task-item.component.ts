import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';

/**
 * Composant représentant une tâche unique.
 * Permet l'affichage, l'édition, la suppression, et la complétion.
 */
@Component({
  selector: 'app-task-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-item.component.html',
  styleUrls: ['./task-item.component.scss'],
})
export class TaskItemComponent {
  /** Tâche à afficher */
  @Input() task!: Task;

  /** Émet lorsqu'une tâche a été supprimée */
  @Output() taskDeleted = new EventEmitter<number>();

  /** Émet lorsqu'une tâche a été modifiée */
  @Output() taskUpdated = new EventEmitter<Task>();

  /** Copie de la tâche pour annulation d'édition */
  originalTask: Task = { ...this.task };

  constructor(private taskService: TaskService) {}

  /** Active le mode édition */
  startEdit(): void {
    this.task.isEditing = true;
    this.originalTask = { ...this.task };
  }

  /** Sauvegarde les modifications */
  saveEdit(): void {
    if (!this.task.title.trim()) return;
    this.task.isEditing = false;
    this.taskUpdated.emit(this.task); // informer le parent de l’update
  }

  /** Annule les modifications */
  cancelEdit(): void {
    this.task.title = this.originalTask.title;
    if ('description' in this.task) {
      this.task.description = this.originalTask.description;
    }
    this.task.isEditing = false;
  }

  /** Supprime la tâche via le service */
  deleteTask(): void {
    if (!this.task.id) {
      console.error('Impossible de supprimer : tâche sans ID.');
      return;
    }

    this.taskService.deleteTask(this.task.id).subscribe({
      next: () => {
        console.log('Tâche supprimée');
        this.taskDeleted.emit(this.task.id);
      },
      error: (err) => {
        console.error('Erreur lors de la suppression :', err);
      },
    });
  }

  /** Bascule l'état terminé / non terminé */
  toggleCompleted(): void {
    const updatedTask = { ...this.task, completed: !this.task.completed };
    this.taskService.updateTask(updatedTask.id!, updatedTask).subscribe({
      next: (task) => {
        this.task = task;
        this.taskUpdated.emit(task);
      },
      error: (err) => console.error('Erreur lors du toggle :', err),
    });
  }
}
