/* ==== DRAG & DROP UTILS — TASKS ==== */

export interface TaskDragData {
  taskId: number;
  kanbanColumnId: number;
}

/**
 * Attach task drag data to event.
 */
export function setTaskDragData(
  event: DragEvent,
  taskId: number,
  kanbanColumnId: number
): void {
  event.dataTransfer?.setData("type", "task");
  event.dataTransfer?.setData("task-id", String(taskId));
  event.dataTransfer?.setData("kanbanColumn-id", String(kanbanColumnId));
}

/**
 * Extract task drag data from event, or null if not present/valid.
 */
export function getTaskDragData(event: DragEvent): TaskDragData | null {
  const dt = event.dataTransfer;
  if (!dt || dt.getData("type") !== "task") return null;
  const taskId = Number(dt.getData("task-id"));
  const kanbanColumnId = Number(dt.getData("kanbanColumn-id"));
  if (!Number.isFinite(taskId) || !Number.isFinite(kanbanColumnId)) return null;
  return { taskId, kanbanColumnId };
}

/**
 * Is the drag event for a task?
 */
export function isTaskDragEvent(event: DragEvent): boolean {
  return !!event.dataTransfer && event.dataTransfer.getData("type") === "task";
}

/* ==== DRAG & DROP UTILS — COLUMNS ==== */

export interface ColumnDragData {
  kanbanColumnId: number;
}

/**
 * Attach column drag data to event.
 */
export function setColumnDragData(
  event: DragEvent,
  kanbanColumnId: number
): void {
  event.dataTransfer?.setData("type", "column");
  event.dataTransfer?.setData("kanbanColumn-id", String(kanbanColumnId));
}

/**
 * Extract column drag data from event, or null if not present/valid.
 */
export function getColumnDragData(event: DragEvent): ColumnDragData | null {
  const dt = event.dataTransfer;
  if (!dt || dt.getData("type") !== "column") return null;
  const kanbanColumnId = Number(dt.getData("kanbanColumn-id"));
  if (!Number.isFinite(kanbanColumnId)) return null;
  return { kanbanColumnId };
}

/**
 * Is the drag event for a column?
 */
export function isColumnDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && event.dataTransfer.getData("type") === "column"
  );
}

/* ==== DRAG & DROP UTILS — FILES ==== */

/**
 * Is the drag event a file drop?
 */
export function isFileDragEvent(event: DragEvent): boolean {
  // Use .includes for max compatibility (some browsers use lowercase, etc.)
  return (
    !!event.dataTransfer &&
    Array.from(event.dataTransfer.types).some(
      (type) => type.toLowerCase() === "files"
    )
  );
}
