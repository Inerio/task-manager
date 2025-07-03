import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  WritableSignal,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Task, createTaskSignal } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { TaskItemComponent } from '../task-item/task-item.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskItemComponent],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss'],
})
export class TaskListComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) status!: 'todo' | 'in-progress' | 'done';

  private taskService = inject(TaskService);

  showForm = signal(false);
  newTask = signal<Partial<Task>>(this.getEmptyTask());

  /** Liste des tâches converties en signaux individuels */
  taskSignals: WritableSignal<Task>[] = [];

  constructor() {
    // Charge les tâches du statut courant et les transforme en signaux
    effect(() => {
      const filtered = this.taskService.getTasksByStatus(this.status)();
      this.taskSignals = filtered.map(createTaskSignal);
    });
  }

  /** Bascule le formulaire d'ajout */
  toggleForm(): void {
    this.showForm.update((current) => !current);
    if (!this.showForm()) this.resetForm();
  }

  /** Crée une nouvelle tâche dans la bonne colonne */
  addTask(): void {
    const { title, description } = this.newTask();
    if (!title || !description) return;

    const taskToCreate: Task = {
      title,
      description,
      completed: false,
      status: this.status,
    };

    this.taskService.createTask(taskToCreate);
    this.resetForm();
    this.showForm.set(false);
  }

  private resetForm(): void {
    this.newTask.set(this.getEmptyTask());
  }

  private getEmptyTask(): Partial<Task> {
    return {
      title: '',
      description: '',
      completed: false,
    };
  }

  /** Liaison de champ : titre */
  updateNewTaskTitle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.newTask.set({ ...this.newTask(), title: target.value });
  }

  /** Liaison de champ : description */
  updateNewTaskDescription(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.newTask.set({ ...this.newTask(), description: target.value });
  }

  /** TrackBy pour éviter les re-render */
  trackById(
    index: number,
    taskSignal: WritableSignal<Task>,
  ): number | undefined {
    return taskSignal().id;
  }
}
