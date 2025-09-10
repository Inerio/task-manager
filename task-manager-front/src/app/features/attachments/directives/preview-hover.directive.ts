import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from "@angular/core";
import { AttachmentPreviewService } from "../data/attachment-preview.service";

/**
 * Hover / long-press to preview.
 * Desktop: mouseenter/move/leave.
 * Mobile (touch/pen): long-press via Pointer Events, follows finger while pressed.
 * - Suppresses the click generated after a long-press (so picker/download isn't triggered).
 * - While long-press is active: sets data-preview-lock="1" on host so DnD can ignore dragstart.
 */
@Directive({
  selector: "[appPreviewHover]",
  standalone: true,
})
export class PreviewHoverDirective {
  @Input({ required: true }) phTaskId!: number;
  @Input({ required: true }) phFilename!: string;

  @Output() readonly phShow = new EventEmitter<{
    url: string;
    x: number;
    y: number;
    filename: string;
  }>();
  @Output() readonly phMove = new EventEmitter<{ x: number; y: number }>();
  @Output() readonly phHide = new EventEmitter<void>();

  private readonly preview = inject(AttachmentPreviewService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // ---- Long-press state (mobile) ----
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private pointerId: number | null = null;
  private longPressActive = false;
  private suppressNextClick = false;
  private startX = 0;
  private startY = 0;

  // Tunables
  private static readonly LONG_PRESS_MS = 350;
  private static readonly MOVE_TOL = 10; // px

  private isImage(name: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  // Small helper to mark host while preview is active (read by DnD directive).
  private setPreviewLock(active: boolean): void {
    const card = this.host.nativeElement.closest(
      "[appTaskDnd]"
    ) as HTMLElement | null;
    const target = card ?? this.host.nativeElement;
    if (active) {
      target.setAttribute("data-preview-lock", "1");
      target.style.touchAction = "none";
    } else {
      target.removeAttribute("data-preview-lock");
      target.style.touchAction = "";
    }
  }

  // ===== Desktop hover =====
  @HostListener("mouseenter", ["$event"])
  async onEnter(ev: MouseEvent): Promise<void> {
    if (!this.isImage(this.phFilename)) return;
    if (this.longPressActive) return;
    try {
      const url = await this.preview.get(this.phTaskId, this.phFilename);
      this.phShow.emit({
        url,
        x: ev.clientX + 18,
        y: ev.clientY + 14,
        filename: this.phFilename,
      });
    } catch {
      this.phHide.emit();
    }
  }

  @HostListener("mousemove", ["$event"])
  onMove(ev: MouseEvent): void {
    if (!this.isImage(this.phFilename)) return;
    if (this.longPressActive) return; // touch flow handles its own moves
    this.phMove.emit({ x: ev.clientX + 18, y: ev.clientY + 14 });
  }

  @HostListener("mouseleave")
  onLeave(): void {
    if (this.longPressActive) return; // handled by pointer end
    this.phHide.emit();
  }

  // ===== Mobile long-press (Pointer Events) =====
  @HostListener("pointerdown", ["$event"])
  onPointerDown(e: PointerEvent): void {
    if (!this.isImage(this.phFilename)) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.longPressActive = false;

    this.clearTimer();
    this.pressTimer = setTimeout(() => {
      this.longPressActive = true;
      this.suppressNextClick = true;
      this.setPreviewLock(true);
      this.fetchAndShowAt(e.clientX, e.clientY).catch(() => this.phHide.emit());
    }, PreviewHoverDirective.LONG_PRESS_MS);
  }

  @HostListener("dragstart", ["$event"])
  onDragStartFromTag(e: DragEvent): void {
    if (this.longPressActive) {
      e.preventDefault();
      e.stopPropagation();
      (
        e as { stopImmediatePropagation?: () => void }
      ).stopImmediatePropagation?.();
    }
  }

  @HostListener("pointermove", ["$event"])
  onPointerMove(e: PointerEvent): void {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;

    const dx = Math.abs(e.clientX - this.startX);
    const dy = Math.abs(e.clientY - this.startY);

    // Cancel if user starts dragging before long-press triggers (let DnD happen).
    if (
      !this.longPressActive &&
      (dx > PreviewHoverDirective.MOVE_TOL ||
        dy > PreviewHoverDirective.MOVE_TOL)
    ) {
      this.cancelPress(false);
      return;
    }

    if (this.longPressActive) {
      // While preview is open, swallow events so DnD/zone click don't trigger.
      e.preventDefault();
      e.stopPropagation();
      (
        e as { stopImmediatePropagation?: () => void }
      ).stopImmediatePropagation?.();
      this.phMove.emit({ x: e.clientX + 18, y: e.clientY + 14 });
    }
  }

  @HostListener("pointerup", ["$event"])
  @HostListener("pointercancel", ["$event"])
  @HostListener("pointerleave", ["$event"])
  onPointerEnd(_e: PointerEvent): void {
    const active = this.longPressActive;
    this.cancelPress(true);
    if (active) this.phHide.emit();
  }

  // Swallow the click generated after a long-press so parent handlers don't fire.
  @HostListener("click", ["$event"])
  onClick(e: MouseEvent): void {
    if (!this.suppressNextClick) return;
    e.preventDefault();
    e.stopPropagation();
    (
      e as { stopImmediatePropagation?: () => void }
    ).stopImmediatePropagation?.();
    this.suppressNextClick = false;
  }

  // ===== Helpers =====
  private async fetchAndShowAt(x: number, y: number): Promise<void> {
    const url = await this.preview.get(this.phTaskId, this.phFilename);
    this.phShow.emit({ url, x: x + 18, y: y + 14, filename: this.phFilename });
  }

  private cancelPress(keepSuppressClick: boolean): void {
    this.clearTimer();
    this.pointerId = null;
    this.longPressActive = false;
    this.setPreviewLock(false);
    if (!keepSuppressClick) this.suppressNextClick = false;
  }

  private clearTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.longPressActive = false;
    this.setPreviewLock(false);
    this.phHide.emit();
  }
}
