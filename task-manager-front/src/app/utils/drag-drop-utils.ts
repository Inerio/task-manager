/* ==== DRAG & DROP UTILS — TASKS ==== */

export function setTaskDragData(
  event: DragEvent,
  taskId: number,
  kanbanColumnId: number
) {
  event.dataTransfer?.setData("type", "task");
  event.dataTransfer?.setData("task-id", String(taskId));
  event.dataTransfer?.setData("kanbanColumn-id", String(kanbanColumnId));
}

export function getTaskDragData(
  event: DragEvent
): { taskId: number; kanbanColumnId: number } | null {
  if (!event.dataTransfer) return null;
  if (event.dataTransfer.getData("type") !== "task") return null;
  const taskIdRaw = event.dataTransfer.getData("task-id");
  const kanbanColumnIdRaw = event.dataTransfer.getData("kanbanColumn-id");
  if (!taskIdRaw || !kanbanColumnIdRaw) return null;
  const taskId = Number(taskIdRaw);
  const kanbanColumnId = Number(kanbanColumnIdRaw);
  if (Number.isNaN(taskId) || Number.isNaN(kanbanColumnId)) return null;
  return { taskId, kanbanColumnId };
}

export function isTaskDragEvent(event: DragEvent): boolean {
  return !!event.dataTransfer && event.dataTransfer.getData("type") === "task";
}

/* ==== DRAG & DROP UTILS — COLUMNS ==== */

export function setColumnDragData(event: DragEvent, kanbanColumnId: number) {
  event.dataTransfer?.setData("type", "column");
  event.dataTransfer?.setData("kanbanColumn-id", String(kanbanColumnId));
}

export function getColumnDragData(
  event: DragEvent
): { kanbanColumnId: number } | null {
  if (!event.dataTransfer) return null;
  if (event.dataTransfer.getData("type") !== "column") return null;
  const kanbanColumnIdRaw = event.dataTransfer.getData("kanbanColumn-id");
  if (!kanbanColumnIdRaw) return null;
  const kanbanColumnId = Number(kanbanColumnIdRaw);
  if (Number.isNaN(kanbanColumnId)) return null;
  return { kanbanColumnId };
}

export function isColumnDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && event.dataTransfer.getData("type") === "column"
  );
}

/* ==== DRAG & DROP UTILS — FILES ==== */

/**
 * Returns true if the DragEvent contains files.
 */
export function isFileDragEvent(event: DragEvent): boolean {
  return !!event.dataTransfer && event.dataTransfer.types.includes("Files");
}
