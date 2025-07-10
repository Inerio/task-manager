import { Component } from "@angular/core";
import { TaskListComponent } from "./components/task-list/task-list.component";
import { TaskService } from "./services/task.service";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { ConfirmDialogService } from "./services/confirm-dialog.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [TaskListComponent, AlertComponent, ConfirmDialogComponent],
})
export class AppComponent {
  constructor(
    private taskService: TaskService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.taskService.loadTasks();
  }

  /** Delete all tasks after user confirmation */
  async deleteAllTasks(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Suppression globale",
      "Voulez-vous vraiment supprimer toutes les tâches ?"
    );
    if (!confirmed) return;

    this.taskService.deleteAllTasks().subscribe({
      next: () => this.taskService.loadTasks(),
      error: (err) => console.error("Delete error:", err),
    });
  }
}
