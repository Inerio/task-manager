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
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../services/alert.service";
import { isFileDragEvent } from "../../utils/drag-drop-utils";
import { AttachmentService } from "../../services/attachment.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

/**
 * AttachmentZoneComponent: handles both standard uploads (edit mode)
 * and deferred/buffered uploads in creation mode.
 *
 * When available (Chromium + secure context), uses the File System Access API
 * to open files (no native <input> side-effects). Falls back to hidden
 * <input type="file"> on unsupported browsers.
 */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
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
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly i18n = inject(TranslocoService);

  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();
  /**
   * Emitted only for the <input> fallback to let parent know a native dialog opens.
   * (The FS Access path does not emit to avoid ghost events/guards.)
   */
  @Output() dialogOpen = new EventEmitter<boolean>();

  // ===== Track helpers =====
  trackByFilename(_index: number, filename: string): string {
    return filename;
  }
  trackByFile(_index: number, file: File): string {
    return file.name;
  }

  // ===== Event suppression inside the zone =====
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

  // ===== Open dialog =====
  onZoneClick(e: MouseEvent): void {
    this.stop(e);
    void this.openFileDialog();
  }

  /** Decide which picker to use. */
  private async openFileDialog(): Promise<void> {
    if (this.canUseFSAccess()) {
      await this.openViaFSAccess();
      return;
    }
    // Fallback to the hidden input (keeps your existing behavior).
    this.dialogOpen.emit(true);
    this.fileInput?.nativeElement.click();
  }

  /** FS Access support check. */
  private canUseFSAccess(): boolean {
    return (
      typeof (window as any).showOpenFilePicker === "function" &&
      window.isSecureContext
    );
  }

  /**
   * Open using File System Access API.
   * We don't emit dialogOpen here to avoid triggering "native picker" guards upstream.
   */
  private async openViaFSAccess(): Promise<void> {
    try {
      const handles: any[] = await (window as any).showOpenFilePicker({
        multiple: true,
        excludeAcceptAllOption: false,
      });
      const files = await Promise.all(handles.map((h: any) => h.getFile()));
      const accepted = files.filter((f) => this.matchesAccept(f));
      if (!accepted.length) return;

      const sized = accepted.filter((f) => f.size <= this.maxSize);
      if (sized.length < accepted.length) {
        this.alertService.show(
          "error",
          this.i18n.translate("attachments.errors.tooLarge")
        );
      }

      this.handleFileSelection(sized);
    } catch {
      // User cancelled or API blocked: do nothing.
    }
  }

  /** Accept filter supporting ".png,.pdf,image/*,application/pdf" */
  private matchesAccept(file: File): boolean {
    const accept = (this.acceptTypes || "").trim();
    if (!accept) return true;

    const rules = accept
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const name = file.name.toLowerCase();
    const type = (file.type || "").toLowerCase();

    return rules.some((rule) => {
      if (rule.startsWith(".")) return name.endsWith(rule);
      if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
  }

  // ===== <input type="file"> fallback =====
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      this.dialogOpen.emit(false);
      return;
    }
    const list = Array.from(files);
    const sized = list.filter((f) => f.size <= this.maxSize);
    if (sized.length < list.length) {
      this.alertService.show(
        "error",
        this.i18n.translate("attachments.errors.tooLarge")
      );
    }

    this.handleFileSelection(sized);
    input.value = "";
    this.dialogOpen.emit(false);
  }

  // ===== Drag & drop =====
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
      const list = Array.from(files);
      const sized = list.filter((f) => f.size <= this.maxSize);
      if (sized.length < list.length) {
        this.alertService.show(
          "error",
          this.i18n.translate("attachments.errors.tooLarge")
        );
      }
      this.handleFileSelection(sized);
    }
    this.isDragging.set(false);
  }

  // ===== Common selection handling =====
  private handleFileSelection(selectedFiles: File[]) {
    const already = new Set([
      ...this.attachments,
      ...(this.creationMode ? this.pendingFiles.map((f) => f.name) : []),
    ]);
    const uniques = selectedFiles.filter((file) => !already.has(file.name));
    if (uniques.length < selectedFiles.length) {
      this.alertService.show(
        "error",
        this.i18n.translate("attachments.errors.alreadyAttached")
      );
    }
    if (uniques.length) this.filesUploaded.emit(uniques);
  }

  // ===== Attachment actions =====
  onDeleteAttachment(filename: string): void {
    this.fileDeleted.emit(filename);
  }

  async onDownloadAttachment(filename: string): Promise<void> {
    const ok = await this.confirmDialog.open(
      this.i18n.translate("attachments.downloadConfirmTitle"),
      this.i18n.translate("attachments.downloadConfirmMessage", { filename })
    );
    if (!ok) return;
    this.fileDownloaded.emit(filename);
  }

  onDeletePendingFile(filename: string): void {
    this.fileDeleted.emit(filename);
  }

  // ===== Preview helpers =====
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
