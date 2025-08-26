import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  type Signal,
  effect,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { TaskComponent } from "../task/task.component";
import { TaskFormComponent } from "../task-form/task-form.component";
import { getTaskDragData } from "../../utils/drag-drop-utils";
import { AttachmentService } from "../../services/attachment.service";

/**
 * Kanban column with inter-task dropzones ("slices").
 * Cards are not drop targets → no flicker; preview appears exactly under cursor.
 */
@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, TranslocoModule, TaskComponent, TaskFormComponent],
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
  private readonly i18n = inject(TranslocoService);

  // State signals
  readonly showForm = signal(false);
  readonly editingTask = signal<null | Task>(null);

  /** Live insertion index during dragover (null = no preview). */
  readonly dragOverIndex = signal<number | null>(null);

  /** Slice "hover" state (used for visual guide). */
  readonly hoveredZoneIndex = signal<number | null>(null);

  /** True when a task is currently dragged (used to enable slices). */
  readonly isTaskDragActive = computed(() => this.dragDropGlobal.isTaskDrag());

  /** The actual dragged task object (used to render the ghost preview). */
  readonly ghostTask = computed<Task | null>(() => {
    const ctx = this.dragDropGlobal.currentTaskDrag();
    if (!ctx) return null;
    const all = this.taskService.tasks();
    return all.find((t) => t.id === ctx.taskId) ?? null;
  });

  /** guard to know if we really left the column (not just moving over children) */
  private columnEnterCount = 0;

  constructor() {
    // Clear preview when the drag ends globally.
    effect(() => {
      if (!this.isTaskDragActive()) {
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        this.columnEnterCount = 0;
      }
    });
  }

  /** Tasks for this column, sorted by position. */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  /** Placeholder height: use drag image size when available (fallback = 72px). */
  readonly placeholderHeight = computed(() => {
    const size = this.dragDropGlobal.taskDragPreviewSize();
    return Math.max(48, Math.round(size?.height ?? 72));
  });

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

        if (created.id) {
          setTimeout(() => this.dragDropGlobal.markTaskCreated(created.id!), 0);
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
      this.i18n.translate("boards.column.deleteAllTasksTitle"),
      this.i18n.translate("boards.column.deleteAllTasksConfirm", {
        title: this.title,
      })
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // ====== DRAG & DROP (inter-task dropzones) ======

  /** Track true leave of the whole column (not just child transitions). */
  onColumnDragEnter(_: DragEvent): void {
    if (!this.dragDropGlobal.isTaskDrag()) return;
    this.columnEnterCount++;
  }

  onColumnDragLeave(_: DragEvent): void {
    if (!this.dragDropGlobal.isTaskDrag()) return;
    this.columnEnterCount = Math.max(0, this.columnEnterCount - 1);
    if (this.columnEnterCount === 0) {
      this.dragOverIndex.set(null);
      this.hoveredZoneIndex.set(null);
    }
  }

  /** True if the hovered zone is exactly the dragged card own edges (no-op move). */
  private isSelfEdge(zoneIndex: number): boolean {
    const ctx = this.dragDropGlobal.currentTaskDrag();
    if (!ctx || ctx.columnId !== this.kanbanColumnId) return false;

    const arr = this.filteredTasks();
    const fromIdx = arr.findIndex((t) => t.id === ctx.taskId);
    if (fromIdx === -1) return false;

    // "Before me" == fromIdx, "after me" == fromIdx + 1
    return zoneIndex === fromIdx || zoneIndex === fromIdx + 1;
  }

  /** Hide slices that match the dragged card own edges (remove no-op targets). */
  suppressZone(zoneIndex: number): boolean {
    const ctx = this.dragDropGlobal.currentTaskDrag();
    if (!ctx || ctx.columnId !== this.kanbanColumnId) return false;
    const arr = this.filteredTasks();
    const fromIdx = arr.findIndex((t) => t.id === ctx.taskId);
    return (
      fromIdx !== -1 && (zoneIndex === fromIdx || zoneIndex === fromIdx + 1)
    );
  }

  /**
   * Dragging over a slice (top/bottom half of a card, or head/tail).
   * IMPORTANT: Do not rely on custom DataTransfer in dragover (not stable cross-browser).
   * We rely on the global drag state instead.
   */
  onSliceDragOver(event: DragEvent, zoneIndex: number): void {
    if (!this.dragDropGlobal.isTaskDrag()) return;

    // Ignore real file drags
    if (event.dataTransfer?.types.includes("Files")) return;

    // If hovering the dragged card's own edges, do not show any preview/animation.
    if (this.isSelfEdge(zoneIndex)) {
      event.preventDefault();
      this.hoveredZoneIndex.set(null);
      this.dragOverIndex.set(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Preview must appear exactly under cursor.
    this.hoveredZoneIndex.set(zoneIndex);
    this.dragOverIndex.set(zoneIndex);
  }

  /** Drop on a slice. */
  async onSliceDrop(event: DragEvent, zoneIndex: number): Promise<void> {
    // Ignore non-task drops (files, etc.)
    if (event.dataTransfer?.types.includes("Files")) return;

    if (this.isSelfEdge(zoneIndex)) {
      event.preventDefault();
      this.hoveredZoneIndex.set(null);
      this.dragOverIndex.set(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const dragData = getTaskDragData(event);
    if (!dragData) return;
    const { taskId, kanbanColumnId: fromColumnId } = dragData;

    const insertAt = this.computeInsertIndex(zoneIndex, fromColumnId, taskId);
    await this.onTaskDrop(event, insertAt);
  }

  /** Compute the actual insert index to apply on drop. */
  private computeInsertIndex(
    zoneIndex: number,
    fromColumnId: number,
    taskId: number
  ): number {
    if (fromColumnId !== this.kanbanColumnId) return zoneIndex;
    const arr = this.filteredTasks();
    const fromIdx = arr.findIndex((t) => t.id === taskId);
    if (fromIdx === -1) return zoneIndex;
    return zoneIndex > fromIdx ? zoneIndex - 1 : zoneIndex;
  }

  /** Core drop logic (reorder/move). */
  private async onTaskDrop(
    event: DragEvent,
    targetIndex: number
  ): Promise<void> {
    event.preventDefault();

    const dragData = getTaskDragData(event);
    if (!dragData) return;
    const { taskId, kanbanColumnId: fromColumnId } = dragData;
    if (taskId == null || fromColumnId == null) return;

    const allTasks = this.taskService.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Same-column reorder
    if (fromColumnId === this.kanbanColumnId) {
      const columnTasks = [...this.filteredTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;

      if (targetIndex === fromIdx) {
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        return;
      }

      columnTasks.splice(fromIdx, 1);
      const insertAt = Math.max(0, Math.min(targetIndex, columnTasks.length));
      columnTasks.splice(insertAt, 0, draggedTask);

      const reordered = columnTasks.map((t, idx) => ({ ...t, position: idx }));
      await this.taskService.reorderTasks(reordered);
      this.dragOverIndex.set(null);
      this.hoveredZoneIndex.set(null);
      this.dragDropGlobal.markTaskDropped(taskId);
      return;
    }

    // Move between columns
    const sourceTasks = allTasks.filter(
      (t) => t.kanbanColumnId === fromColumnId && t.id !== taskId
    );
    const targetTasks = [...this.filteredTasks()];
    const newTask = { ...draggedTask, kanbanColumnId: this.kanbanColumnId };
    const insertAt = Math.max(0, Math.min(targetIndex, targetTasks.length));
    targetTasks.splice(insertAt, 0, newTask);

    const reorderedSource = sourceTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));
    const reorderedTarget = targetTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));

    await this.taskService.updateTask(newTask.id!, newTask);
    await this.taskService.reorderTasks(reorderedSource);
    await this.taskService.reorderTasks(reorderedTarget);
    this.dragOverIndex.set(null);
    this.hoveredZoneIndex.set(null);
    this.dragDropGlobal.markTaskDropped(taskId);
  }

  /** TrackBy for tasks. */
  trackById(_index: number, task: Task): number | undefined {
    return task.id;
  }

  /** Template helper for active slice class. */
  sliceIsActive = (zoneIndex: number) => this.hoveredZoneIndex() === zoneIndex;
}
