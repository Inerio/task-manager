import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  Signal,
  effect,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { TaskItemComponent } from "../task-item/task-item.component";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { TaskListService } from "../../services/task-list.service";
import { TaskList } from "../../models/task-list.model";
import { getTaskDragData, isTaskDragEvent } from "../../utils/drag-drop-utils";
import { TaskDragDropService } from "../../services/task-drag-drop.service";

@Component({
  selector: "app-task-list",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskItemComponent],
  templateUrl: "./task-list.component.html",
  styleUrls: ["./task-list.component.scss"],
})
export class TaskListComponent {
  // ------------------------------------------
  // INPUTS
  // ------------------------------------------
  @Input({ required: true }) title!: string;
  @Input({ required: true }) listId!: number;

  // ------------------------------------------
  // SERVICES
  // ------------------------------------------
  private readonly taskService = inject(TaskService);
  private readonly taskListService = inject(TaskListService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropService = inject(TaskDragDropService);

  // ------------------------------------------
  // LIST TITLE EDITION
  // ------------------------------------------
  isDragOver = signal(false);
  isEditingTitle = signal(false);
  editTitleValue = signal(""); // Holds the editing input value for the list title

  constructor() {
    // Keep edit input in sync when the title changes externally
    effect(() => {
      if (!this.isEditingTitle()) {
        this.editTitleValue.set(this.title);
      }
    });
  }

  startEditTitle() {
    this.editTitleValue.set(this.title);
    this.isEditingTitle.set(true);
    setTimeout(() => {
      // Automatically focus input on edit mode
      const input = document.getElementById(
        `edit-list-title-${this.listId}`
      ) as HTMLInputElement | null;
      if (input) input.focus();
    }, 0);
  }

  saveTitleEdit() {
    const newName = this.editTitleValue().trim();
    // If no change or empty input, just exit edit mode
    if (!newName || newName === this.title) {
      this.isEditingTitle.set(false);
      return;
    }

    // --- Retrieve the current position for this list (needed for backend update) ---
    // We must preserve position, or backend may re-order lists on update.
    const allLists = this.taskListService.lists();
    const currentList = allLists.find((l) => l.id === this.listId);
    const position = currentList?.position ?? 1; // Fallback to 1 if position missing (should not happen)

    // --- Build the update payload, including the position ---
    const list: TaskList = { id: this.listId, name: newName, position };

    // --- Send PUT request to backend with full data (name + position) ---
    this.taskListService.updateList(list).subscribe({
      next: () => {
        this.isEditingTitle.set(false);
        this.taskListService.loadLists(); // Refresh to reflect new name
      },
      error: (err) => {
        alert("Error when renaming list");
        console.error(err);
        this.isEditingTitle.set(false);
      },
    });
  }

  cancelTitleEdit() {
    this.editTitleValue.set(this.title);
    this.isEditingTitle.set(false);
  }

  onEditTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editTitleValue.set(input.value);
  }

  // ------------------------------------------
  // TASK CREATION
  // ------------------------------------------
  showForm = signal(false);
  newTask = signal<Partial<Task>>(this.getEmptyTask());

  toggleForm(): void {
    this.showForm.update((current) => !current);
    if (!this.showForm()) this.resetForm();
  }

  addTask(): void {
    const { title, description, dueDate } = this.newTask();
    if (!title || !description) return;
    const taskToCreate: Task = {
      title,
      description,
      completed: false,
      listId: this.listId,
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
      title: "",
      description: "",
      completed: false,
      dueDate: null,
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

  // ------------------------------------------
  // DELETE LIST / ALL TASKS IN LIST
  // ------------------------------------------
  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Suppression de la colonne",
      `Voulez-vous supprimer toutes les tâches de “${this.title}”?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByListId(this.listId);
  }

  async deleteList(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Suppression de la liste",
      `Voulez-vous supprimer la liste “${this.title}” and all its tasks?`
    );
    if (!confirmed) return;
    this.taskListService.deleteList(this.listId).subscribe({
      next: () => {
        // Signal will auto-update, nothing to do here
      },
      error: (err) => {
        alert("Erreur lors de la suppression de la liste");
        console.error(err);
      },
    });
  }

  // ------------------------------------------
  // TASK FILTERING (reactive)
  // ------------------------------------------
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService.tasks().filter((task) => task.listId === this.listId)
  );

  // ------------------------------------------
  // DRAG & DROP
  // ------------------------------------------

  /**
   * Handles drag over event. Prevents drag animation if dragging a task from the same list.
   * Uses a window global variable for communication between task and list.
   */
  onTaskDragOver(event: DragEvent): void {
    this.dragDropService.handleTaskListDragOver(event, this.listId, (v) =>
      this.isDragOver.set(v)
    );
  }

  onTaskDragLeave(): void {
    this.dragDropService.handleTaskListDragLeave((v) => this.isDragOver.set(v));
  }

  onTaskDrop(event: DragEvent): void {
    this.dragDropService.handleTaskListDrop(
      event,
      this.listId,
      (v) => this.isDragOver.set(v),
      () => this.taskService.tasks(), // get all tasks (type Task[])
      (id, task) => this.taskService.updateTask(id, task) // update task
    );
  }

  // ------------------------------------------
  // STABLE ITEM TRACKING FOR RENDER PERFORMANCE
  // ------------------------------------------
  /**
   * Provides a stable unique identifier for each task.
   * This helps Angular keep track of items efficiently and avoid unnecessary DOM operations
   * when items are added, removed, or reordered—critical for large lists or drag & drop usage.
   */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
