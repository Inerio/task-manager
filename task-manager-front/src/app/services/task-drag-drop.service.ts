import { Injectable, signal, WritableSignal } from "@angular/core";
import { setTaskDragData, getTaskDragData } from "../utils/drag-drop-utils";
import { Task } from "../models/task.model";

/* ==== TASK DRAG & DROP SERVICE ==== */
@Injectable({ providedIn: "root" })
export class TaskDragDropService {
  /** Tracked kanbanColumnId of the currently dragged task */
  private readonly draggedKanbanColumnId: WritableSignal<number | null> =
    signal(null);

  /**
   * Starts task drag operation.
   */
  startTaskDrag(
    event: DragEvent,
    task: Task,
    setDragging: (value: boolean) => void
  ): void {
    if (task.isEditing) {
      event.preventDefault();
      return;
    }
    setDragging(true);

    if (!task.id || task.kanbanColumnId == null) return;

    setTaskDragData(event, task.id, task.kanbanColumnId);
    this.draggedKanbanColumnId.set(task.kanbanColumnId);

    // Create a clean and minimal drag image
    const dragImage = document.createElement("div");
    dragImage.textContent = task.title;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      padding: 0.5rem 1rem;
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 0 5px rgba(0,0,0,0.3);
      border-radius: 4px;
      font-weight: bold;
      font-size: 1rem;
    `;
    document.body.appendChild(dragImage);
    event.dataTransfer?.setDragImage(dragImage, 10, 10);
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }

  /**
   * Ends task drag operation.
   */
  endTaskDrag(setDragging: (value: boolean) => void): void {
    setDragging(false);
    this.draggedKanbanColumnId.set(null);
  }

  /**
   * Handles dragover on a kanban column.
   */
  handleKanbanColumnDragOver(
    event: DragEvent,
    kanbanColumnId: number,
    setDragOver: (v: boolean) => void
  ): void {
    event.preventDefault();

    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") === "column"
    )
      return;

    const current = this.draggedKanbanColumnId();
    if (current !== null && current === kanbanColumnId) {
      setDragOver(false);
      return;
    }

    setDragOver(true);
  }

  /**
   * Handles dragleave on a kanban column.
   */
  handleKanbanColumnDragLeave(setDragOver: (v: boolean) => void): void {
    setDragOver(false);
  }

  /**
   * Handles drop event on a kanban column.
   */
  handleKanbanColumnDrop(
    event: DragEvent,
    kanbanColumnId: number,
    setDragOver: (v: boolean) => void,
    getTasks: () => Task[],
    updateTask: (id: number, task: Task) => void
  ): void {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      setDragOver(false);
      return;
    }

    event.preventDefault();
    setDragOver(false);

    const dragData = getTaskDragData(event);
    if (!dragData) return;

    const { taskId } = dragData;
    const allTasks = getTasks();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.kanbanColumnId === kanbanColumnId) return;

    const updatedTask = { ...task, kanbanColumnId };
    updateTask(updatedTask.id!, updatedTask);
  }
}
