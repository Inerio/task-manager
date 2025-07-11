import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TaskListComponent } from "./components/task-list/task-list.component";
import { TaskListService } from "./services/task-list.service";
import { TaskService } from "./services/task.service";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { ConfirmDialogService } from "./services/confirm-dialog.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    CommonModule,
    TaskListComponent,
    AlertComponent,
    ConfirmDialogComponent,
  ],
})
export class AppComponent {
  // ----------- SERVICES (Dependency Injection) -----------
  private readonly taskListService = inject(TaskListService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  // ----------- STATE / SIGNALS -----------
  readonly lists = this.taskListService.lists; // All kanban lists (reactive)
  readonly loading = this.taskListService.loading; // Loading state for lists
  showAddListForm = false; // Toggle for add-list form
  newListName = signal(""); // Input value for new list

  // ----------- LIFECYCLE -----------
  constructor() {
    // Load lists and tasks at startup
    this.taskListService.loadLists();
    this.taskService.loadTasks();
  }

  // ----------- UI EVENT HANDLERS -----------

  /**
   * Update the input signal for the new list name.
   */
  onListNameInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input) {
      this.newListName.set(input.value);
    }
  }

  /**
   * Add a new kanban list/column.
   */
  addList(): void {
    const value = this.newListName().trim();
    if (!value) return;
    this.taskListService.createList(value).subscribe({
      next: () => {
        this.taskListService.loadLists();
        this.newListName.set("");
        this.showAddListForm = false;
      },
      // No error handling: backend returns error if list name invalid/duplicate
    });
  }

  /**
   * Delete all tasks in all lists (with confirmation dialog).
   */
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
