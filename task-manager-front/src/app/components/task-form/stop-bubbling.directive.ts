import { Directive, HostListener } from "@angular/core";

/**
 * Event "firewall" for the task form container.
 * Stops propagation of common bubbling events so board-level listeners
 * (drag & drop, global click, etc.) don't interfere while editing.
 * We don't call preventDefault(), except we swallow only Escape on keydown.
 */
@Directive({
  selector: "[appStopBubbling]",
  standalone: true,
})
export class StopBubblingDirective {
  private swallow(e: Event): void {
    e.stopPropagation();
  }

  @HostListener("pointerdown", ["$event"]) onPointerDown(e: Event) {
    this.swallow(e);
  }
  @HostListener("mousedown", ["$event"]) onMouseDown(e: Event) {
    this.swallow(e);
  }
  @HostListener("mouseup", ["$event"]) onMouseUp(e: Event) {
    this.swallow(e);
  }
  @HostListener("click", ["$event"]) onClick(e: Event) {
    this.swallow(e);
  }
  @HostListener("focusin", ["$event"]) onFocusIn(e: Event) {
    this.swallow(e);
  }
  @HostListener("focusout", ["$event"]) onFocusOut(e: Event) {
    this.swallow(e);
  }

  // Mirror of (keydown.escape) behavior: only swallow Escape.
  @HostListener("keydown", ["$event"]) onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Esc") {
      e.stopPropagation();
    }
  }
}
