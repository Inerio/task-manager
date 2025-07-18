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
import { TaskComponent } from "../task/task.component";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { KanbanColumnService } from "../../services/kanban-column.service";
import { KanbanColumn } from "../../models/kanban-column.model";
import { getTaskDragData, isTaskDragEvent } from "../../utils/drag-drop-utils";
import { TaskDragDropService } from "../../services/task-drag-drop.service";

@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskComponent],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
})
export class KanbanColumnComponent {
  // ------------------------------------------
  // INPUTS
  // ------------------------------------------
  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;

  // ------------------------------------------
  // SERVICES
  // ------------------------------------------
  private readonly taskService = inject(TaskService);
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropService = inject(TaskDragDropService);

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
  // DELETE ALL TASKS IN KANBANCOLUMN (button optionnel)
  // ------------------------------------------
  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Suppression de la colonne",
      `Voulez-vous supprimer toutes les tâches de “${this.title}”?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // ------------------------------------------
  // TASK FILTERING (reactive)
  // ------------------------------------------
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
  );

  // ------------------------------------------
  // DRAG & DROP TASKS (pas colonne !)
  // ------------------------------------------
  isDragOver = signal(false);

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
      () => this.taskService.tasks(), // get all tasks (type Task[])
      (id, task) => this.taskService.updateTask(id, task) // update task
    );
  }

  // ------------------------------------------
  // STABLE ITEM TRACKING FOR RENDER PERFORMANCE
  // ------------------------------------------
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
