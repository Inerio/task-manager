import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  Signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { TaskItemComponent } from "../task-item/task-item.component";

@Component({
  selector: "app-task-list",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskItemComponent],
  templateUrl: "./task-list.component.html",
  styleUrls: ["./task-list.component.scss"],
})
export class TaskListComponent {
  // --------------------------------------------------------------------
  // [STATE & SIGNALS]
  // --------------------------------------------------------------------
  @Input({ required: true }) title!: string;
  @Input({ required: true }) status!: "todo" | "in-progress" | "done";

  private taskService = inject(TaskService);

  /** Show/hide the add form */
  showForm = signal(false);

  /** Temp data for new task creation */
  newTask = signal<Partial<Task>>(this.getEmptyTask());

  /** Is a drag-over animation active? */
  isDragOver = signal(false);

  /** Filtered tasks for this column (signal, auto-reactive) */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService.getTasksByStatus(this.status)()
  );

  // --------------------------------------------------------------------
  // [FORM LOGIC]
  // --------------------------------------------------------------------
  /** Toggle the add-task form */
  toggleForm(): void {
    this.showForm.update((current) => !current);
    if (!this.showForm()) this.resetForm();
  }

  /** Add a new task to this column */
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

  /** Resets the add-task form */
  private resetForm(): void {
    this.newTask.set(this.getEmptyTask());
  }

  /** Template for an empty task */
  private getEmptyTask(): Partial<Task> {
    return {
      title: "",
      description: "",
      completed: false,
    };
  }

  /** Input update methods */
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

  // --------------------------------------------------------------------
  // [COLUMN ACTIONS]
  // --------------------------------------------------------------------
  /** Delete all tasks in this column */
  deleteAllInColumn(): void {
    const confirmed = confirm(
      `Supprimer toutes les tâches de "${this.title}" ?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByStatus(this.status);
  }

  // --------------------------------------------------------------------
  // [DRAG & DROP - TASKS]
  // --------------------------------------------------------------------
  /** Drag-over: only activates for tasks */
  onTaskDragOver(event: DragEvent): void {
    // Ignore file drops
    if (event.dataTransfer && event.dataTransfer.types.includes("Files")) {
      return;
    }
    // Get the globally tracked status
    const sourceStatus = (window as any).CURRENT_DRAGGED_TASK_STATUS;
    if (sourceStatus === this.status) {
      this.isDragOver.set(false);
      return;
    }
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onTaskDragLeave(): void {
    this.isDragOver.set(false);
  }

  /** Drop a task (change its column/status) */
  onTaskDrop(event: DragEvent): void {
    if (event.dataTransfer && event.dataTransfer.types.includes("Files")) {
      this.isDragOver.set(false);
      return;
    }
    event.preventDefault();
    this.isDragOver.set(false);
    const taskId = event.dataTransfer?.getData("text/plain");
    if (!taskId) return;
    const id = parseInt(taskId, 10);
    const allTasks = this.taskService.tasks();
    const task = allTasks.find((t) => t.id === id);
    if (!task || task.status === this.status) return;
    const updatedTask = { ...task, status: this.status };
    this.taskService.updateTask(updatedTask.id!, updatedTask);
  }

  // --------------------------------------------------------------------
  // [TEMPLATE UTILS]
  // --------------------------------------------------------------------
  /** TrackBy for *ngFor / @for loops */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
