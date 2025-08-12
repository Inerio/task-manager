/* ==== DRAG & DROP UTILS — TASKS, COLUMNS, BOARDS ==== */

const DATA_KEYS = {
  type: "type",
  taskId: "task-id",
  columnId: "kanbanColumn-id",
  boardId: "board-id",
} as const;

type DragKind = "task" | "column" | "board";

export interface TaskDragData {
  taskId: number;
  kanbanColumnId: number;
}

export interface ColumnDragData {
  kanbanColumnId: number;
}

export interface BoardDragData {
  boardId: number;
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

/** ===== TASK ===== */
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

export function getTaskDragData(event: DragEvent): TaskDragData | null {
  const dt = event.dataTransfer ?? null;
  if (get(dt, DATA_KEYS.type) !== "task") return null;

  const taskId = getNumber(dt, DATA_KEYS.taskId);
  const kanbanColumnId = getNumber(dt, DATA_KEYS.columnId);
  if (taskId == null || kanbanColumnId == null) return null;

  return { taskId, kanbanColumnId };
}

export function isTaskDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && get(event.dataTransfer, DATA_KEYS.type) === "task"
  );
}

/** ===== COLUMN ===== */
export function setColumnDragData(
  event: DragEvent,
  kanbanColumnId: number
): void {
  const dt = event.dataTransfer ?? null;
  set(dt, DATA_KEYS.type, "column");
  set(dt, DATA_KEYS.columnId, String(kanbanColumnId));
}

export function getColumnDragData(event: DragEvent): ColumnDragData | null {
  const dt = event.dataTransfer ?? null;
  if (get(dt, DATA_KEYS.type) !== "column") return null;

  const kanbanColumnId = getNumber(dt, DATA_KEYS.columnId);
  if (kanbanColumnId == null) return null;

  return { kanbanColumnId };
}

export function isColumnDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && get(event.dataTransfer, DATA_KEYS.type) === "column"
  );
}

/** ===== BOARD ===== */
export function setBoardDragData(event: DragEvent, boardId: number): void {
  const dt = event.dataTransfer ?? null;
  set(dt, DATA_KEYS.type, "board");
  set(dt, DATA_KEYS.boardId, String(boardId));
}

export function getBoardDragData(event: DragEvent): BoardDragData | null {
  const dt = event.dataTransfer ?? null;
  if (get(dt, DATA_KEYS.type) !== "board") return null;

  const boardId = getNumber(dt, DATA_KEYS.boardId);
  if (boardId == null) return null;

  return { boardId };
}

export function isBoardDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer && get(event.dataTransfer, DATA_KEYS.type) === "board"
  );
}

/* ==== DRAG & DROP UTILS — FILES ==== */

export function isFileDragEvent(event: DragEvent): boolean {
  return (
    !!event.dataTransfer &&
    Array.from(event.dataTransfer.types).some(
      (type) => type.toLowerCase() === "files"
    )
  );
}
