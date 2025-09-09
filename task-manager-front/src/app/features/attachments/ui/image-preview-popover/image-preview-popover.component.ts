import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

/**
 * Presentational popover for image previews.
 * Renders a floating container at (x, y) with the provided image URL.
 */
@Component({
  selector: "app-image-preview-popover",
  standalone: true,
  templateUrl: "./image-preview-popover.component.html",
  styleUrls: ["./image-preview-popover.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagePreviewPopoverComponent {
  @Input({ required: true }) url!: string | null;
  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;
  @Input({ required: true }) visible!: boolean;
  /** Accessible alt text for the preview image (filename if available). */
  @Input() alt = "preview";
}
