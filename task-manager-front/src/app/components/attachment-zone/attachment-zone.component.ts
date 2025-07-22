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

/* ==== ATTACHMENT ZONE COMPONENT ==== */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
})
export class AttachmentZoneComponent {
  /* ==== STATE & INPUTS ==== */
  @Input({ required: true }) attachments!: string[];
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;
  isDragging = signal(false);
  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;
  private alertService = inject(AlertService);

  /* ==== OUTPUT EVENTS ==== */
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();

  /* ==== UTILS ==== */
  trackByFilename(index: number, filename: string): string {
    return filename;
  }

  triggerFileSelect() {
    this.fileInput?.nativeElement.click();
  }

  /* ==== DRAG & DROP HANDLERS ==== */
  onDragOver(event: DragEvent) {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

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
          "Some files were already attached and have been ignored."
        );
      }
      if (newFiles.length) this.filesUploaded.emit(newFiles);
    }
    this.isDragging.set(false);
  }

  /* ==== FILE INPUT HANDLER ==== */
  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      const newFiles = Array.from(files).filter(
        (file) => !this.attachments.includes(file.name)
      );
      if (newFiles.length < files.length) {
        this.alertService.show(
          "error",
          "Some files were already attached and have been ignored."
        );
      }
      if (newFiles.length) this.filesUploaded.emit(newFiles);
    }
  }

  /* ==== FILE ACTIONS ==== */
  onDeleteAttachment(filename: string) {
    this.fileDeleted.emit(filename);
  }

  onDownloadAttachment(filename: string) {
    this.fileDownloaded.emit(filename);
  }
}
