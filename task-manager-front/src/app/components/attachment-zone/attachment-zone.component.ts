import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
  ViewChild,
} from "@angular/core";
import { AlertService } from "../../services/alert.service";
import { isFileDragEvent } from "../../utils/drag-drop-utils";

@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
})
export class AttachmentZoneComponent {
  // --------------------------------------------------------------------
  // [STATE & INPUTS]
  // --------------------------------------------------------------------
  /** List of filenames already attached */
  @Input({ required: true }) attachments!: string[];
  /** Accepted file types for upload */
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  /** Max file size (in bytes) */
  @Input() maxSize = 5 * 1024 * 1024;

  /** Is the zone currently in dragover state? */
  isDragging = signal(false);

  /** File input reference for manual trigger */
  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  private alertService = inject(AlertService);

  // --------------------------------------------------------------------
  // [OUTPUT EVENTS]
  // --------------------------------------------------------------------
  /** Emitted when one or more files are selected/uploaded */
  @Output() filesUploaded = new EventEmitter<File[]>();
  /** Emitted when a file is deleted */
  @Output() fileDeleted = new EventEmitter<string>();
  /** Emitted when a file is downloaded */
  @Output() fileDownloaded = new EventEmitter<string>();

  // --------------------------------------------------------------------
  // [UTILS & PERFORMANCE]
  // --------------------------------------------------------------------
  /*
   * Provides a stable unique identifier for each attached file.
   * Helps Angular track DOM nodes efficiently and minimize re-rendering
   * when the attachments array changes (important for performance and UI stability).
   */
  trackByFilename(index: number, filename: string): string {
    return filename;
  }

  /** Programmatically open the hidden input */
  triggerFileSelect() {
    this.fileInput?.nativeElement.click();
  }

  // --------------------------------------------------------------------
  // [DRAG & DROP HANDLERS]
  // --------------------------------------------------------------------
  /** When a file is dragged over the zone */
  onDragOver(event: DragEvent) {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    this.isDragging.set(true);
  }

  /** When the drag leaves the zone */
  onDragLeave() {
    this.isDragging.set(false);
  }

  /** When files are dropped into the zone */
  onFileDrop(event: DragEvent) {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      const newFiles = Array.from(files).filter(
        (file) => !this.attachments.includes(file.name)
      );
      if (newFiles.length < files.length) {
        this.alertService.show(
          "error",
          "Certains fichiers étaient déjà attachés et ont été ignorés."
        );
      }
      if (newFiles.length) this.filesUploaded.emit(newFiles); // Emit only new files!
    }
    this.isDragging.set(false);
  }

  // --------------------------------------------------------------------
  // [FILE INPUT HANDLER]
  // --------------------------------------------------------------------
  /** When files are selected via the file input */
  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      // Filter front: only keep new files (not already attached)
      const newFiles = Array.from(files).filter(
        (file) => !this.attachments.includes(file.name)
      );
      if (newFiles.length < files.length) {
        this.alertService.show(
          "error",
          "Certains fichiers étaient déjà attachés et ont été ignorés."
        );
      }
      if (newFiles.length) this.filesUploaded.emit(newFiles);
    }
  }

  // --------------------------------------------------------------------
  // [FILE ACTIONS]
  // --------------------------------------------------------------------
  /** Ask parent to delete a file by name */
  onDeleteAttachment(filename: string) {
    this.fileDeleted.emit(filename);
  }

  /** Ask parent to download a file by name */
  onDownloadAttachment(filename: string) {
    this.fileDownloaded.emit(filename);
  }
}
