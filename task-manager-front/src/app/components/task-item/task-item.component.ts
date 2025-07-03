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

@Component({
  selector: 'app-task-item',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './task-item.component.html',
  styleUrls: ['./task-item.component.scss'],
})
export class TaskItemComponent {
  /** Signal représentant la tâche affichée */
  @Input({ required: true }) task!: WritableSignal<Task>;

  /** Signal local servant à stocker une copie de la tâche pour annuler l'édition */
  private originalTask = createTaskSignal({
    title: '',
    description: '',
    completed: false,
    status: '',
  });

  // Déclaration du signal qui indique si la tâche est en cours de drag
  dragging = signal(false);

  private taskService = inject(TaskService);

  constructor() {
    // Réagit aux changements de `task` et synchronise `originalTask` si besoin
    effect(() => {
      const current = this.task();
      if (current?.title) {
        this.originalTask.set({ ...current });
      }
    });
  }

  /** Événement déclenché lors d'un drag */
  onDragStart(event: DragEvent): void {
    if (this.task().isEditing) {
      event.preventDefault();
      return;
    }
    this.dragging.set(true);
    const task = this.task();
    if (!task.id) return;
    event.dataTransfer?.setData('text/plain', task.id.toString());

    // Création d'une image drag personnalisée (clone de la tâche)
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px'; // hors écran pour ne pas perturber la page
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

    // Nettoyage de l'élément après le démarrage du drag
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }

  onDragEnd(): void {
    this.dragging.set(false);
  }

  /** Bascule le statut terminé / non terminé et envoie la mise à jour */
  toggleCompleted(): void {
    const updated = { ...this.task(), completed: !this.task().completed };
    this.task.set(updated);
    this.taskService.updateTask(updated.id!, updated);
  }

  /** Active le mode édition et sauvegarde l'état actuel */
  startEdit(): void {
    const current = this.task();
    this.task.set({ ...current, isEditing: true });
    this.originalTask.set({ ...current });
  }

  /** Sauvegarde les modifications et désactive le mode édition */
  saveEdit(): void {
    const current = this.task();
    if (!current.title.trim()) return;
    this.task.set({ ...current, isEditing: false });
    this.taskService.updateTask(current.id!, this.task());
  }

  /** Annule les modifications en restaurant `originalTask` */
  cancelEdit(): void {
    this.task.set({ ...this.originalTask(), isEditing: false });
  }

  /** Supprime la tâche via le service backend */
  deleteTask(): void {
    const current = this.task();
    if (current.id) this.taskService.deleteTask(current.id);
  }

  /** Met à jour dynamiquement le titre depuis l'input texte */
  updateTitleFromEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.task.set({ ...this.task(), title: value });
  }

  /** Met à jour dynamiquement la description depuis le textarea */
  updateDescriptionFromEvent(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.task.set({ ...this.task(), description: value });
  }
}
