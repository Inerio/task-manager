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
import { TaskComponent } from "../task/task.component";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { KanbanColumnService } from "../../services/kanban-column.service";
import { TaskDragDropService } from "../../services/task-drag-drop.service";

/* ==== KANBAN COLUMN COMPONENT ==== */
@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskComponent],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
})
export class KanbanColumnComponent {
  /* ==== INPUTS ==== */
  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;

  /* ==== SERVICES ==== */
  private readonly taskService = inject(TaskService);
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropService = inject(TaskDragDropService);

  /* ==== STATE ==== */
  readonly showForm = signal(false);
  readonly isDragOver = signal(false);
  readonly newTask = signal<Partial<Task>>(this.getEmptyTask());

  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
  );

  /* ==== TASK CREATION ==== */
  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) this.resetForm();
  }

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

  updateNewTaskField(field: keyof Task, value: string | null): void {
    this.newTask.set({ ...this.newTask(), [field]: value ?? "" });
  }

  /* ==== DELETE ==== */
  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Delete all tasks",
      `Do you want to delete all tasks from “${this.title}”?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  /* ==== DRAG & DROP ==== */
  onTaskDragOver(event: DragEvent): void {
    this.dragDropService.handleKanbanColumnDragOver(
      event,
      this.kanbanColumnId,
      (v) => this.isDragOver.set(v)
    );
  }

  onTaskDragLeave(): void {
    this.dragDropService.handleKanbanColumnDragLeave((v) =>
      this.isDragOver.set(v)
    );
  }

  onTaskDrop(event: DragEvent): void {
    this.dragDropService.handleKanbanColumnDrop(
      event,
      this.kanbanColumnId,
      (v) => this.isDragOver.set(v),
      () => this.taskService.tasks(),
      (id, task) => this.taskService.updateTask(id, task)
    );
  }

  /* ==== TRACKING ==== */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
