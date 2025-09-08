import { Injectable, inject } from "@angular/core";
import { DragDropGlobalService } from "./drag-drop-global.service";
import { DragOverlayService } from "./drag-overlay.service";
import { setTaskDragData } from "../utils/drag-drop-utils";

/**
 * Orchestrates per-task drag lifecycle:
 * - Init global payload/state
 * - Measure preview size (for placeholder collapse)
 * - Create a cursor-following overlay
 * - Cleanup on end
 */
@Injectable({ providedIn: "root" })
export class TaskDndService {
  private readonly dragGlobal = inject(DragDropGlobalService);
  private readonly overlay = inject(DragOverlayService);

  start(
    event: DragEvent,
    hostEl: HTMLElement,
    taskId: number,
    columnId: number,
    onPreviewSize: (size: { width: number; height: number }) => void
  ): void {
    // DataTransfer + global state
    setTaskDragData(event, taskId, columnId);
    this.dragGlobal.startTaskDrag(taskId, columnId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";

    // Measure to drive placeholder size + smooth collapse
    const rect = hostEl.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    this.dragGlobal.setDragPreviewSize(width, height);
    onPreviewSize({ width, height });

    // Visual overlay following the cursor
    this.overlay.beginFromSource(
      hostEl,
      hostEl.textContent?.trim() || undefined
    );
    this.overlay.hideNativeDragImage(event.dataTransfer);
  }

  end(): void {
    // UI cleanup then global end
    this.overlay.end();
    this.dragGlobal.endDrag();
  }
}
