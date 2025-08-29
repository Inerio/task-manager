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
  OnDestroy,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../services/alert.service";
import { isFileDragEvent } from "../../utils/drag-drop-utils";
import { AttachmentService } from "../../services/attachment.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

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
 * Preview: fetch blob via HttpClient (with header) → create object URL.
 */
@Component({
  selector: "app-attachment-zone",
  standalone: true,
  styleUrls: ["./attachment-zone.component.scss"],
  templateUrl: "./attachment-zone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class AttachmentZoneComponent implements OnDestroy {
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
  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly i18n = inject(TranslocoService);

  // ===== UI state =====
  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewFilename = signal<string | null>(null);
  readonly previewTop = signal(0);
  readonly previewLeft = signal(0);

  // ===== Internals =====
  /** Token used to ignore late async preview responses. */
  private previewToken = 0;
  /** Last created object URL (only for the currently displayed preview). */
  private lastObjectUrl: string | null = null;
  /** Avoid duplicate HTTP calls while a preview is being fetched. */
  private readonly inFlight = new Map<string, Promise<string>>();
  /** Small LRU cache of object URLs to reuse across hovers. */
  private readonly cache = new Map<string, string>();
  private readonly cacheOrder: string[] = [];
  private static readonly MAX_CACHE = 8;

  // ===== Lifecycle =====
  ngOnDestroy(): void {
    this.revokePreviewUrl();
    // Revoke all cached object URLs to prevent memory leaks.
    for (const url of this.cache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    this.cache.clear();
    this.cacheOrder.length = 0;
  }

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
      const accepted = files.filter((f) => this.matchesAccept(f));
      if (!accepted.length) return;

      this.handleSelectionWithAlerts(accepted);
    } catch {
      // User cancelled or API blocked: no-op.
    }
  }

  /** Accept filter supporting ".png,.pdf,image/*,application/pdf". */
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
    this.handleSelectionWithAlerts(Array.from(files));
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
      this.handleSelectionWithAlerts(Array.from(files));
    }
    this.isDragging.set(false);
  }

  // ===== Common selection handling =====
  private handleSelectionWithAlerts(selectedFiles: File[]): void {
    const sized = this.filterBySize(selectedFiles);
    if (sized.rejectedCount > 0) {
      this.alertService.show(
        "error",
        this.i18n.translate("attachments.errors.tooLarge")
      );
    }
    this.handleFileSelection(sized.accepted);
  }

  private filterBySize(files: File[]): {
    accepted: File[];
    rejectedCount: number;
  } {
    let rejectedCount = 0;
    const accepted = files.filter((f) => {
      const ok = f.size <= this.maxSize;
      if (!ok) rejectedCount++;
      return ok;
    });
    return { accepted, rejectedCount };
  }

  private handleFileSelection(selectedFiles: File[]): void {
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

  // ===== Preview helpers (HttpClient -> blob -> object URL) =====
  isImage(filename: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
  }

  /** Build URL kept for downloads; do NOT bind directly as <img src>. */
  buildAttachmentUrl(filename: string): string {
    return this.attachmentService.buildAttachmentUrl(this.taskId, filename);
  }

  /** Only updates the position of the preview popover (no network). */
  onPreviewMove(event: MouseEvent): void {
    if (!this.previewUrl()) return;
    this.previewTop.set(event.clientY + 14);
    this.previewLeft.set(event.clientX + 18);
  }

  async showPreview(filename: string, event: MouseEvent): Promise<void> {
    if (!this.isImage(filename)) return;

    // Always update position quickly.
    this.previewTop.set(event.clientY + 14);
    this.previewLeft.set(event.clientX + 18);

    const key = this.previewKey(this.taskId, filename);

    // Cache hit → reuse without new HTTP calls.
    const cached = this.cache.get(key);
    if (cached) {
      this.previewFilename.set(filename);
      this.previewUrl.set(cached);
      return;
    }

    // If a request is already in-flight for this file, avoid starting another.
    if (this.inFlight.has(key)) {
      this.previewFilename.set(filename);
      return;
    }

    // Start a single fetch for this preview and cache it when done.
    const promise = this.attachmentService.getPreviewObjectUrl(
      this.taskId,
      filename
    );
    this.inFlight.set(key, promise);

    try {
      const objectUrl = await promise;
      this.addToCache(key, objectUrl);

      // Only update the preview if the user is still hovering this file.
      if (
        this.previewFilename() === null ||
        this.previewFilename() === filename
      ) {
        this.previewFilename.set(filename);
        this.previewUrl.set(objectUrl);
      }
    } catch {
      // On error, ensure no stale preview stays
      this.hidePreview();
    } finally {
      this.inFlight.delete(key);
    }
  }

  hidePreview(): void {
    this.previewUrl.set(null);
    this.previewFilename.set(null);
  }

  private revokePreviewUrl(): void {
    if (this.lastObjectUrl) {
      try {
        URL.revokeObjectURL(this.lastObjectUrl);
      } catch {
        // Ignore revoke errors
      }
      this.lastObjectUrl = null;
    }
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

  // ===== Cache helpers =====
  private previewKey(taskId: number, filename: string): string {
    return `${taskId}::${filename}`;
  }

  /** Simple LRU to cap memory usage from object URLs. */
  private addToCache(key: string, url: string): void {
    if (this.cache.has(key)) {
      // Refresh LRU order
      const idx = this.cacheOrder.indexOf(key);
      if (idx >= 0) this.cacheOrder.splice(idx, 1);
    }
    this.cache.set(key, url);
    this.cacheOrder.push(key);

    if (this.cacheOrder.length > AttachmentZoneComponent.MAX_CACHE) {
      const evictKey = this.cacheOrder.shift()!;
      const evictUrl = this.cache.get(evictKey);
      if (evictUrl) {
        try {
          URL.revokeObjectURL(evictUrl);
        } catch {
          // ignore
        }
      }
      this.cache.delete(evictKey);
    }
  }
}
