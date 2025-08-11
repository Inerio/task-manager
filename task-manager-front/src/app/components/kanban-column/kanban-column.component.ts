import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  type Signal,
} from "@angular/core";
import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { TaskComponent } from "../task/task.component";
import { TaskFormComponent } from "../task-form/task-form.component";
import { getTaskDragData } from "../../utils/drag-drop-utils";
import { AttachmentService } from "../../services/attachment.service";

/**
 * A single Kanban column: renders its tasks, an add form, and manages DnD.
 */
@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, TaskComponent, TaskFormComponent],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
})
export class KanbanColumnComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;
  @Input() hasAnyTask = false;

  // Services
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly attachmentService = inject(AttachmentService);

  // State signals
  readonly showForm = signal(false);
  readonly editingTask = signal<null | Task>(null);
  readonly dragOverIndex = signal<number | null>(null);
  readonly dropzoneDragOver = signal(false);

  /** Guard against nested dragenter/leaves on children. */
  private dropzoneEnterCount = 0;

  /** Accept dropzone only for tasks coming from another column. */
  private isForeignTaskDrag(): boolean {
    if (!this.dragDropGlobal.isTaskDrag()) return false;
    const ctx = this.dragDropGlobal.currentTaskDrag();
    return !!ctx && ctx.columnId !== this.kanbanColumnId;
  }

  /** Tasks for this column, sorted by position. */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  // ---- OPEN/CLOSE instead of toggle to avoid accidental close on file dialog cancel ----
  openForm(): void {
    if (!this.showForm()) {
      this.showForm.set(true);
      this.editingTask.set(null);
      queueMicrotask(() => {
        const input = document.querySelector(
          '.task-form input.form-control[type="text"]'
        ) as HTMLInputElement | null;
        input?.focus();
      });
    }
  }

  closeForm(): void {
    if (this.showForm()) this.showForm.set(false);
    this.editingTask.set(null);
  }

  /** Called when save from the form is validated. */
  async handleTaskFormSave(payload: TaskWithPendingFiles): Promise<void> {
    const { _pendingFiles = [], ...task } = payload;

    if (!task.title || !task.kanbanColumnId) {
      this.closeForm();
      return;
    }

    try {
      if (!task.id) {
        const created = await this.taskService.createTask(task as Task);

        // Reorder locally so the new task is visually first
        const current = this.filteredTasks();
        const withoutCreated = current.filter((t) => t.id !== created.id);
        const reordered = [
          { ...created, position: 0 },
          ...withoutCreated.map((t, idx) => ({ ...t, position: idx + 1 })),
        ];
        this.taskService.reorderTasks(reordered);
        if (_pendingFiles.length) {
          await Promise.all(
            _pendingFiles.map((f) =>
              this.attachmentService.uploadAttachment(created.id!, f)
            )
          );
          await this.taskService.refreshTaskById(created.id!);
        }
      } else {
        await this.taskService.updateTask(task.id!, task as Task);
        if (_pendingFiles.length) {
          await Promise.all(
            _pendingFiles.map((f) =>
              this.attachmentService.uploadAttachment(task.id!, f)
            )
          );
          await this.taskService.refreshTaskById(task.id!);
        }
      }
    } finally {
      this.closeForm();
    }
  }

  handleTaskFormCancel(): void {
    this.closeForm();
  }

  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Delete all tasks",
      `Do you want to delete all tasks from "${this.title}"?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // ========== DRAG & DROP ==========
  onDropzoneDragEnter(event: DragEvent): void {
    if (!this.isForeignTaskDrag()) {
      this.dropzoneEnterCount = 0;
      this.dropzoneDragOver.set(false);
      return;
    }
    this.dropzoneEnterCount++;
    if (!this.dropzoneDragOver()) this.dropzoneDragOver.set(true);
  }

  onDropzoneDragOver(event: DragEvent): void {
    if (this.isForeignTaskDrag()) {
      event.preventDefault();
      if (!this.dropzoneDragOver()) this.dropzoneDragOver.set(true);
    } else {
      if (this.dropzoneDragOver()) this.dropzoneDragOver.set(false);
    }
  }

  onDropzoneDragLeave(event?: DragEvent): void {
    if (!this.isForeignTaskDrag()) {
      this.dropzoneEnterCount = 0;
      this.dropzoneDragOver.set(false);
      return;
    }
    this.dropzoneEnterCount = Math.max(0, this.dropzoneEnterCount - 1);
    if (this.dropzoneEnterCount === 0) this.dropzoneDragOver.set(false);
  }

  async onDropzoneDrop(event: DragEvent): Promise<void> {
    this.dropzoneEnterCount = 0;
    this.dropzoneDragOver.set(false);
    if (!this.isForeignTaskDrag()) return;
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      return;
    }
    event.preventDefault();
    await this.onTaskDrop(event, 0);
  }

  onTaskDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.dragDropGlobal.isTaskDrag()) {
      this.dragOverIndex.set(targetIndex);
    } else {
      this.dragOverIndex.set(null);
    }
  }

  onTaskDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  async onTaskDrop(event: DragEvent, targetIndex: number): Promise<void> {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      return;
    }
    event.preventDefault();

    const dragData = getTaskDragData(event);
    if (!dragData) return;
    const { taskId, kanbanColumnId: fromColumnId } = dragData;
    if (taskId == null || fromColumnId == null) return;

    const allTasks = this.taskService.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Reorder within the same column
    if (fromColumnId === this.kanbanColumnId) {
      const columnTasks = [...this.filteredTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;
      columnTasks.splice(fromIdx, 1);
      columnTasks.splice(targetIndex, 0, draggedTask);
      const reordered = columnTasks.map((t, idx) => ({ ...t, position: idx }));
      this.taskService.reorderTasks(reordered);
      this.dragOverIndex.set(null);
      this.dragDropGlobal.markTaskDropped(taskId);
      return;
    }

    // Move between columns
    const sourceTasks = allTasks.filter(
      (t) => t.kanbanColumnId === fromColumnId && t.id !== taskId
    );
    const targetTasks = [...this.filteredTasks()];
    const newTask = { ...draggedTask, kanbanColumnId: this.kanbanColumnId };
    targetTasks.splice(targetIndex, 0, newTask);

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
    this.dragDropGlobal.markTaskDropped(taskId);
  }

  async onTaskItemDrop(event: DragEvent, targetIndex: number): Promise<void> {
    await this.onTaskDrop(event, targetIndex);
  }

  /** TrackBy for tasks. */
  trackById(_index: number, task: Task): number | undefined {
    return task.id;
  }
}
