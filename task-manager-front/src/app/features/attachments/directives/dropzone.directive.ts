import {
  Directive,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from "@angular/core";
import { isFileDragEvent } from "../../../shared/utils/drag-drop-utils";

/**
 * Dropzone directive:
 * - Emits dzStateChange(true/false) when a file drag enters/leaves the host.
 * - Emits dzFiles(File[]) on drop.
 * - [dzAccept] is kept for API symmetry but filtering is centralized later
 *   in FileSelectionService to ensure consistent alerts/UX.
 * - Can be disabled with [dzDisabled].
 */
@Directive({
  selector: "[appDropzone]",
  standalone: true,
})
export class DropzoneDirective {
  @Input() dzAccept = "";
  @Input() dzDisabled = false;

  @Output() readonly dzFiles = new EventEmitter<File[]>();
  @Output() readonly dzStateChange = new EventEmitter<boolean>();

  @HostListener("dragover", ["$event"])
  onDragOver(event: DragEvent): void {
    if (this.dzDisabled) return;
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    try {
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    } catch {
      /* no-op */
    }
    this.dzStateChange.emit(true);
  }

  @HostListener("dragleave")
  onDragLeave(): void {
    if (this.dzDisabled) return;
    this.dzStateChange.emit(false);
  }

  @HostListener("drop", ["$event"])
  onDrop(event: DragEvent): void {
    if (this.dzDisabled) return;
    if (!isFileDragEvent(event)) return;
    event.preventDefault();

    const list = event.dataTransfer?.files;
    const files = list ? Array.from(list) : [];

    // Do not pre-filter by accept here; let selection service handle it
    // so the UI can emit consistent rejection alerts.
    this.dzFiles.emit(files);
    this.dzStateChange.emit(false);
  }
}
