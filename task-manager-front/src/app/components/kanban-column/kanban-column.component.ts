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
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { TaskComponent } from "../task/task.component";
import { getTaskDragData } from "../../utils/drag-drop-utils";

/**
 * KanbanColumnComponent: Displays a single kanban column with task list, add form, and drag & drop for tasks.
 */
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
  private readonly dragDropGlobal = inject(DragDropGlobalService);

  /** Show/hide the add-task form */
  readonly showForm = signal(false);
  readonly newTask = signal<Partial<Task>>(this.getEmptyTask());
  readonly dragOverIndex = signal<number | null>(null);
  readonly dropzoneDragOver = signal(false); // << Dropzone animation state

  /** Computed list of tasks belonging to this column, sorted by position */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  /** Show/hide the add form, reset fields if closed */
  toggleForm(): void {
    this.showForm.update((v) => !v);
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
      kanbanColumnId: this.kanbanColumnId,
      dueDate: dueDate || null,
    };
    this.taskService.createTask(taskToCreate);
    this.resetForm();
    this.showForm.set(false);
  }

  /** Resets the add form fields */
  private resetForm(): void {
    this.newTask.set(this.getEmptyTask());
  }

  private getEmptyTask(): Partial<Task> {
    return { title: "", description: "", completed: false, dueDate: null };
  }

  /** Handles form field update (for 2-way binding) */
  updateNewTaskField(field: keyof Task, value: string | null): void {
    this.newTask.set({ ...this.newTask(), [field]: value ?? "" });
  }

  /** Delete all tasks in this column after confirmation */
  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Delete all tasks",
      `Do you want to delete all tasks from "${this.title}"?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // === DRAG & DROP ===

  /** Handle drag over for the empty column dropzone */
  onDropzoneDragOver(event: DragEvent): void {
    event.preventDefault();
    // Only react if a task is being dragged (never column or file)
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      this.dropzoneDragOver.set(false);
      return;
    }
    if (!this.dropzoneDragOver()) this.dropzoneDragOver.set(true);
  }

  /** Reset dropzone drag-over state on leave */
  onDropzoneDragLeave(): void {
    if (this.dropzoneDragOver()) this.dropzoneDragOver.set(false);
  }

  /** Handle drop on the empty dropzone (always index 0) */
  async onDropzoneDrop(event: DragEvent): Promise<void> {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    )
      return;
    event.preventDefault();
    this.dropzoneDragOver.set(false);
    await this.onTaskDrop(event, 0);
  }

  /**
   * Handle drag over a task (not the dropzone)
   */
  onTaskDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    // Only for task drag
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    )
      return;
    this.dragOverIndex.set(targetIndex);
  }

  /** Reset drag-over visual state on leave (for tasks) */
  onTaskDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  /**
   * Handle drop event: reorders tasks in this column, or moves from another column.
   * @param event DragEvent
   * @param targetIndex Drop index in the list
   */
  async onTaskDrop(event: DragEvent, targetIndex: number): Promise<void> {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    )
      return;
    event.preventDefault();
    this.dropzoneDragOver.set(false); // always reset
    const dragData = getTaskDragData(event);
    if (!dragData) return;
    const { taskId, kanbanColumnId: fromColumnId } = dragData;
    if (taskId == null || fromColumnId == null) return;

    // Find the dragged task
    const allTasks = this.taskService.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // === Move within the same column ===
    if (fromColumnId === this.kanbanColumnId) {
      const columnTasks = [...this.filteredTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;
      columnTasks.splice(fromIdx, 1);
      columnTasks.splice(targetIndex, 0, draggedTask);
      // Update positions and sync with backend
      const reordered = columnTasks.map((t, idx) => ({ ...t, position: idx }));
      this.taskService.reorderTasks(reordered);
      this.dragOverIndex.set(null);
      return;
    }

    // === Move to another column ===
    const sourceTasks = allTasks.filter(
      (t) => t.kanbanColumnId === fromColumnId && t.id !== taskId
    );
    const targetTasks = [...this.filteredTasks()];
    const newTask = { ...draggedTask, kanbanColumnId: this.kanbanColumnId };
    targetTasks.splice(targetIndex, 0, newTask);

    // Reindex both columns and sync backend
    const reorderedSource = sourceTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));
    const reorderedTarget = targetTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));

    await this.taskService.updateTask(newTask.id!, newTask);
    this.taskService.reorderTasks(reorderedSource);
    this.taskService.reorderTasks(reorderedTarget);
    this.dragOverIndex.set(null);
  }

  /**
   * Receives task drop event from child task component.
   * Forwards to the main drop handler.
   */
  async onTaskItemDrop(event: DragEvent, targetIndex: number): Promise<void> {
    await this.onTaskDrop(event, targetIndex);
  }

  /** TrackBy function for task rendering */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
