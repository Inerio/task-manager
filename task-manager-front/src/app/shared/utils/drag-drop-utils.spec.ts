import {
  getBoardDragData,
  getColumnDragData,
  getDragKind,
  getTaskDragData,
  isBoardDragEvent,
  isColumnDragEvent,
  isFileDragEvent,
  isTaskDragEvent,
  setBoardDragData,
  setColumnDragData,
  setTaskDragData,
} from "./drag-drop-utils";

class DTMock implements DataTransfer {
  dropEffect: "none" | "copy" | "link" | "move" = "none";
  effectAllowed:
    | "none"
    | "copy"
    | "copyLink"
    | "copyMove"
    | "link"
    | "linkMove"
    | "move"
    | "all"
    | "uninitialized" = "uninitialized";
  files: FileList = {} as any;
  items: DataTransferItemList = {} as any;
  types: readonly string[] = [];
  private store = new Map<string, string>();

  clearData(format?: string | undefined): void {
    if (format) this.store.delete(format);
    else this.store.clear();
    this.refreshTypes();
  }
  getData(format: string): string {
    return this.store.get(format) ?? "";
  }
  setData(format: string, data: string): void {
    this.store.set(format, data);
    this.refreshTypes();
  }
  setDragImage(_image: Element, _x: number, _y: number): void {}
  private refreshTypes() {
    this.types = Object.freeze(Array.from(this.store.keys()));
  }
}

/** Create a DragEvent with an attached DataTransfer mock. */
function makeEvent(): DragEvent {
  const evt = new DragEvent("dragstart");
  Object.defineProperty(evt, "dataTransfer", {
    value: new DTMock(),
    configurable: true,
  });
  return evt;
}

describe("drag-drop-utils", () => {
  it("task drag: set/get + type guards", () => {
    const ev = makeEvent();

    setTaskDragData(ev, 42, 7);
    expect(getDragKind(ev)).toBe("task");
    expect(isTaskDragEvent(ev)).toBeTrue();

    const data = getTaskDragData(ev)!;
    expect(data.taskId).toBe(42);
    expect(data.kanbanColumnId).toBe(7);
  });

  it("column drag: set/get + type guards", () => {
    const ev = makeEvent();

    setColumnDragData(ev, 9);
    expect(getDragKind(ev)).toBe("column");
    expect(isColumnDragEvent(ev)).toBeTrue();

    const data = getColumnDragData(ev)!;
    expect(data.kanbanColumnId).toBe(9);
  });

  it("board drag: set/get + type guards", () => {
    const ev = makeEvent();

    setBoardDragData(ev, 3);
    expect(getDragKind(ev)).toBe("board");
    expect(isBoardDragEvent(ev)).toBeTrue();

    const data = getBoardDragData(ev)!;
    expect(data.boardId).toBe(3);
  });

  it("isFileDragEvent detects native file drags", () => {
    const ev = makeEvent();
    (ev.dataTransfer as DTMock).setData("Files", "1");
    expect(isFileDragEvent(ev)).toBeTrue();
  });
});
