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

/* ==== ATTACHMENT ZONE COMPONENT ==== */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
})
export class AttachmentZoneComponent {
  /* ==== INPUTS ==== */
  @Input({ required: true }) attachments!: string[];
  @Input({ required: true }) taskId!: number;
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;

  /* ==== STATE ==== */
  isDragging = signal(false);
  previewUrl = signal<string | null>(null);
  previewFilename = signal<string | null>(null);
  previewTop = signal(0);
  previewLeft = signal(0);

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;
  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);

  /* ==== OUTPUT EVENTS ==== */
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();

  trackByFilename(index: number, filename: string): string {
    return filename;
  }

  triggerFileSelect() {
    this.fileInput?.nativeElement.click();
  }

  isImage(filename: string): boolean {
    return !!filename.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i);
  }

  buildAttachmentUrl(filename: string): string {
    return this.attachmentService.buildAttachmentUrl(this.taskId, filename);
  }

  /* ==== PREVIEW ON HOVER ==== */
  showPreview(filename: string, event: MouseEvent) {
    if (!this.isImage(filename)) return;
    this.previewFilename.set(filename);
    this.previewUrl.set(this.buildAttachmentUrl(filename));
    this.previewTop.set(event.clientY + 14);
    this.previewLeft.set(event.clientX + 18);
  }
  hidePreview() {
    this.previewUrl.set(null);
    this.previewFilename.set(null);
  }

  /* ==== DRAG & DROP ==== */
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

  /* ==== FILE INPUT ==== */
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

  /* ==== FILE ACTIONS: Only emit to parent, logic in AttachmentService ==== */
  onDeleteAttachment(filename: string) {
    this.fileDeleted.emit(filename);
  }
  onDownloadAttachment(filename: string) {
    this.fileDownloaded.emit(filename);
  }
}
