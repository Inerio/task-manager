import { Component } from "@angular/core";
import { TaskListComponent } from "./components/task-list/task-list.component";
import { TaskService } from "./services/task.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [TaskListComponent],
})
export class AppComponent {
  constructor(private taskService: TaskService) {
    this.taskService.loadTasks();
  }

  /** Delete all tasks after user confirmation */
  deleteAllTasks(): void {
    const confirmed = confirm("Confirm deletion of all tasks?");
    if (!confirmed) return;

    this.taskService.deleteAllTasks().subscribe({
      next: () => this.taskService.loadTasks(),
      error: (err) => console.error("Delete error:", err),
    });
  }
}
