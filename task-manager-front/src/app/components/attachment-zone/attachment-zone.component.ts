import {
  ChangeDetectionStrategy,
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
 * AttachmentZoneComponent: handles both standard uploads (edit mode)
 * and deferred/buffered uploads in creation mode.
 * Also emits (dialogOpen) to inform parent when native picker opens.
 */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentZoneComponent {
  @Input({ required: true }) attachments!: ReadonlyArray<string>;
  @Input({ required: true }) taskId!: number;
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;

  @Input() creationMode = false;
  @Input() pendingFiles: File[] = [];

  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewFilename = signal<string | null>(null);
  readonly previewTop = signal(0);
  readonly previewLeft = signal(0);

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);

  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();
  @Output() dialogOpen = new EventEmitter<boolean>();

  trackByFilename(_index: number, filename: string): string {
    return filename;
  }
  trackByFile(_index: number, file: File): string {
    return file.name;
  }

  stop(e: Event): void {
    e.stopPropagation();
  }

  onZonePointerDown(e: PointerEvent): void {
    this.stop(e);
  }
  onZoneMouseDown(e: MouseEvent): void {
    this.stop(e);
  }
  onZoneMouseUp(e: MouseEvent): void {
    this.stop(e);
  }

  onZoneClick(e: MouseEvent): void {
    this.stop(e);
    this.openFileDialog();
  }

  private openFileDialog(): void {
    this.dialogOpen.emit(true);
    this.fileInput?.nativeElement.click();
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      this.dialogOpen.emit(false);
      return;
    }
    this.handleFileSelection(Array.from(files));
    input.value = "";
    this.dialogOpen.emit(false);
  }

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
    if (files?.length) this.handleFileSelection(Array.from(files));
    this.isDragging.set(false);
  }

  private handleFileSelection(selectedFiles: File[]) {
    const already = new Set([
      ...this.attachments,
      ...(this.creationMode ? this.pendingFiles.map((f) => f.name) : []),
    ]);
    const uniques = selectedFiles.filter((file) => !already.has(file.name));
    if (uniques.length < selectedFiles.length) {
      this.alertService.show(
        "error",
        "Some files were already attached and have been ignored."
      );
    }
    if (uniques.length) this.filesUploaded.emit(uniques);
  }

  onDeleteAttachment(filename: string): void {
    this.fileDeleted.emit(filename);
  }
  onDownloadAttachment(filename: string): void {
    this.fileDownloaded.emit(filename);
  }
  onDeletePendingFile(filename: string): void {
    this.fileDeleted.emit(filename);
  }

  isImage(filename: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
  }

  buildAttachmentUrl(filename: string): string {
    return this.attachmentService.buildAttachmentUrl(this.taskId, filename);
  }

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

  /** Returns a deduplicated list of attached files, preserving order. */
  getUniqueAttachments(): string[] {
    const seen = new Set<string>();
    return this.attachments.filter((filename) => {
      if (seen.has(filename)) return false;
      seen.add(filename);
      return true;
    });
  }
}
