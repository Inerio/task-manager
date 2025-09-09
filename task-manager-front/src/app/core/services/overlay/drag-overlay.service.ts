import { Injectable } from "@angular/core";

/**
 * Cursor-following overlay used during HTML5 drag & drop.
 * - Creates a lightweight clone of a source element.
 * - Tracks mouse via document `dragover` to move the overlay.
 * - Cleans up robustly on drop / dragend / Escape / page hide.
 *
 * This service is UI-only; it does not touch global DnD state.
 */
@Injectable({ providedIn: "root" })
export class DragOverlayService {
  private overlayEl: HTMLElement | null = null;

  private onDocDragOver: ((e: DragEvent) => void) | null = null;
  private onDocDropCapture: ((e: DragEvent) => void) | null = null;
  private onDocDropBubble: ((e: DragEvent) => void) | null = null;
  private onDocDragEnd: ((e: DragEvent) => void) | null = null;
  private onDocKeydown: ((e: KeyboardEvent) => void) | null = null;
  private onWindowBlur: ((e: FocusEvent) => void) | null = null;
  private onDocVisibilityChange: ((e: Event) => void) | null = null;
  private onWindowPageHide: ((e: PageTransitionEvent) => void) | null = null;
  private onDocPointerUp: ((e: PointerEvent) => void) | null = null;
  private onDocMouseUp: ((e: MouseEvent) => void) | null = null;

  private readonly CAPTURE: AddEventListenerOptions = { capture: true };
  private readonly BUBBLE: AddEventListenerOptions = { capture: false };

  private offset = { x: 12, y: 10 };

  /** Start a new overlay from the given source element. */
  beginFromSource(src: HTMLElement, titleFallback?: string): void {
    this.end(); // defensive

    const { width, height } = src.getBoundingClientRect();
    const overlay = src.cloneNode(true) as HTMLElement;

    overlay.classList.remove(
      "dragging",
      "drag-over-card",
      "dropped-pulse",
      "ghost"
    );
    overlay.classList.add("task-drag-overlay");

    overlay.style.width = `${Math.round(width)}px`;
    overlay.style.height = `${Math.round(height)}px`;
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.margin = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";
    overlay.style.transition = "none";
    overlay.style.transform = "translate(-9999px, -9999px)";

    overlay
      .querySelectorAll<HTMLElement>("button, [href], input, textarea, select")
      .forEach((el) => {
        el.setAttribute("disabled", "true");
        el.style.pointerEvents = "none";
      });

    if (!overlay.textContent?.trim() && titleFallback) {
      overlay.textContent = titleFallback;
      overlay.style.padding = "0.6rem 1rem";
    }

    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    const offsetX = Math.min(24, Math.round(width * 0.12));
    const offsetY = Math.min(20, Math.round(height * 0.1));
    this.offset = { x: offsetX, y: offsetY };

    // Movement
    this.onDocDragOver = (e: DragEvent) => {
      const x = (e.clientX ?? 0) - this.offset.x;
      const y = (e.clientY ?? 0) - this.offset.y;
      overlay.style.transform = `translate(${x}px, ${y}px)`;
    };
    document.addEventListener("dragover", this.onDocDragOver, this.CAPTURE);

    // Robust cleanup (soft on capture drop, hard on bubble/dragend/esc/pagehide/etc.)
    const soft = () => this.removeOverlayOnly();
    const hard = () => this.end();

    this.onDocDropCapture = () => soft();
    this.onDocDropBubble = () => hard();
    this.onDocDragEnd = () => hard();
    this.onDocKeydown = (e) => e.key === "Escape" && hard();
    this.onWindowBlur = () => hard();
    this.onDocVisibilityChange = () => document.hidden && hard();
    this.onWindowPageHide = () => hard();
    this.onDocPointerUp = () => soft();
    this.onDocMouseUp = () => soft();

    document.addEventListener("drop", this.onDocDropCapture, this.CAPTURE);
    document.addEventListener("drop", this.onDocDropBubble, this.BUBBLE);
    document.addEventListener("dragend", this.onDocDragEnd, this.CAPTURE);
    document.addEventListener("keydown", this.onDocKeydown, this.CAPTURE);
    window.addEventListener("blur", this.onWindowBlur, this.CAPTURE);
    document.addEventListener(
      "visibilitychange",
      this.onDocVisibilityChange,
      this.CAPTURE
    );
    window.addEventListener("pagehide", this.onWindowPageHide);
    document.addEventListener("pointerup", this.onDocPointerUp, this.CAPTURE);
    document.addEventListener("mouseup", this.onDocMouseUp, this.CAPTURE);
  }

  /** Hide the native drag image (use together with beginFromSource). */
  hideNativeDragImage(dt: DataTransfer | null | undefined): void {
    if (!dt) return;
    const shim = document.createElement("canvas");
    shim.width = 1;
    shim.height = 1;
    dt.setDragImage(shim, 0, 0);
  }

  /** Full cleanup (overlay element + listeners). Safe to call multiple times. */
  end(): void {
    if (this.onDocDragOver) {
      document.removeEventListener(
        "dragover",
        this.onDocDragOver,
        this.CAPTURE
      );
      this.onDocDragOver = null;
    }
    if (this.onDocDropCapture) {
      document.removeEventListener("drop", this.onDocDropCapture, this.CAPTURE);
      this.onDocDropCapture = null;
    }
    if (this.onDocDropBubble) {
      document.removeEventListener("drop", this.onDocDropBubble, this.BUBBLE);
      this.onDocDropBubble = null;
    }
    if (this.onDocDragEnd) {
      document.removeEventListener("dragend", this.onDocDragEnd, this.CAPTURE);
      this.onDocDragEnd = null;
    }
    if (this.onDocKeydown) {
      document.removeEventListener("keydown", this.onDocKeydown, this.CAPTURE);
      this.onDocKeydown = null;
    }
    if (this.onWindowBlur) {
      window.removeEventListener("blur", this.onWindowBlur, this.CAPTURE);
      this.onWindowBlur = null;
    }
    if (this.onDocVisibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        this.onDocVisibilityChange,
        this.CAPTURE
      );
      this.onDocVisibilityChange = null;
    }
    if (this.onWindowPageHide) {
      window.removeEventListener("pagehide", this.onWindowPageHide);
      this.onWindowPageHide = null;
    }
    if (this.onDocPointerUp) {
      document.removeEventListener(
        "pointerup",
        this.onDocPointerUp,
        this.CAPTURE
      );
      this.onDocPointerUp = null;
    }
    if (this.onDocMouseUp) {
      document.removeEventListener("mouseup", this.onDocMouseUp, this.CAPTURE);
      this.onDocMouseUp = null;
    }

    if (this.overlayEl?.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
  }

  /** Remove only the overlay element (keeps listeners until bubble/drop/dragend). */
  private removeOverlayOnly(): void {
    if (this.overlayEl?.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
  }
}
