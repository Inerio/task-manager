import { Component } from '@angular/core';
import { TaskListComponent } from './components/task-list/task-list.component';
import { TaskService } from './services/task.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [TaskListComponent],
})
export class AppComponent {
  constructor(private taskService: TaskService) {}

  /** Supprime toutes les tâches après confirmation */
  deleteAllTasks(): void {
    const confirmed = confirm(
      'Confirmer la suppression de toutes les tâches ?',
    );
    if (!confirmed) return;

    this.taskService.deleteAllTasks().subscribe({
      next: () => this.taskService.loadTasks(),
      error: (err) => console.error('Erreur suppression :', err),
    });
  }
}
