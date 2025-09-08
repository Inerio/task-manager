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
import { AttachmentPickerService } from "../../services/attachment-picker.service";
import { StopBubblingDirective } from "../task-form/stop-bubbling.directive";

/**
 * AttachmentZoneComponent: handles both standard uploads (edit mode)
 * and deferred uploads (creation mode).
 *
 * Preview hover -> PreviewHoverDirective.
 * Popover rendering -> ImagePreviewPopoverComponent.
 * File selection/validation -> FileSelectionService.
 * Drag & drop -> DropzoneDirective.
 * Tag rendering -> AttachmentTagComponent.
 * Opening picker (FS Access vs <input>) -> AttachmentPickerService.
 * Event propagation shielding -> StopBubblingDirective.
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
    StopBubblingDirective,
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
  private readonly picker = inject(AttachmentPickerService);

  // ===== UI state =====
  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewFilename = signal<string | null>(null);
  readonly previewTop = signal(0);
  readonly previewLeft = signal(0);

  // Promise resolver used by the hidden input fallback.
  private inputResolve: ((files: File[]) => void) | undefined;

  // ===== Track helpers (stable references for @for trackBy) =====
  trackByFilename(_index: number, filename: string): string {
    return filename;
  }
  trackByFile(_index: number, file: File): string {
    return file.name;
  }

  // ===== Open dialog (via service) =====
  onZoneClick(): void {
    void this.openWithService();
  }

  private async openWithService(): Promise<void> {
    const files = await this.picker.pick({
      accept: this.acceptTypes,
      multiple: true,
      beforeOpen: () => this.dialogOpen.emit(true),
      afterClose: () => this.dialogOpen.emit(false),
      openWithInput: () => this.openHiddenInputAsPromise(),
    });
    if (files?.length) this.onFilesSelected(files);
  }

  // Wrap hidden file input into a Promise and resolve on "change".
  private openHiddenInputAsPromise(): Promise<File[]> {
    const input = this.fileInput?.nativeElement;
    if (!input) return Promise.resolve([]);

    return new Promise<File[]>((resolve) => {
      let settled = false;

      const onFocusBack = () => {
        // If the user cancels, "change" won't fire; resolve with [] on focus return.
        setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener("focus", onFocusBack, true);
          resolve([]);
        }, 0);
      };

      window.addEventListener("focus", onFocusBack, true);

      this.inputResolve = (files) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("focus", onFocusBack, true);
        resolve(files);
      };

      input.click();
    });
  }

  // ===== Hidden input change handler (used by the fallback Promise) =====
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    const files = list && list.length ? Array.from(list) : [];
    this.inputResolve?.(files);
    this.inputResolve = undefined;
    input.value = "";
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
