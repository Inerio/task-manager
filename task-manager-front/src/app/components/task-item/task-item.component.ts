import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-item',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './task-item.component.html',
  styleUrls: ['./task-item.component.scss'],
})
export class TaskItemComponent implements OnChanges {
  /** On reçoit un objet Task (pas un signal !) */
  @Input({ required: true }) task!: Task;

  /** Signal local pour rendre la tâche réactive dans le composant */
  readonly localTask: WritableSignal<Task> = signal({} as Task);

  dragging = signal(false);

  private taskService = inject(TaskService);

  constructor() {
    // Force la resynchro du signal local sur l'input (cf ngOnChanges)
    effect(() => {
      // Cela forcera la recompute de dueBadge
      this.localTask();
    });
  }

  /** Badge d'échéance, toujours calculé depuis le signal local */
  dueBadge = computed(() => {
    const due = this.localTask().dueDate;
    if (!due) return null;
    const dueDate = new Date(due);
    const now = new Date();
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'En retard !';
    if (diffDays === 0) return 'Dernier jour !';
    if (diffDays === 1) return '1 jour restant';
    return `${diffDays} jours restants`;
  });

  ngOnChanges(changes: SimpleChanges): void {
    // Reconstruit le signal local à chaque changement du @Input
    if (changes['task'] && this.task) {
      this.localTask.set({ ...this.task });
    }
  }

  onDragStart(event: DragEvent): void {
    if (this.localTask().isEditing) {
      event.preventDefault();
      return;
    }
    this.dragging.set(true);
    const task = this.localTask();
    if (!task.id) return;
    event.dataTransfer?.setData('text/plain', task.id.toString());

    // Drag image visuel
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.padding = '0.5rem 1rem';
    dragImage.style.background = 'white';
    dragImage.style.border = '1px solid #ccc';
    dragImage.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
    dragImage.style.borderRadius = '4px';
    dragImage.style.fontWeight = 'bold';
    dragImage.style.fontSize = '1rem';
    dragImage.innerText = task.title;
    document.body.appendChild(dragImage);
    event.dataTransfer?.setDragImage(dragImage, 10, 10);
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }

  onDragEnd(): void {
    this.dragging.set(false);
  }

  toggleCompleted(): void {
    const updated = {
      ...this.localTask(),
      completed: !this.localTask().completed,
    };
    this.localTask.set(updated);
    this.taskService.updateTask(updated.id!, updated);
  }

  startEdit(): void {
    const current = this.localTask();
    this.localTask.set({ ...current, isEditing: true });
  }

  saveEdit(): void {
    const current = this.localTask();
    if (!current.title.trim()) return;
    this.localTask.set({ ...current, isEditing: false });
    this.taskService.updateTask(current.id!, this.localTask());
  }

  cancelEdit(): void {
    // Reset aux dernières valeurs du parent
    this.localTask.set({ ...this.task, isEditing: false });
  }

  deleteTask(): void {
    const current = this.localTask();
    if (current.id) this.taskService.deleteTask(current.id);
  }

  updateTitleFromEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localTask.set({ ...this.localTask(), title: value });
  }

  updateDescriptionFromEvent(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.localTask.set({ ...this.localTask(), description: value });
  }

  updateDueDateFromEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.localTask.set({ ...this.localTask(), dueDate: value });
  }
}
