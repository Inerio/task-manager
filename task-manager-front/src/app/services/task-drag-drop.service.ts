import { Injectable } from "@angular/core";
import { setTaskDragData, getTaskDragData } from "../utils/drag-drop-utils";
import { Task } from "../models/task.model";

@Injectable({ providedIn: "root" })
export class TaskDragDropService {
  /**
   * Starts a task drag operation. Sets up the drag image and payload.
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

    // Custom drag image
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
   * Ends a task drag operation.
   */
  endTaskDrag(setDragging: (value: boolean) => void): void {
    setDragging(false);
  }

  /**
   * Handles drag over event on a dropzone. Must call preventDefault.
   */
  handleTaskDropzoneDragOver(
    event: DragEvent,
    kanbanColumnId: number,
    targetIndex: number,
    setDragOverIndex: (idx: number) => void
  ) {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    )
      return;
    event.preventDefault();
    setDragOverIndex(targetIndex);
  }

  /**
   * Handles drop event on a precise dropzone.
   * If moved within the same column, simply reorder.
   * If moved to a different column, update task column then reorder both source and target columns.
   */
  async handleTaskDropzoneDrop({
    event,
    targetKanbanColumnId,
    targetIndex,
    getAllTasks,
    getColumnTasks,
    reorderTasks,
    updateTask,
  }: {
    event: DragEvent;
    targetKanbanColumnId: number;
    targetIndex: number;
    getAllTasks: () => Task[];
    getColumnTasks: () => Task[];
    reorderTasks: (tasks: Task[]) => void | Promise<void>;
    updateTask: (id: number, task: Task) => Promise<void>;
  }) {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    )
      return;

    event.preventDefault();

    const dragData = getTaskDragData(event);
    if (!dragData) return;

    const { taskId, kanbanColumnId: fromColumnId } = dragData;
    if (taskId == null || fromColumnId == null) return;

    // Get the dragged task from all tasks
    const allTasks = getAllTasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // If moving within the same column, just reorder tasks
    if (fromColumnId === targetKanbanColumnId) {
      const columnTasks = [...getColumnTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;
      columnTasks.splice(fromIdx, 1);
      columnTasks.splice(targetIndex, 0, draggedTask);

      // Update positions and send to backend
      const reordered = columnTasks.map((t, idx) => ({
        ...t,
        position: idx,
      }));
      reorderTasks(reordered);
      return;
    }

    // Else, move to another column and reorder both columns
    const sourceTasks = allTasks.filter(
      (t) => t.kanbanColumnId === fromColumnId && t.id !== taskId
    );
    const targetTasks = [...getColumnTasks()];
    const newTask = { ...draggedTask, kanbanColumnId: targetKanbanColumnId };
    targetTasks.splice(targetIndex, 0, newTask);

    // Reindex source and target columns
    const reorderedSource = sourceTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));
    const reorderedTarget = targetTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));

    // First update the task's column in backend, then reorder both columns
    await updateTask(newTask.id!, newTask);
    reorderTasks(reorderedSource);
    reorderTasks(reorderedTarget);
  }
}
