import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { AlertService } from "../../services/alert.service";
import { isFileDragEvent } from "../../utils/drag-drop-utils";
import { AttachmentService } from "../../services/attachment.service";

/**
 * AttachmentZoneComponent: drag & drop, preview, upload and manage task attachments.
 * Minimal logic: parent handles upload/delete actions, this component manages UI and events only.
 */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
})
export class AttachmentZoneComponent {
  // ==== INPUTS ====
  @Input({ required: true }) attachments!: string[];
  @Input({ required: true }) taskId!: number;
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;

  // ==== STATE SIGNALS ====
  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewFilename = signal<string | null>(null);
  readonly previewTop = signal(0);
  readonly previewLeft = signal(0);

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;
  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);

  // ==== OUTPUTS ====
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();

  // ==== UTILS (VIEW / RENDERING) ====
  trackByFilename(index: number, filename: string): string {
    return filename;
  }

  triggerFileSelect(): void {
    this.fileInput?.nativeElement.click();
  }

  isImage(filename: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
  }

  buildAttachmentUrl(filename: string): string {
    return this.attachmentService.buildAttachmentUrl(this.taskId, filename);
  }

  // ==== PREVIEW ON HOVER ====
  showPreview(filename: string, event: MouseEvent): void {
    if (!this.isImage(filename)) return;
    this.previewFilename.set(filename);
    this.previewUrl.set(this.buildAttachmentUrl(filename));
    this.previewTop.set(event.clientY + 14);
    this.previewLeft.set(event.clientX + 18);
  }
  hidePreview(): void {
    this.previewUrl.set(null);
    this.previewFilename.set(null);
  }

  // ==== DRAG & DROP ====
  onDragOver(event: DragEvent): void {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    this.isDragging.set(true);
  }
  onDragLeave(): void {
    this.isDragging.set(false);
  }
  onFileDrop(event: DragEvent): void {
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

  // ==== FILE INPUT ====
  onFileSelect(event: Event): void {
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

  // ==== FILE ACTIONS (emit to parent only) ====
  onDeleteAttachment(filename: string): void {
    this.fileDeleted.emit(filename);
  }
  onDownloadAttachment(filename: string): void {
    this.fileDownloaded.emit(filename);
  }
}
