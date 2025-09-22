import { ElementRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BoardHorizontalAutoScrollDirective } from "./board-horizontal-autoscroll.directive";
import { DragDropGlobalService } from "../../../core/services/dnd/drag-drop-global.service";
import { BoardAutoScroller } from "../utils/board-auto-scroll";

class DragStub {
  private _dragging = signal(false);
  isDragging = this._dragging.asReadonly();
  setDragging(v: boolean) {
    this._dragging.set(v);
  }
  isTaskDrag() {
    return this._dragging();
  }
  isColumnDrag() {
    return false;
  }
}

describe("BoardHorizontalAutoScrollDirective", () => {
  let host: HTMLElement;
  let drag: DragStub;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);

    spyOn(BoardAutoScroller.prototype, "attachHost").and.callThrough();
    spyOn(BoardAutoScroller.prototype, "updateFromPointerX").and.callThrough();
    spyOn(BoardAutoScroller.prototype, "stop").and.callThrough();

    drag = new DragStub();

    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(host) },
        { provide: DragDropGlobalService, useValue: drag },
      ],
    });
  });

  afterEach(() => document.body.removeChild(host));

  it("updates scroller on dragover when a drag is active", () => {
    const dir = TestBed.runInInjectionContext(
      () => new BoardHorizontalAutoScrollDirective()
    );
    drag.setDragging(true);

    dir.onHostDragOver(new DragEvent("dragover", { clientX: 123 }) as any);
    expect(BoardAutoScroller.prototype.updateFromPointerX).toHaveBeenCalledWith(
      123
    );

    dir.stop();
    expect(BoardAutoScroller.prototype.stop).toHaveBeenCalled();
  });

  it("ignores dragover when not dragging", () => {
    const dir = TestBed.runInInjectionContext(
      () => new BoardHorizontalAutoScrollDirective()
    );
    drag.setDragging(false);

    dir.onHostDragOver(new DragEvent("dragover", { clientX: 50 }) as any);
    expect(
      BoardAutoScroller.prototype.updateFromPointerX
    ).not.toHaveBeenCalled();
  });
});
