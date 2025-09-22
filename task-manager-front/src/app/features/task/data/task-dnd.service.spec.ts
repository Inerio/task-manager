import { TestBed } from "@angular/core/testing";
import { TaskDndService } from "./task-dnd.service";
import { DragDropGlobalService } from "../../../core/services/dnd/drag-drop-global.service";
import { DragOverlayService } from "../../../core/services/overlay/drag-overlay.service";

describe("TaskDndService (state logic, no HTTP)", () => {
  let svc: TaskDndService;

  // ---- Stubs with spies
  const dragGlobalStub = {
    startTaskDrag: jasmine.createSpy("startTaskDrag"),
    endDrag: jasmine.createSpy("endDrag"),
    setDragPreviewSize: jasmine.createSpy("setDragPreviewSize"),
  } as unknown as DragDropGlobalService;

  const overlayStub = {
    beginFromSource: jasmine.createSpy("beginFromSource"),
    hideNativeDragImage: jasmine.createSpy("hideNativeDragImage"),
    end: jasmine.createSpy("end"),
  } as unknown as DragOverlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DragDropGlobalService, useValue: dragGlobalStub },
        { provide: DragOverlayService, useValue: overlayStub },
      ],
    });
    svc = TestBed.inject(TaskDndService);

    // reset spies before each test
    (dragGlobalStub.startTaskDrag as jasmine.Spy).calls.reset();
    (dragGlobalStub.endDrag as jasmine.Spy).calls.reset();
    (dragGlobalStub.setDragPreviewSize as jasmine.Spy).calls.reset();
    (overlayStub.beginFromSource as jasmine.Spy).calls.reset();
    (overlayStub.hideNativeDragImage as jasmine.Spy).calls.reset();
    (overlayStub.end as jasmine.Spy).calls.reset();
  });

  function makeHostEl(
    width: number,
    height: number,
    text = "  Hello Task  "
  ): HTMLElement {
    return {
      getBoundingClientRect: () => ({ width, height } as DOMRect),
      textContent: text,
    } as unknown as HTMLElement;
  }

  it("start(): initializes drag (global), measures preview (rounded), shows overlay, hides native image", () => {
    const hostEl = makeHostEl(123.4, 56.6, "  My task  ");
    const dt = {
      effectAllowed: "",
      setData: jasmine.createSpy("setData"),
    } as unknown as DataTransfer;
    const ev = { dataTransfer: dt } as unknown as DragEvent;

    const previewSpy = jasmine.createSpy("onPreviewSize");
    svc.start(ev, hostEl, /*task*/ 42, /*col*/ 7, previewSpy);

    expect(dragGlobalStub.startTaskDrag).toHaveBeenCalledOnceWith(42, 7);
    // 123.4 -> 123 (round), 56.6 -> 57
    expect(dragGlobalStub.setDragPreviewSize).toHaveBeenCalledOnceWith(123, 57);
    expect(previewSpy).toHaveBeenCalledOnceWith({ width: 123, height: 57 });

    expect(overlayStub.beginFromSource).toHaveBeenCalled();
    const [srcEl, label] = (
      overlayStub.beginFromSource as jasmine.Spy
    ).calls.mostRecent().args;
    expect(srcEl).toBe(hostEl);
    expect(label).toBe("My task");

    expect(overlayStub.hideNativeDragImage).toHaveBeenCalledOnceWith(dt);
    expect(dt.effectAllowed).toBe("move");
    expect((dt as any).setData).toHaveBeenCalled();
  });

  it("start(): tolerates missing DataTransfer (no effectAllowed), still sets preview and overlay", () => {
    const hostEl = makeHostEl(100.6, 40.2, "X");
    const ev = { dataTransfer: null } as unknown as DragEvent;

    const previewSpy = jasmine.createSpy("onPreviewSize");
    svc.start(ev, hostEl, 1, 2, previewSpy);

    expect(dragGlobalStub.startTaskDrag).toHaveBeenCalledOnceWith(1, 2);
    // 100.6 -> 101, 40.2 -> 40
    expect(dragGlobalStub.setDragPreviewSize).toHaveBeenCalledOnceWith(101, 40);
    expect(previewSpy).toHaveBeenCalledOnceWith({ width: 101, height: 40 });

    expect(overlayStub.beginFromSource).toHaveBeenCalled();
    expect(overlayStub.hideNativeDragImage).toHaveBeenCalledOnceWith(
      null as unknown as DataTransfer
    );
  });

  it("end(): ends overlay first, then ends global drag", () => {
    svc.end();
    expect(overlayStub.end).toHaveBeenCalled();
    expect(dragGlobalStub.endDrag).toHaveBeenCalled();
  });
});
