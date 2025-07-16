// DRAG & DROP UTILS — TASKS

export function setTaskDragData(
  event: DragEvent,
  taskId: number,
  listId: number
) {
  event.dataTransfer?.setData("type", "task");
  event.dataTransfer?.setData("task-id", String(taskId));
  event.dataTransfer?.setData("list-id", String(listId));
}

export function getTaskDragData(
  event: DragEvent
): { taskId: number; listId: number } | null {
  if (!event.dataTransfer) return null;
  if (event.dataTransfer.getData("type") !== "task") return null;
  const taskIdRaw = event.dataTransfer.getData("task-id");
  const listIdRaw = event.dataTransfer.getData("list-id");
  if (!taskIdRaw || !listIdRaw) return null;
  const taskId = Number(taskIdRaw);
  const listId = Number(listIdRaw);
  if (Number.isNaN(taskId) || Number.isNaN(listId)) return null;
  return { taskId, listId };
}

export function isTaskDragEvent(event: DragEvent): boolean {
  return !!event.dataTransfer && event.dataTransfer.getData("type") === "task";
}

// DRAG & DROP UTILS — COLUMNS

export function setColumnDragData(event: DragEvent, listId: number) {
  event.dataTransfer?.setData("type", "column");
  event.dataTransfer?.setData("list-id", String(listId));
}

export function getColumnDragData(event: DragEvent): { listId: number } | null {
  if (!event.dataTransfer) return null;
  if (event.dataTransfer.getData("type") !== "column") return null;
  const listIdRaw = event.dataTransfer.getData("list-id");
  if (!listIdRaw) return null;
  const listId = Number(listIdRaw);
  if (Number.isNaN(listId)) return null;
  return { listId };
}

export function isColumnDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && event.dataTransfer.getData("type") === "column"
  );
}

// DRAG & DROP UTILS — MEDIAS
export function isFileDragEvent(event: DragEvent): boolean {
  return !!event.dataTransfer && event.dataTransfer.types.includes("Files");
}
