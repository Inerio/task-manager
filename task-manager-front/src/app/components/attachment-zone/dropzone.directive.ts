import {
  Directive,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from "@angular/core";
import { isFileDragEvent } from "../../utils/drag-drop-utils";
import { FileSelectionService } from "../../services/file-selection.service";

/**
 * Dropzone directive:
 * - Emits dzStateChange(true/false) when a file drag enters/leaves the host.
 * - Emits dzFiles(File[]) on drop.
 * - Optional accept filtering via [dzAccept].
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

  private readonly fileSelection = inject(FileSelectionService);

  @HostListener("dragover", ["$event"])
  onDragOver(event: DragEvent): void {
    if (this.dzDisabled) return;
    if (!isFileDragEvent(event)) return;
    event.preventDefault(); // allow drop
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

    const accepted = this.dzAccept
      ? files.filter((f) => this.fileSelection.matchesAccept(f, this.dzAccept))
      : files;

    this.dzFiles.emit(accepted);
    this.dzStateChange.emit(false);
  }
}
