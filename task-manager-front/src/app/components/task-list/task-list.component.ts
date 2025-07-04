import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
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

  isDragOver = signal(false);

  /** Signal des tâches filtrées, à utiliser directement dans le HTML */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService.getTasksByStatus(this.status)(),
  );

  /** Bascule le formulaire d'ajout */
  toggleForm(): void {
    this.showForm.update((current) => !current);
    if (!this.showForm()) this.resetForm();
  }

  /** Crée une nouvelle tâche dans la bonne colonne */
  addTask(): void {
    const { title, description, dueDate } = this.newTask();
    if (!title || !description) return;

    const taskToCreate: Task = {
      title,
      description,
      completed: false,
      status: this.status,
      dueDate: dueDate || null,
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

  updateNewTaskTitle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.newTask.set({ ...this.newTask(), title: target.value });
  }

  updateNewTaskDescription(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.newTask.set({ ...this.newTask(), description: target.value });
  }

  updateNewTaskDueDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.newTask.set({ ...this.newTask(), dueDate: value });
  }

  // Drag & Drop
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }
  onDragLeave(): void {
    this.isDragOver.set(false);
  }
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const taskId = event.dataTransfer?.getData('text/plain');
    if (!taskId) return;
    const id = parseInt(taskId, 10);
    const allTasks = this.taskService.tasks(); // global
    const task = allTasks.find((t) => t.id === id);
    if (!task || task.status === this.status) return;
    const updatedTask = { ...task, status: this.status };
    this.taskService.updateTask(updatedTask.id!, updatedTask);
  }

  /** TrackBy pour @for */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
