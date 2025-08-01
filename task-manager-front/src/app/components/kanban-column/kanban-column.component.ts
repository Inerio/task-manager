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
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { TaskDragDropService } from "../../services/task-drag-drop.service";
import { TaskComponent } from "../task/task.component";

/**
 * KanbanColumnComponent: A single kanban column with tasks, drag & drop, and task creation.
 */
@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskComponent],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
})
export class KanbanColumnComponent {
  /** Column title */
  @Input({ required: true }) title!: string;
  /** Kanban column ID */
  @Input({ required: true }) kanbanColumnId!: number;

  /** Services */
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropService = inject(TaskDragDropService);

  /** Form and drag state */
  readonly showForm = signal(false);
  readonly newTask = signal<Partial<Task>>(this.getEmptyTask());
  readonly dragOverIndex = signal<number | null>(null);

  /** All tasks in this column, ordered by position */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  /** Toggle the add-task form */
  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) this.resetForm();
  }

  /** Add a new task to the column */
  addTask(): void {
    const { title, description, dueDate } = this.newTask();
    if (!title || !description) return;
    const taskToCreate: Task = {
      title,
      description,
      completed: false,
      kanbanColumnId: this.kanbanColumnId,
      dueDate: dueDate || null,
    };
    this.taskService.createTask(taskToCreate);
    this.resetForm();
    this.showForm.set(false);
  }

  /** Reset the add-task form */
  private resetForm(): void {
    this.newTask.set(this.getEmptyTask());
  }

  /** Provide an empty new task structure */
  private getEmptyTask(): Partial<Task> {
    return { title: "", description: "", completed: false, dueDate: null };
  }

  /** Update a single field in the new task (safe for null value) */
  updateNewTaskField(field: keyof Task, value: string | null): void {
    this.newTask.set({ ...this.newTask(), [field]: value ?? "" });
  }

  /** Delete all tasks in this column, after confirmation */
  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Delete all tasks",
      `Do you want to delete all tasks from "${this.title}"?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  /** DRAG & DROP: handle drag over dropzone */
  onTaskDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    this.dragDropService.handleTaskDropzoneDragOver(
      event,
      this.kanbanColumnId,
      targetIndex,
      (idx) => this.dragOverIndex.set(idx)
    );
  }

  /** DRAG & DROP: handle leaving a dropzone */
  onTaskDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  /** DRAG & DROP: handle dropping a task */
  async onTaskDrop(event: DragEvent, targetIndex: number): Promise<void> {
    await this.dragDropService.handleTaskDropzoneDrop({
      event,
      targetKanbanColumnId: this.kanbanColumnId,
      targetIndex,
      getAllTasks: () => this.taskService.tasks(),
      getColumnTasks: () => this.filteredTasks(),
      reorderTasks: (tasks) => this.taskService.reorderTasks(tasks),
      updateTask: (id, task) => this.taskService.updateTask(id, task),
    });
    this.dragOverIndex.set(null);
  }

  /** TrackBy function for ngFor/@for */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
