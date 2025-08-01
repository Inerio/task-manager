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

@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskComponent],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
})
export class KanbanColumnComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;

  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropService = inject(TaskDragDropService);

  readonly showForm = signal(false);
  readonly newTask = signal<Partial<Task>>(this.getEmptyTask());
  readonly dragOverIndex = signal<number | null>(null);

  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

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
    return { title: "", description: "", completed: false, dueDate: null };
  }

  updateNewTaskField(field: keyof Task, value: string | null): void {
    this.newTask.set({ ...this.newTask(), [field]: value ?? "" });
  }

  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Delete all tasks",
      `Do you want to delete all tasks from “${this.title}”?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // === Drag & Drop handlers ===
  onTaskDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault(); // Critique : sinon drop jamais appelé
    this.dragDropService.handleTaskDropzoneDragOver(
      event,
      this.kanbanColumnId,
      targetIndex,
      (idx) => this.dragOverIndex.set(idx)
    );
  }

  onTaskDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  async onTaskDrop(event: DragEvent, targetIndex: number): Promise<void> {
    await this.dragDropService.handleTaskDropzoneDrop({
      event,
      targetKanbanColumnId: this.kanbanColumnId,
      targetIndex,
      getAllTasks: () => this.taskService.tasks(),
      getColumnTasks: () => this.filteredTasks(),
      reorderTasks: (tasks) => this.taskService.reorderTasks(tasks),
      updateTask: (id, task) => this.taskService.updateTask(id, task), // Maintenant retourne une Promise
    });
    this.dragOverIndex.set(null);
  }

  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
