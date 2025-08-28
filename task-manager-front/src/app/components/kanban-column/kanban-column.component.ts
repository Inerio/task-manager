import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  type Signal,
  effect,
  ViewChild,
  afterNextRender,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { TaskComponent } from "../task/task.component";
import { TaskFormComponent } from "../task-form/task-form.component";
import { getTaskDragData, isFileDragEvent } from "../../utils/drag-drop-utils";
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
  // ===== Inputs =====
  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;
  @Input() hasAnyTask = false;

  // ===== Child refs =====
  @ViewChild(TaskFormComponent) private taskForm?: TaskFormComponent;

  // ===== Injections =====
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly i18n = inject(TranslocoService);

  // ===== UI state =====
  readonly showForm = signal(false);
  readonly editingTask = signal<null | Task>(null);
  readonly dragOverIndex = signal<number | null>(null);
  readonly hoveredZoneIndex = signal<number | null>(null);

  /** Animate placeholder only on first entry from another column. */
  readonly animateOnEnter = signal(false);

  // ===== Derived =====
  readonly isTaskDragActive = computed(() => this.dragDropGlobal.isTaskDrag());

  /** The dragged task object (for ghost preview). */
  readonly ghostTask = computed<Task | null>(() => {
    const ctx = this.dragDropGlobal.currentTaskDrag();
    if (!ctx) return null;
    const all = this.taskService.tasks();
    return all.find((t) => t.id === ctx.taskId) ?? null;
  });

  /** Guard to differentiate true leave vs. bubbling from children. */
  private columnEnterCount = 0;

  /** Tasks for this column, sorted by position. */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  /**
   * Visible order during dragover. We reorder *only* for same-column drags,
   * so cards already shift into their final position before drop.
   * (When dragging from another column, the placeholder alone is enough.)
   */
  readonly displayedTasks: Signal<Task[]> = computed(() => {
    const base = this.filteredTasks();
    const zone = this.dragOverIndex();
    if (zone == null) return base;

    const ctx = this.dragDropGlobal.currentTaskDrag();
    if (!ctx || ctx.columnId !== this.kanbanColumnId) return base;

    const fromIdx = base.findIndex((t) => t.id === ctx.taskId);
    if (fromIdx === -1) return base;

    const insertAt = this.computeInsertIndex(zone, ctx.columnId, ctx.taskId);
    if (insertAt === fromIdx) return base;

    const copy = base.slice();
    const [dragged] = copy.splice(fromIdx, 1);
    // Clamp to bounds; defensive in case of transient indices.
    const clamped = Math.max(0, Math.min(insertAt, copy.length));
    copy.splice(clamped, 0, dragged);
    return copy;
  });

  /** Placeholder height uses drag preview size when available. */
  readonly placeholderHeight = computed(() => {
    const size = this.dragDropGlobal.taskDragPreviewSize();
    return Math.max(48, Math.round(size?.height ?? 72));
  });

  // ===== Effects =====
  constructor() {
    // Clear preview when the drag ends globally.
    effect(() => {
      if (!this.isTaskDragActive()) {
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        this.columnEnterCount = 0;
        this.animateOnEnter.set(false);
      }
    });

    // Ensure only ONE column shows a placeholder at any time.
    // If another column becomes hovered, immediately clear this one.
    effect(() => {
      if (!this.isTaskDragActive()) return;
      const hoveredCol = this.dragDropGlobal.hoveredTaskColumnId();
      if (hoveredCol !== this.kanbanColumnId && this.dragOverIndex() !== null) {
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        this.animateOnEnter.set(false);
        this.columnEnterCount = 0;
      }
    });
  }

  // ===== Form actions =====
  /** Open instead of toggle to avoid accidental close on file dialog cancel. */
  openForm(): void {
    if (this.showForm()) return;
    this.showForm.set(true);
    this.editingTask.set(null);

    // Focus the title after the form has been rendered.
    afterNextRender(() => this.taskForm?.focusTitle());
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

        // Reorder locally so the new task is visually first.
        const current = this.filteredTasks();
        const withoutCreated = current.filter((t) => t.id !== created.id);
        const reordered = [
          { ...created, position: 0 },
          ...withoutCreated.map((t, idx) => ({ ...t, position: idx + 1 })),
        ];
        await this.taskService.reorderTasks(reordered);

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

  // ===== DnD: column-level enter/leave =====
  onColumnDragEnter(_: DragEvent): void {
    if (!this.dragDropGlobal.isTaskDrag()) return;
    this.columnEnterCount++;
    // Inform global "hovered column" as early as possible.
    this.dragDropGlobal.setTaskHoverColumn(this.kanbanColumnId);
  }

  onColumnDragLeave(_: DragEvent): void {
    if (!this.dragDropGlobal.isTaskDrag()) return;
    this.columnEnterCount = Math.max(0, this.columnEnterCount - 1);
    if (this.columnEnterCount === 0) {
      this.dragOverIndex.set(null);
      this.hoveredZoneIndex.set(null);
      this.animateOnEnter.set(false);
    }
  }

  // ===== DnD: inter-task slices =====
  /**
   * Dragging over a slice (top/bottom half of a card, or head/tail).
   * IMPORTANT: rely on global drag state, not custom DT during dragover.
   */
  onSliceDragOver(event: DragEvent, zoneIndex: number): void {
    if (!this.dragDropGlobal.isTaskDrag()) return;

    // Ignore real file drags.
    if (isFileDragEvent(event)) return;

    // Improve cursor/UX.
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

    // This column is the active hover owner now.
    this.dragDropGlobal.setTaskHoverColumn(this.kanbanColumnId);

    // If hovering the dragged card's own edges, suppress preview/animation.
    if (this.isSelfEdge(zoneIndex)) {
      event.preventDefault();
      this.hoveredZoneIndex.set(null);
      this.dragOverIndex.set(null);
      this.animateOnEnter.set(false);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Animate only when entering this column from another one (first time).
    const firstInColumn = this.dragOverIndex() === null;
    if (firstInColumn) {
      const ctx = this.dragDropGlobal.currentTaskDrag();
      const isForeign = !!ctx && ctx.columnId !== this.kanbanColumnId;
      this.animateOnEnter.set(isForeign);
      if (isForeign) {
        // Let the first render use ".open", then disable for subsequent moves.
        setTimeout(() => this.animateOnEnter.set(false), 0);
      }
    }

    this.hoveredZoneIndex.set(zoneIndex);
    this.dragOverIndex.set(zoneIndex);
  }

  async onSliceDrop(event: DragEvent, zoneIndex: number): Promise<void> {
    if (isFileDragEvent(event)) return;

    if (this.isSelfEdge(zoneIndex)) {
      event.preventDefault();
      this.hoveredZoneIndex.set(null);
      this.dragOverIndex.set(null);
      this.animateOnEnter.set(false);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Prefer global context (source of truth); fallback to DT for resilience.
    const ctx = this.dragDropGlobal.currentTaskDrag();
    const fromColumnId =
      ctx?.columnId ?? getTaskDragData(event)?.kanbanColumnId ?? null;
    const taskId = ctx?.taskId ?? getTaskDragData(event)?.taskId ?? null;
    if (fromColumnId == null || taskId == null) return;

    const insertAt = this.computeInsertIndex(zoneIndex, fromColumnId, taskId);
    await this.onTaskDrop(event, insertAt);
  }

  // ===== Template utils =====
  trackById(_index: number, task: Task): number | undefined {
    return task.id;
  }

  sliceIsActive(zoneIndex: number): boolean {
    return this.hoveredZoneIndex() === zoneIndex;
  }

  // ===== Private helpers =====
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

  private async onTaskDrop(
    event: DragEvent,
    targetIndex: number
  ): Promise<void> {
    event.preventDefault();

    const ctx = this.dragDropGlobal.currentTaskDrag();
    const dtData = getTaskDragData(event);
    const taskId = ctx?.taskId ?? dtData?.taskId ?? null;
    const fromColumnId = ctx?.columnId ?? dtData?.kanbanColumnId ?? null;
    if (taskId == null || fromColumnId == null) return;

    const allTasks = this.taskService.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Same-column reorder.
    if (fromColumnId === this.kanbanColumnId) {
      const columnTasks = [...this.filteredTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;

      if (targetIndex === fromIdx) {
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        this.animateOnEnter.set(false);
        return;
      }

      columnTasks.splice(fromIdx, 1);
      const insertAt = Math.max(0, Math.min(targetIndex, columnTasks.length));
      columnTasks.splice(insertAt, 0, draggedTask);

      const reordered = columnTasks.map((t, idx) => ({ ...t, position: idx }));
      await this.taskService.reorderTasks(reordered);
      this.dragOverIndex.set(null);
      this.hoveredZoneIndex.set(null);
      this.animateOnEnter.set(false);
      this.dragDropGlobal.markTaskDropped(taskId);
      return;
    }

    // Move between columns.
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
    this.animateOnEnter.set(false);
    this.dragDropGlobal.markTaskDropped(taskId);
  }

  /** True if the hovered zone equals the dragged card own edges (no-op move). */
  private isSelfEdge(zoneIndex: number): boolean {
    const ctx = this.dragDropGlobal.currentTaskDrag();
    if (!ctx || ctx.columnId !== this.kanbanColumnId) return false;

    const arr = this.filteredTasks();
    const fromIdx = arr.findIndex((t) => t.id === ctx.taskId);
    if (fromIdx === -1) return false;

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
}
