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
import { AlertService } from "../../../../core/services/alert.service";
import { ConfirmDialogService } from "../../../../core/services/dialog/confirm-dialog.service";
import { PreviewHoverDirective } from "../../directives/preview-hover.directive";
import { ImagePreviewPopoverComponent } from "../image-preview-popover/image-preview-popover.component";
import { FileSelectionService } from "../../data/file-selection.service";
import { DropzoneDirective } from "../../directives/dropzone.directive";
import { AttachmentTagComponent } from "../attachment-tag/attachment-tag.component";
import { AttachmentPickerService } from "../../data/attachment-picker.service";
import { StopBubblingDirective } from "../../../../shared/directives/stop-bubbling.directive";
import { UPLOAD_CONFIG, type UploadConfig } from "../../tokens/upload.config";
import { ClampToRowsDirective } from "../../directives/clamp-to-rows.directive";

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
    ClampToRowsDirective,
  ],
})
export class AttachmentZoneComponent {
  @Input({ required: true }) attachments!: ReadonlyArray<string>;
  @Input({ required: true }) taskId!: number;
  @Input() acceptTypes?: string;
  @Input() maxSize?: number;
  @Input() creationMode = false;
  @Input() pendingFiles: File[] = [];

  @Output() readonly filesUploaded = new EventEmitter<File[]>();
  @Output() readonly fileDeleted = new EventEmitter<string>();
  @Output() readonly fileDownloaded = new EventEmitter<string>();
  @Output() readonly dialogOpen = new EventEmitter<boolean>();

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  private readonly alertService = inject(AlertService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly i18n = inject(TranslocoService);
  private readonly fileSelection = inject(FileSelectionService);
  private readonly picker = inject(AttachmentPickerService);
  private readonly uploadCfg = inject<UploadConfig>(UPLOAD_CONFIG, {
    optional: true,
  });

  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewFilename = signal<string | null>(null);
  readonly previewTop = signal(0);
  readonly previewLeft = signal(0);

  readonly expanded = signal(false);
  readonly needsToggle = signal(false);
  readonly collapsedMaxHeight = signal(0);

  private inputResolve: ((files: File[]) => void) | undefined;

  get effectiveAccept(): string {
    return this.acceptTypes ?? this.uploadCfg?.acceptTypes ?? "";
  }
  get effectiveMaxSize(): number {
    return this.maxSize ?? this.uploadCfg?.maxSize ?? 5 * 1024 * 1024;
  }

  trackByFilename(_index: number, filename: string): string {
    return filename;
  }
  trackByFile(_index: number, file: File): string {
    return file.name;
  }

  /** Safety: force-hide any preview (used before actions and on container exits). */
  private hidePreview(): void {
    this.previewUrl.set(null);
    this.previewFilename.set(null);
  }

  onZoneClick(): void {
    this.hidePreview();
    void this.openWithService();
  }

  onZoneKeydown(ev: Event): void {
    const e = ev as KeyboardEvent;
    const key = e.key || "";
    if (key === "Enter" || key === " ") e.preventDefault();
  }

  private async openWithService(): Promise<void> {
    const files = await this.picker.pick({
      accept: this.effectiveAccept,
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

      const cleanup = () => {
        window.removeEventListener("focus", onFocusBack, true);
        this.inputResolve = undefined;
      };

      const onFocusBack = () => {
        setTimeout(() => {
          if (settled) return;
          const hasFiles = !!input.files && input.files.length > 0;
          if (hasFiles) return;
          settled = true;
          cleanup();
          resolve([]);
        }, 200);
      };

      window.addEventListener("focus", onFocusBack, true);

      this.inputResolve = (files) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(files);
      };

      input.click();
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    const files = list && list.length ? Array.from(list) : [];
    this.inputResolve?.(files);
    this.inputResolve = undefined;
    input.value = "";
  }

  onFilesSelected(files: File[]): void {
    if (!files?.length) return;
    this.handleSelectionWithAlerts(files);
  }

  private handleSelectionWithAlerts(selectedFiles: File[]): void {
    const existing = [
      ...this.attachments,
      ...(this.creationMode ? this.pendingFiles.map((f) => f.name) : []),
    ];

    const { accepted, rejected } = this.fileSelection.select(selectedFiles, {
      accept: this.effectiveAccept,
      maxSize: this.effectiveMaxSize,
      existing,
    });

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

    if (accepted.length) this.filesUploaded.emit(accepted);
  }

  onDeleteAttachment(filename: string): void {
    this.hidePreview();
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
    this.hidePreview();
    this.fileDeleted.emit(filename);
  }

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

  getUniqueAttachments(): string[] {
    const seen = new Set<string>();
    return this.attachments.filter((filename) => {
      if (seen.has(filename)) return false;
      seen.add(filename);
      return true;
    });
  }

  toggleExpand(): void {
    this.expanded.update((v) => !v);
  }

  /** Prevent toggle button events from opening the picker in the parent zone. */
  onToggleClick(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    (
      ev as { stopImmediatePropagation?: () => void }
    ).stopImmediatePropagation?.();
    this.hidePreview();
    this.toggleExpand();
  }

  onToggleKeydown(ev: Event): void {
    const e = ev as KeyboardEvent;
    const key = e.key ?? "";
    if (key !== "Enter" && key !== " ") return;

    ev.preventDefault();
    ev.stopPropagation();
    (
      ev as { stopImmediatePropagation?: () => void }
    ).stopImmediatePropagation?.();
    this.hidePreview();
    this.toggleExpand();
  }

  /** Safety: close preview whenever pointer leaves the whole zone. */
  onZoneMouseLeave(): void {
    this.hidePreview();
  }

  /** Safety: close preview when pointer leaves the list wrapper. */
  onListMouseLeave(): void {
    this.hidePreview();
  }
}
