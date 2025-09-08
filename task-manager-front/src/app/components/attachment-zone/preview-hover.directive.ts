import {
  Directive,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from "@angular/core";
import { AttachmentPreviewService } from "../../services/attachment-preview.service";

/**
 * Hover-to-preview directive.
 * Emits:
 *  - phShow({ url, x, y, filename }) on first hover (fetch via service)
 *  - phMove({ x, y }) while moving
 *  - phHide() on leave
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

  private isImage(name: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  @HostListener("mouseenter", ["$event"])
  async onEnter(ev: MouseEvent): Promise<void> {
    if (!this.isImage(this.phFilename)) return;
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
    this.phMove.emit({ x: ev.clientX + 18, y: ev.clientY + 14 });
  }

  @HostListener("mouseleave")
  onLeave(): void {
    this.phHide.emit();
  }
}
