import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";

/**
 * Presentational chip for an attachment (filename + remove button).
 * - Emits `download` when the filename is activated (not in pending mode).
 * - Emits `delete` when the ✖ button is clicked.
 */
@Component({
  selector: "app-attachment-tag",
  standalone: true,
  templateUrl: "./attachment-tag.component.html",
  styleUrls: ["./attachment-tag.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class AttachmentTagComponent {
  @Input({ required: true }) filename!: string;
  @Input() pending = false;

  @Output() readonly delete = new EventEmitter<void>();
  @Output() readonly download = new EventEmitter<void>();

  onDownload(ev: Event): void {
    ev.stopPropagation();
    // Prevent default to avoid spacebar scrolling when activated via keyboard.
    (ev as KeyboardEvent)?.preventDefault?.();
    if (this.pending) return;
    this.download.emit();
  }

  onDelete(ev: Event): void {
    ev.stopPropagation();
    this.delete.emit();
  }
}
