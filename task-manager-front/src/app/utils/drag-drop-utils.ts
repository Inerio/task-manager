/* ==== DRAG & DROP UTILS — TASKS & COLUMNS ==== */

const DATA_KEYS = {
  type: "type",
  taskId: "task-id",
  columnId: "kanbanColumn-id",
} as const;

type DragKind = "task" | "column";

export interface TaskDragData {
  taskId: number;
  kanbanColumnId: number;
}

export interface ColumnDragData {
  kanbanColumnId: number;
}

function set(dt: DataTransfer | null, key: string, value: string): void {
  dt?.setData(key, value);
}

function get(dt: DataTransfer | null, key: string): string {
  return dt?.getData(key) ?? "";
}

function getNumber(dt: DataTransfer | null, key: string): number | null {
  const v = Number(get(dt, key));
  return Number.isFinite(v) ? v : null;
}

/** Attach task drag data to the event. */
export function setTaskDragData(
  event: DragEvent,
  taskId: number,
  kanbanColumnId: number
): void {
  const dt = event.dataTransfer ?? null;
  set(dt, DATA_KEYS.type, "task");
  set(dt, DATA_KEYS.taskId, String(taskId));
  set(dt, DATA_KEYS.columnId, String(kanbanColumnId));
}

/** Extract task drag data from the event, or null if invalid. */
export function getTaskDragData(event: DragEvent): TaskDragData | null {
  const dt = event.dataTransfer ?? null;
  if (get(dt, DATA_KEYS.type) !== "task") return null;

  const taskId = getNumber(dt, DATA_KEYS.taskId);
  const kanbanColumnId = getNumber(dt, DATA_KEYS.columnId);
  if (taskId == null || kanbanColumnId == null) return null;

  return { taskId, kanbanColumnId };
}

/** Is the drag event for a task? */
export function isTaskDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && get(event.dataTransfer, DATA_KEYS.type) === "task"
  );
}

/** Attach column drag data to the event. */
export function setColumnDragData(
  event: DragEvent,
  kanbanColumnId: number
): void {
  const dt = event.dataTransfer ?? null;
  set(dt, DATA_KEYS.type, "column");
  set(dt, DATA_KEYS.columnId, String(kanbanColumnId));
}

/** Extract column drag data from the event, or null if invalid. */
export function getColumnDragData(event: DragEvent): ColumnDragData | null {
  const dt = event.dataTransfer ?? null;
  if (get(dt, DATA_KEYS.type) !== "column") return null;

  const kanbanColumnId = getNumber(dt, DATA_KEYS.columnId);
  if (kanbanColumnId == null) return null;

  return { kanbanColumnId };
}

/** Is the drag event for a column? */
export function isColumnDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && get(event.dataTransfer, DATA_KEYS.type) === "column"
  );
}

/* ==== DRAG & DROP UTILS — FILES ==== */

/** Is the drag event a file drop? */
export function isFileDragEvent(event: DragEvent): boolean {
  // Cross-browser friendly: check case-insensitively
  return (
    !!event.dataTransfer &&
    Array.from(event.dataTransfer.types).some(
      (type) => type.toLowerCase() === "files"
    )
  );
}
