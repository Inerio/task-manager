import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  type Signal,
} from "@angular/core";
import { DragDropGlobalService } from "../../../core/services/dnd/drag-drop-global.service";
import { TaskService } from "../../task/data/task.service";
import { Task } from "../../task/models/task.model";
import {
  getTaskDragData,
  isFileDragEvent,
} from "../../../shared/utils/drag-drop-utils";
import { ColumnAutoScroller } from "../utils/column-auto-scroll";

/**
 * Local, per-column DnD orchestrator.
 * Keeps drag/drop logic out of the component for readability.
 * Provided at component level to isolate state per column instance.
 */
@Injectable()
export class KanbanColumnDndService {
  // ---- deps ----
  private readonly tasksSvc = inject(TaskService);
  private readonly drag = inject(DragDropGlobalService);

  // ---- helpers ----
  private readonly autoScroll = new ColumnAutoScroller();

  // ---- column context (set by component) ----
  private readonly _columnId = signal<number | null>(null);
  setColumnId(id: number): void {
    this._columnId.set(id);
  }

  /** Attach the scrollable host used for vertical autoscroll. */
  attachScrollHost(el: HTMLElement | null): void {
    this.autoScroll.attachHost(el);
  }

  // ---- UI state ----
  readonly dragOverIndex = signal<number | null>(null);
  readonly hoveredZoneIndex = signal<number | null>(null);
  /** Animate placeholder when first entering from a different column. */
  readonly animateOnEnter = signal(false);

  // guard to differentiate true leave vs bubbling from children
  private columnEnterCount = 0;

  // ---- derived ----
  readonly isTaskDragActive = computed(() => this.drag.isTaskDrag());

  /** The dragged task object (for ghost preview). */
  readonly ghostTask: Signal<Task | null> = computed(() => {
    const ctx = this.drag.currentTaskDrag();
    if (!ctx) return null;
    const all = this.tasksSvc.tasks();
    return all.find((t) => t.id === ctx.taskId) ?? null;
  });

  /** Tasks for this column, sorted by position. */
  readonly filteredTasks: Signal<Task[]> = computed(() => {
    const colId = this._columnId();
    if (colId == null) return [];
    return this.tasksSvc
      .tasks()
      .filter((task) => task.kanbanColumnId === colId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  });

  /**
   * Visible order during dragover. We reorder *only* for same-column drags.
   * (When dragging from another column, the placeholder alone is enough.)
   */
  readonly displayedTasks: Signal<Task[]> = computed(() => {
    const base = this.filteredTasks();
    const zone = this.dragOverIndex();
    if (zone == null) return base;

    const ctx = this.drag.currentTaskDrag();
    const colId = this._columnId();
    if (!ctx || colId == null || ctx.columnId !== colId) return base;

    const fromIdx = base.findIndex((t) => t.id === ctx.taskId);
    if (fromIdx === -1) return base;

    const insertAt = this.computeInsertIndex(zone, ctx.columnId, ctx.taskId);
    if (insertAt === fromIdx) return base;

    const copy = base.slice();
    const [dragged] = copy.splice(fromIdx, 1);
    const clamped = Math.max(0, Math.min(insertAt, copy.length));
    copy.splice(clamped, 0, dragged);
    return copy;
  });

  /** Placeholder height uses drag preview size when available. */
  readonly placeholderHeight = computed(() => {
    const size = this.drag.taskDragPreviewSize();
    return Math.max(48, Math.round(size?.height ?? 72));
  });

  constructor() {
    // Clear preview when the drag ends globally.
    effect(() => {
      if (!this.isTaskDragActive()) {
        this.autoScroll.stop();
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        this.columnEnterCount = 0;
        this.animateOnEnter.set(false);
      }
    });

    // Ensure a single column owns the hover at any time.
    effect(() => {
      if (!this.isTaskDragActive()) return;
      const hoveredCol = this.drag.hoveredTaskColumnId();
      if (hoveredCol !== this._columnId() && this.dragOverIndex() !== null) {
        this.autoScroll.stop();
        this.dragOverIndex.set(null);
        this.hoveredZoneIndex.set(null);
        this.animateOnEnter.set(false);
        this.columnEnterCount = 0;
      }
    });
  }

  // ===== Column-level enter/leave =====
  onColumnDragEnter(_: DragEvent): void {
    if (!this.drag.isTaskDrag()) return;
    this.columnEnterCount++;
    this.drag.setTaskHoverColumn(this._columnId());
  }

  onColumnDragLeave(_: DragEvent): void {
    if (!this.drag.isTaskDrag()) return;
    this.columnEnterCount = Math.max(0, this.columnEnterCount - 1);
    if (this.columnEnterCount === 0) {
      this.autoScroll.stop();
      this.dragOverIndex.set(null);
      this.hoveredZoneIndex.set(null);
      this.animateOnEnter.set(false);
    }
  }

  // ===== Inter-task slices =====
  onSliceDragOver(event: DragEvent, zoneIndex: number): void {
    if (!this.drag.isTaskDrag()) return;
    if (isFileDragEvent(event)) return;

    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    this.drag.setTaskHoverColumn(this._columnId());

    if (this.isSelfEdge(zoneIndex)) {
      event.preventDefault();
      this.hoveredZoneIndex.set(null);
      this.dragOverIndex.set(null);
      this.animateOnEnter.set(false);
      this.autoScroll.updateFromPointerY(event.clientY);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Animate only when entering this column from another one (first time).
    const firstInColumn = this.dragOverIndex() === null;
    if (firstInColumn) {
      const ctx = this.drag.currentTaskDrag();
      const colId = this._columnId();
      const isForeign = !!ctx && colId != null && ctx.columnId !== colId;
      this.animateOnEnter.set(isForeign);
      if (isForeign) setTimeout(() => this.animateOnEnter.set(false), 0);
    }

    this.hoveredZoneIndex.set(zoneIndex);
    this.dragOverIndex.set(zoneIndex);

    // autoscroll
    this.autoScroll.updateFromPointerY(event.clientY);
  }

  async onSliceDrop(event: DragEvent, zoneIndex: number): Promise<void> {
    if (isFileDragEvent(event)) return;

    if (this.isSelfEdge(zoneIndex)) {
      event.preventDefault();
      this.autoScroll.stop();
      this.hoveredZoneIndex.set(null);
      this.dragOverIndex.set(null);
      this.animateOnEnter.set(false);
      this.drag.endDrag();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const ctx = this.drag.currentTaskDrag();
    const dtData = getTaskDragData(event);
    const fromColumnId = ctx?.columnId ?? dtData?.kanbanColumnId ?? null;
    const taskId = ctx?.taskId ?? dtData?.taskId ?? null;
    if (fromColumnId == null || taskId == null) return;

    const insertAt = this.computeInsertIndex(zoneIndex, fromColumnId, taskId);
    await this.onTaskDrop(event, insertAt);

    this.autoScroll.stop();
    this.drag.endDrag();
  }

  sliceIsActive(zoneIndex: number): boolean {
    return this.hoveredZoneIndex() === zoneIndex;
  }

  /** Hide slices that match the dragged card own edges (remove no-op targets). */
  suppressZone(zoneIndex: number): boolean {
    const ctx = this.drag.currentTaskDrag();
    const colId = this._columnId();
    if (!ctx || colId == null || ctx.columnId !== colId) return false;
    const arr = this.filteredTasks();
    const fromIdx = arr.findIndex((t) => t.id === ctx.taskId);
    return (
      fromIdx !== -1 && (zoneIndex === fromIdx || zoneIndex === fromIdx + 1)
    );
  }

  // ===== Private helpers =====
  private computeInsertIndex(
    zoneIndex: number,
    fromColumnId: number,
    taskId: number
  ): number {
    const colId = this._columnId();
    if (colId == null || fromColumnId !== colId) return zoneIndex;
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

    const ctx = this.drag.currentTaskDrag();
    const dtData = getTaskDragData(event);
    const taskId = ctx?.taskId ?? dtData?.taskId ?? null;
    const fromColumnId = ctx?.columnId ?? dtData?.kanbanColumnId ?? null;
    const colId = this._columnId();
    if (taskId == null || fromColumnId == null || colId == null) return;

    const allTasks = this.tasksSvc.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Same-column reorder (optimistic via reorderTasks).
    if (fromColumnId === colId) {
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
      this.drag.markTaskDropped(taskId);
      this.dragOverIndex.set(null);
      this.hoveredZoneIndex.set(null);
      this.animateOnEnter.set(false);
      void this.tasksSvc.reorderTasks(reordered).catch(() => {});
      return;
    }

    // Cross-column move: fully optimistic & instant (delegated to service).
    const clamped = Math.max(
      0,
      Math.min(targetIndex, this.filteredTasks().length)
    );
    this.drag.markTaskDropped(taskId);
    this.dragOverIndex.set(null);
    this.hoveredZoneIndex.set(null);
    this.animateOnEnter.set(false);
    void this.tasksSvc
      .moveTaskOptimistic(taskId, colId, clamped)
      .catch(() => {});
  }

  /** True if the hovered zone equals the dragged card own edges (no-op move). */
  private isSelfEdge(zoneIndex: number): boolean {
    const ctx = this.drag.currentTaskDrag();
    const colId = this._columnId();
    if (!ctx || colId == null || ctx.columnId !== colId) return false;

    const arr = this.filteredTasks();
    const fromIdx = arr.findIndex((t) => t.id === ctx.taskId);
    if (fromIdx === -1) return false;

    return zoneIndex === fromIdx || zoneIndex === fromIdx + 1;
  }
}
