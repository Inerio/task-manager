import { Injectable } from "@angular/core";
import { setTaskDragData, getTaskDragData } from "../utils/drag-drop-utils";
import { Task } from "../models/task.model";

/* ==== TASK DRAG & DROP SERVICE ==== */
@Injectable({ providedIn: "root" })
export class TaskDragDropService {
  /**
   * Starts task drag operation.
   * Also stores the source column id globally on window to track the dragged task.
   */
  startTaskDrag(
    event: DragEvent,
    task: Task,
    setDragging: (value: boolean) => void
  ) {
    if (task.isEditing) {
      event.preventDefault();
      return;
    }
    setDragging(true);

    if (!task.id || task.kanbanColumnId == null) return;

    setTaskDragData(event, task.id, task.kanbanColumnId);
    // HACK: Store source column id globally for cross-component drag tracking.
    (window as any).DRAGGED_TASK_KANBANCOLUMN_ID = task.kanbanColumnId;

    // Custom drag image
    const dragImage = document.createElement("div");
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    dragImage.style.padding = "0.5rem 1rem";
    dragImage.style.background = "white";
    dragImage.style.border = "1px solid #ccc";
    dragImage.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";
    dragImage.style.borderRadius = "4px";
    dragImage.style.fontWeight = "bold";
    dragImage.style.fontSize = "1rem";
    dragImage.innerText = task.title;
    document.body.appendChild(dragImage);
    event.dataTransfer?.setDragImage(dragImage, 10, 10);
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }

  /**
   * Ends task drag operation and clears global drag state.
   */
  endTaskDrag(setDragging: (value: boolean) => void) {
    setDragging(false);
    (window as any).DRAGGED_TASK_KANBANCOLUMN_ID = undefined;
  }

  /**
   * Handles the dragover event on a kanban column drop zone for tasks.
   */
  handleKanbanColumnDragOver(
    event: DragEvent,
    kanbanColumnId: number,
    setDragOver: (v: boolean) => void
  ) {
    event.preventDefault();
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") === "column"
    )
      return;

    const draggedKanbanColumnId = (window as any).DRAGGED_TASK_KANBANCOLUMN_ID;
    if (
      draggedKanbanColumnId !== undefined &&
      draggedKanbanColumnId !== null &&
      Number(draggedKanbanColumnId) === kanbanColumnId
    ) {
      setDragOver(false);
      return;
    }
    setDragOver(true);
  }

  /**
   * Handles the dragleave event on a kanban column drop zone for tasks.
   */
  handleKanbanColumnDragLeave(setDragOver: (v: boolean) => void) {
    setDragOver(false);
  }

  /**
   * Handles the drop event on a kanban column drop zone for tasks.
   */
  handleKanbanColumnDrop(
    event: DragEvent,
    kanbanColumnId: number,
    setDragOver: (v: boolean) => void,
    getTasks: () => Task[],
    updateTask: (id: number, task: Task) => void
  ) {
    if (
      (event.dataTransfer && event.dataTransfer.types.includes("Files")) ||
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
