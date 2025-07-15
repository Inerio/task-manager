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
  return (
    !!event.dataTransfer &&
    event.dataTransfer.types?.includes("task-id") &&
    event.dataTransfer.types?.includes("type")
  );
}
