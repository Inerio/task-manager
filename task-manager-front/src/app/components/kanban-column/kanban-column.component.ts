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
 * KanbanColumnComponent: Displays a single kanban column with its tasks,
 * add form, and drag & drop for tasks (modern Angular signal-based).
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

  // --- Services ---
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);

  // --- State ---
  readonly showForm = signal(false);
  readonly newTask = signal<Partial<Task>>(this.getEmptyTask());
  readonly dragOverIndex = signal<number | null>(null);
  readonly dropzoneDragOver = signal(false); // Dropzone highlight for empty column

  /**
   * Computed: List of tasks in this column, sorted by position.
   */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  // --- UI / CRUD ---

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
      `Do you want to delete all tasks from "${this.title}"?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // --- DRAG & DROP: Ultra-modern, robust, strict ---

  /**
   * Handles drag over for the empty column dropzone.
   * Activates highlight only if a task is being dragged.
   */
  onDropzoneDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.dragDropGlobal.isTaskDrag()) {
      if (!this.dropzoneDragOver()) {
        this.dropzoneDragOver.set(true);
      }
    } else {
      if (this.dropzoneDragOver()) this.dropzoneDragOver.set(false);
    }
  }

  /**
   * Cancels dropzone highlight (immediately, robust, counter not needed since
   * the dropzone is only visible when column is empty).
   */
  onDropzoneDragLeave(): void {
    this.dropzoneDragOver.set(false);
  }

  /**
   * Handles drop on the empty column dropzone (always at index 0).
   */
  async onDropzoneDrop(event: DragEvent): Promise<void> {
    this.dropzoneDragOver.set(false);
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      return;
    }
    event.preventDefault();
    await this.onTaskDrop(event, 0);
  }

  /**
   * Handles drag over a task (not dropzone).
   */
  onTaskDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.dragDropGlobal.isTaskDrag()) {
      this.dragOverIndex.set(targetIndex);
    } else {
      this.dragOverIndex.set(null);
    }
  }

  /**
   * Cancels task drag-over highlight.
   */
  onTaskDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  /**
   * Handles drop event on a task or dropzone.
   * - If moving within same column: reorder and sync positions.
   * - If moving between columns: update columnId and reindex both columns.
   */
  async onTaskDrop(event: DragEvent, targetIndex: number): Promise<void> {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      return;
    }
    event.preventDefault();
    this.dropzoneDragOver.set(false);
    const dragData = getTaskDragData(event);
    if (!dragData) return;
    const { taskId, kanbanColumnId: fromColumnId } = dragData;
    if (taskId == null || fromColumnId == null) return;

    // Get all tasks
    const allTasks = this.taskService.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // --- Move within the same column ---
    if (fromColumnId === this.kanbanColumnId) {
      const columnTasks = [...this.filteredTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;
      columnTasks.splice(fromIdx, 1);
      columnTasks.splice(targetIndex, 0, draggedTask);
      const reordered = columnTasks.map((t, idx) => ({ ...t, position: idx }));
      this.taskService.reorderTasks(reordered);
      this.dragOverIndex.set(null);
      return;
    }

    // --- Move to another column ---
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
   * Forwards to main drop handler.
   */
  async onTaskItemDrop(event: DragEvent, targetIndex: number): Promise<void> {
    await this.onTaskDrop(event, targetIndex);
  }

  /** TrackBy for tasks */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
