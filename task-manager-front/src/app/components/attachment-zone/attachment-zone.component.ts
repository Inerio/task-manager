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
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { PreviewHoverDirective } from "./preview-hover.directive";
import { ImagePreviewPopoverComponent } from "./image-preview-popover.component";
import { FileSelectionService } from "../../services/file-selection.service";
import { DropzoneDirective } from "./dropzone.directive";
import { AttachmentTagComponent } from "./attachment-tag.component";

/** Minimal local types to avoid `any` while staying framework-agnostic. */
type FSFileHandle = { getFile(): Promise<File> };
type OpenFilePickerOptions = {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
};

/**
 * AttachmentZoneComponent: handles both standard uploads (edit mode)
 * and deferred uploads (creation mode).
 *
 * Preview hover is delegated to PreviewHoverDirective.
 * Popover rendering is isolated in ImagePreviewPopoverComponent.
 * File selection/validation is centralized in FileSelectionService.
 * Drag & drop is delegated to DropzoneDirective.
 * Tag rendering is delegated to AttachmentTagComponent.
 */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    PreviewHoverDirective,
    ImagePreviewPopoverComponent,
    DropzoneDirective,
    AttachmentTagComponent,
  ],
})
export class AttachmentZoneComponent {
  // ===== Inputs =====
  @Input({ required: true }) attachments!: ReadonlyArray<string>;
  @Input({ required: true }) taskId!: number;
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;
  @Input() creationMode = false;
  @Input() pendingFiles: File[] = [];

  // ===== Outputs =====
  @Output() readonly filesUploaded = new EventEmitter<File[]>();
  @Output() readonly fileDeleted = new EventEmitter<string>();
  @Output() readonly fileDownloaded = new EventEmitter<string>();
  @Output() readonly dialogOpen = new EventEmitter<boolean>();

  // ===== Template refs =====
  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  // ===== Injections =====
  private readonly alertService = inject(AlertService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly i18n = inject(TranslocoService);
  private readonly fileSelection = inject(FileSelectionService);

  // ===== UI state =====
  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewFilename = signal<string | null>(null);
  readonly previewTop = signal(0);
  readonly previewLeft = signal(0);

  // ===== Track helpers (stable references for @for trackBy) =====
  trackByFilename(_index: number, filename: string): string {
    return filename;
  }
  trackByFile(_index: number, file: File): string {
    return file.name;
  }

  // ===== Event suppression inside the zone =====
  public stop(e: Event): void {
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
    // Fallback to the hidden input (keeps existing behavior).
    this.dialogOpen.emit(true);
    const input = this.fileInput?.nativeElement;
    if (input) input.click();
  }

  /** FS Access support check. */
  private canUseFSAccess(): boolean {
    return "showOpenFilePicker" in window && isSecureContext === true;
  }

  /**
   * Open using File System Access API.
   * Do not emit `dialogOpen` here (avoid upstream native picker guards).
   */
  private async openViaFSAccess(): Promise<void> {
    try {
      const picker = (
        window as unknown as {
          showOpenFilePicker: (
            options: OpenFilePickerOptions
          ) => Promise<FSFileHandle[]>;
        }
      ).showOpenFilePicker;
      if (!picker) return;

      const handles = await picker({
        multiple: true,
        excludeAcceptAllOption: false,
      });
      const files = await Promise.all(handles.map((h) => h.getFile()));

      // Let FileSelectionService handle accept/size/dedupe.
      this.handleSelectionWithAlerts(files);
    } catch {
      // User cancelled or API blocked: no-op.
    }
  }

  // ===== <input type="file"> fallback =====
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      this.dialogOpen.emit(false);
      return;
    }
    this.handleSelectionWithAlerts(Array.from(files));
    input.value = "";
    this.dialogOpen.emit(false);
  }

  // ===== Dropzone integration =====
  onFilesSelected(files: File[]): void {
    if (!files?.length) return;
    this.handleSelectionWithAlerts(files);
  }

  // ===== Common selection handling (centralized) =====
  private handleSelectionWithAlerts(selectedFiles: File[]): void {
    const existing = [
      ...this.attachments,
      ...(this.creationMode ? this.pendingFiles.map((f) => f.name) : []),
    ];

    const { accepted, rejected } = this.fileSelection.select(selectedFiles, {
      accept: this.acceptTypes,
      maxSize: this.maxSize,
      existing,
    });

    // Raise alerts based on counters (keep messages short and independent).
    if (rejected.notAccepted > 0) {
      this.alertService.show(
        "error",
        this.i18n.translate("attachments.errors.notAccepted")
      );
    }
    if (rejected.tooLarge > 0) {
      this.alertService.show(
        "error",
        this.i18n.translate("attachments.errors.tooLarge")
      );
    }
    if (rejected.duplicated > 0) {
      this.alertService.show(
        "error",
        this.i18n.translate("attachments.errors.alreadyAttached")
      );
    }

    if (accepted.length) {
      this.filesUploaded.emit(accepted);
    }
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

  // ===== Preview popover state =====
  isImage(filename: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
  }

  onPreviewShow(e: {
    url: string;
    x: number;
    y: number;
    filename: string;
  }): void {
    this.previewUrl.set(e.url);
    this.previewFilename.set(e.filename);
    this.previewLeft.set(e.x);
    this.previewTop.set(e.y);
  }

  onPreviewMove(e: { x: number; y: number }): void {
    if (!this.previewUrl()) return;
    this.previewLeft.set(e.x);
    this.previewTop.set(e.y);
  }

  onPreviewHide(): void {
    this.previewUrl.set(null);
    this.previewFilename.set(null);
  }

  /** Return a deduplicated list of attached files, preserving order. */
  getUniqueAttachments(): string[] {
    const seen = new Set<string>();
    return this.attachments.filter((filename) => {
      if (seen.has(filename)) return false;
      seen.add(filename);
      return true;
    });
  }
}
