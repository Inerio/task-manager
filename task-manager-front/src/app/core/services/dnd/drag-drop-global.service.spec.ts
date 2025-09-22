import { fakeAsync, tick } from "@angular/core/testing";
import { DragDropGlobalService } from "./drag-drop-global.service";

describe("DragDropGlobalService (signals/state, no HTTP)", () => {
  let svc: DragDropGlobalService;

  beforeEach(() => {
    svc = new DragDropGlobalService();
  });

  it("starts/ends task drag and manages hover column only during task drag", () => {
    expect(svc.isDragging()).toBeFalse();

    svc.startTaskDrag(5, 10);
    expect(svc.isDragging()).toBeTrue();
    expect(svc.isTaskDrag()).toBeTrue();
    expect(svc.currentTaskDrag()).toEqual({ taskId: 5, columnId: 10 });

    // hover column works only for task drag
    svc.setTaskHoverColumn(10);
    expect(svc.hoveredTaskColumnId()).toBe(10);

    svc.endDrag();
    expect(svc.isDragging()).toBeFalse();
    expect(svc.currentTaskDrag()).toBeNull();
    expect(svc.hoveredTaskColumnId()).toBeNull();
  });

  it("starts/ends column drag", () => {
    svc.startColumnDrag(7);
    expect(svc.isDragging()).toBeTrue();
    expect(svc.isColumnDrag()).toBeTrue();
    expect(svc.currentColumnDrag()).toEqual({ columnId: 7 });

    // setTaskHoverColumn ignored when not task drag
    svc.setTaskHoverColumn(123);
    expect(svc.hoveredTaskColumnId()).toBeNull();

    svc.endDrag();
    expect(svc.isDragging()).toBeFalse();
    expect(svc.currentColumnDrag()).toBeNull();
  });

  it("starts/ends board drag", () => {
    svc.startBoardDrag(99);
    expect(svc.isDragging()).toBeTrue();
    expect(svc.isBoardDrag()).toBeTrue();
    expect(svc.currentBoardDrag()).toEqual({ boardId: 99 });

    svc.endDrag();
    expect(svc.isDragging()).toBeFalse();
    expect(svc.currentBoardDrag()).toBeNull();
  });

  it("starts/ends file drag", () => {
    svc.startFileDrag();
    expect(svc.isDragging()).toBeTrue();
    expect(svc.isFileDrag()).toBeTrue();
    expect(svc.currentFileDrag()).toBeTrue();

    svc.endDrag();
    expect(svc.isDragging()).toBeFalse();
    expect(svc.currentFileDrag()).toBeFalse();
  });

  it("stores and clears drag preview size", () => {
    svc.setDragPreviewSize(120, 40);
    expect(svc.taskDragPreviewSize()).toEqual({ width: 120, height: 40 });

    svc.clearDragPreviewSize();
    expect(svc.taskDragPreviewSize()).toBeNull();
  });

  it("pulse markers auto-expire (default 1500ms)", fakeAsync(() => {
    svc.markTaskDropped(1);
    expect(svc.lastDroppedTask()).toBeTruthy();

    tick(1499);
    expect(svc.lastDroppedTask()).toBeTruthy();

    tick(2);
    expect(svc.lastDroppedTask()).toBeNull();
  }));

  it("newer pulse prevents older timeout from clearing it", fakeAsync(() => {
    svc.markTaskDropped(1);
    const first = svc.lastDroppedTask();

    tick(200); // before first TTL, emit a new pulse
    svc.markTaskDropped(1);
    const second = svc.lastDroppedTask();
    expect(second).toBeTruthy();
    expect(second!.token).not.toBe(first!.token);

    // Advance to just before the second timeout; only the first timer fires.
    tick(1499);
    expect(svc.lastDroppedTask()).toBeTruthy();

    // Now let the second timer fire and clear it.
    tick(2);
    expect(svc.lastDroppedTask()).toBeNull();
  }));
});
