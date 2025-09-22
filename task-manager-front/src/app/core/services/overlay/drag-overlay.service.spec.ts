import { DragOverlayService } from "./drag-overlay.service";

describe("DragOverlayService (DOM listeners + overlay)", () => {
  let svc: DragOverlayService;

  beforeEach(() => {
    svc = new DragOverlayService();
  });

  afterEach(() => {
    // Idempotent cleanup
    svc.end();
    svc.end();
    // Remove any leftover overlays just in case
    document.querySelectorAll(".task-drag-overlay").forEach((n) => n.remove());
  });

  function mkSource(): HTMLElement {
    const el = document.createElement("div");
    el.className = "dragging drag-over-card dropped-pulse ghost";
    // Fake layout metrics used by the service (width/height only)
    (el as any).getBoundingClientRect = () =>
      ({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        bottom: 50,
        right: 100,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect);

    // Add a focusable child to ensure it's disabled in the clone
    const btn = document.createElement("button");
    el.appendChild(btn);

    document.body.appendChild(el);
    return el;
  }

  it("creates an overlay clone with expected classes, size and disabled children", () => {
    const src = mkSource();

    svc.beginFromSource(src);

    const overlay = document.querySelector(".task-drag-overlay") as HTMLElement;
    expect(overlay).withContext("overlay created").not.toBeNull();

    // classes from source should be removed, overlay class added
    expect(overlay.classList.contains("task-drag-overlay")).toBeTrue();
    expect(overlay.classList.contains("dragging")).toBeFalse();
    expect(overlay.classList.contains("drag-over-card")).toBeFalse();
    expect(overlay.classList.contains("dropped-pulse")).toBeFalse();
    expect(overlay.classList.contains("ghost")).toBeFalse();

    // size applied from getBoundingClientRect
    expect(overlay.style.width).toBe("100px");
    expect(overlay.style.height).toBe("50px");

    // children should be disabled and non-interactive
    const btn = overlay.querySelector("button") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("disabled")).toBe("true");
    expect(btn.style.pointerEvents).toBe("none");
  });

  it("uses titleFallback when source has no text", () => {
    const src = mkSource();
    svc.beginFromSource(src, "TITLE");

    const overlay = document.querySelector(".task-drag-overlay") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent!.includes("TITLE")).toBeTrue();
    // Children are replaced when textContent is set via fallback; don't assert on button here.
  });

  it("updates overlay position on dragover using computed offsets", () => {
    const src = mkSource();
    svc.beginFromSource(src);

    // width=100 -> offsetX=min(24, 12)=12 ; height=50 -> offsetY=min(20, 5)=5
    const e = new DragEvent("dragover", { clientX: 200, clientY: 100 });
    document.dispatchEvent(e);

    const overlay = document.querySelector(".task-drag-overlay") as HTMLElement;
    expect(overlay.style.transform).toContain("translate(188px, 95px)");
  });

  it("soft cleanup removes only the overlay element (pointerup)", () => {
    const src = mkSource();
    svc.beginFromSource(src);

    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(document.querySelector(".task-drag-overlay")).toBeNull();

    // Dragover after soft cleanup shouldn't throw (listeners still attached)
    document.dispatchEvent(
      new DragEvent("dragover", { clientX: 10, clientY: 10 })
    );
  });

  it("hard cleanup removes overlay and listeners (dragend + end())", () => {
    const src = mkSource();
    svc.beginFromSource(src);

    document.dispatchEvent(new DragEvent("dragend"));
    expect(document.querySelector(".task-drag-overlay")).toBeNull();

    svc.end();
    svc.end();

    // Further dragover should be safe and do nothing
    document.dispatchEvent(
      new DragEvent("dragover", { clientX: 0, clientY: 0 })
    );
  });

  it("hideNativeDragImage uses a 1x1 canvas shim", () => {
    const setDragImage = jasmine.createSpy("setDragImage");
    const dt = { setDragImage } as any as DataTransfer;

    svc.hideNativeDragImage(dt);

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const [canvas, x, y] = setDragImage.calls.mostRecent().args;
    expect(canvas instanceof HTMLCanvasElement).toBeTrue();
    expect((canvas as HTMLCanvasElement).width).toBe(1);
    expect((canvas as HTMLCanvasElement).height).toBe(1);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});
