import {
  Component,
  Input,
  computed,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
  type WritableSignal,
  ChangeDetectionStrategy,
  effect,
  ViewChild,
  ElementRef,
  OnDestroy,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { toSignal } from "@angular/core/rxjs-interop";
import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { LinkifyPipe } from "../../pipes/linkify.pipe";
import { TaskService } from "../../services/task.service";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";
import { AttachmentService } from "../../services/attachment.service";
import { AlertService } from "../../services/alert.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { setTaskDragData } from "../../utils/drag-drop-utils";
import { TaskFormComponent } from "../task-form/task-form.component";
import { UPLOAD_CONFIG } from "../../tokens/upload.config";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

@Component({
  selector: "app-task",
  standalone: true,
  imports: [
    TranslocoModule,
    LinkifyPipe,
    AttachmentZoneComponent,
    TaskFormComponent,
  ],
  templateUrl: "./task.component.html",
  styleUrls: ["./task.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskComponent implements OnChanges, OnDestroy {
  // === Inputs ===
  @Input({ required: true }) task!: Task;
  /** Ghost mode: visual-only clone (used in placeholder). */
  @Input() ghost = false;

  // === Template refs ===
  @ViewChild("cardEl") private cardEl?: ElementRef<HTMLElement>;

  // === Injections ===
  private readonly taskService = inject(TaskService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly uploadCfg = inject(UPLOAD_CONFIG);
  private readonly i18n = inject(TranslocoService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  /** React to Transloco language changes as a signal (hot reactivity). */
  private readonly lang = toSignal(this.i18n.langChanges$, {
    initialValue: this.i18n.getActiveLang(),
  });

  // === Local state ===
  readonly localTask: WritableSignal<Task> = signal({} as Task);

  // Attachment constraints (from token)
  readonly acceptTypes = this.uploadCfg.acceptTypes;
  readonly maxSize = this.uploadCfg.maxSize;

  // DnD (own card)
  readonly dragging = signal(false);

  // --- Drop / save / create pulse (visual confirmation) ---
  readonly droppedPulse = signal(false);
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;

  /** Per-card debounce so we don't re-pulse on unrelated signal changes. */
  private readonly lastPulseToken = { drop: 0, created: 0, saved: 0 };
  /** If a drop arrives while this card is still "dragging", defer until drag end. */
  private _pendingDropToken: number | null = null;

  // === Drag overlay (custom ghost that follows the cursor) ===
  private _dragOverlayEl: HTMLElement | null = null;
  private _onDocDragOver: ((e: DragEvent) => void) | null = null;
  /** Global fallbacks to guarantee cleanup on fast drops/Escape. */
  private _onDocDragEnd: ((e: DragEvent) => void) | null = null;
  private _onDocDropCapture: ((e: DragEvent) => void) | null = null;
  private _onDocDropBubble: ((e: DragEvent) => void) | null = null;
  private _onDocKeydown: ((e: KeyboardEvent) => void) | null = null;
  private _onWindowBlur: ((e: FocusEvent) => void) | null = null;
  private _onDocVisibilityChange: ((e: Event) => void) | null = null;
  private _onWindowPageHide: ((e: PageTransitionEvent) => void) | null = null;
  private _onDocPointerUp: ((e: PointerEvent) => void) | null = null;
  private _onDocMouseUp: ((e: MouseEvent) => void) | null = null;

  private _overlayOffset = { x: 12, y: 10 };

  // === Truncation logic ===
  private readonly TITLE_TRUNCATE_BASE = 18;
  private readonly TITLE_TRUNCATE_WITH_BADGE = 22;
  private readonly DESC_TRUNCATE = 139;

  readonly showFullTitle = signal(false);
  readonly showFullDescription = signal(false);

  constructor() {
    // Pulse for "drop" — ensure it fires only on the real card (not ghost) and not while hidden by .dragging.
    effect(() => {
      const me = this.localTask().id;
      if (!me || this.ghost) return;

      const d = this.dragDropGlobal.lastDroppedTask();
      if (d && d.id === me && d.token !== this.lastPulseToken.drop) {
        if (this.dragging()) {
          // Defer until the native dragend cleanup makes the card visible again.
          this._pendingDropToken = d.token;
        } else {
          this.triggerPulse();
          this.lastPulseToken.drop = d.token;
        }
      }
    });

    // Release a deferred drop pulse as soon as the card is no longer dragging.
    effect(() => {
      if (this.ghost) return;
      if (!this.dragging() && this._pendingDropToken) {
        this.triggerPulse();
        this.lastPulseToken.drop = this._pendingDropToken;
        this._pendingDropToken = null;
      }
    });

    // Pulse for "created" / "saved" (not tied to dragging).
    effect(() => {
      if (this.ghost) return;
      const me = this.localTask().id;
      if (!me) return;

      const c = this.dragDropGlobal.lastCreatedTask();
      if (c && c.id === me && c.token !== this.lastPulseToken.created) {
        this.triggerPulse();
        this.lastPulseToken.created = c.token;
      }

      const s = this.dragDropGlobal.lastSavedTask();
      if (s && s.id === me && s.token !== this.lastPulseToken.saved) {
        this.triggerPulse();
        this.lastPulseToken.saved = s.token;
      }
    });

    // When a task switches to edit mode, ensure the whole form is visible.
    effect(() => {
      if (this.localTask().isEditing) this.scheduleEnsureCardVisible();
    });

    // Hard safety: if global task drag stops for any reason, remove any leftover overlay.
    effect(() => {
      if (!this.dragDropGlobal.isTaskDrag()) this.cleanupDragOverlay();
    });
  }

  // === Computed (truncate) ===
  readonly titleTruncateLength = computed(() =>
    this.dueBadge() ? this.TITLE_TRUNCATE_WITH_BADGE : this.TITLE_TRUNCATE_BASE
  );

  readonly displayedTitle = computed(() => {
    const title = this.localTask().title ?? "";
    const maxLen = this.titleTruncateLength();
    if (this.showFullTitle() || !title) return title;
    return title.length <= maxLen ? title : title.slice(0, maxLen) + "…";
  });

  readonly displayedDescription = computed(() => {
    const desc = this.localTask().description ?? "";
    if (this.showFullDescription() || !desc) return desc;
    return desc.length <= this.DESC_TRUNCATE
      ? desc
      : desc.slice(0, this.DESC_TRUNCATE) + "…";
  });

  readonly canTruncateTitle = computed(() => {
    const title = this.localTask().title ?? "";
    return title.length > this.titleTruncateLength();
  });

  readonly canTruncateDescription = computed(
    () => (this.localTask().description ?? "").length > this.DESC_TRUNCATE
  );

  toggleTitleTruncate = (): void => {
    if (this.canTruncateTitle()) this.showFullTitle.set(!this.showFullTitle());
  };

  toggleDescriptionTruncate = (): void => {
    if (this.canTruncateDescription())
      this.showFullDescription.set(!this.showFullDescription());
  };

  // === i/o changes ===
  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
      this.showFullTitle.set(false);
      this.showFullDescription.set(false);
    }
  }

  ngOnDestroy(): void {
    // Defensive: never leave global listeners or overlay behind.
    this.cleanupDragOverlay();
  }

  // === Ensure the edit form is fully visible ===
  private ensureCardFullyVisible(): void {
    const el = this.cardEl?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vpH = window.innerHeight || document.documentElement.clientHeight;

    const TOP_MARGIN = 8;
    const BOTTOM_SAFE = 0;

    let dy = 0;
    if (rect.top < TOP_MARGIN) {
      dy = rect.top - TOP_MARGIN;
    } else if (rect.bottom > vpH - BOTTOM_SAFE) {
      dy = rect.bottom - (vpH - BOTTOM_SAFE);
    }

    if (dy !== 0) window.scrollBy({ top: dy, behavior: "smooth" });
  }

  private scheduleEnsureCardVisible(): void {
    // Simple spaced retries to cover transitions.
    const runs = [0, 80, 160, 260, 360] as const;
    runs.forEach((t) => setTimeout(() => this.ensureCardFullyVisible(), t));
  }

  private triggerPulse(): void {
    // Always restart the CSS animation reliably.
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this.droppedPulse.set(false);

    // Force a reflow so removing the class is flushed before re-adding.
    const el = this.cardEl?.nativeElement;
    if (el) {
      el.classList.remove("dropped-pulse"); // safety: in case binding hasn't flushed yet
      void el.offsetWidth; // reflow
    }

    // Next frame: set the boolean so the class is re-added and animation restarts.
    requestAnimationFrame(() => {
      this.droppedPulse.set(true);
      this._pulseTimer = setTimeout(() => this.droppedPulse.set(false), 950);
    });
  }

  // === Drag & drop handlers (for the dragged card itself) ===
  onTaskDragStart(event: DragEvent): void {
    if (this.ghost || this.localTask().isEditing) {
      event.preventDefault();
      return;
    }
    this.dragging.set(true);

    // Init global + DataTransfer payload (single source of truth).
    this.initDragState(event);

    // Capture size to drive placeholder height and smooth collapse.
    this.applyPlaceholderSizing();

    // Use a custom overlay that follows the cursor (no browser crop).
    this.applyDragOverlay(event);
  }

  onTaskDragEnd(): void {
    if (this.ghost) return;
    this.dragging.set(false);
    this.dragDropGlobal.endDrag();
    this.cleanupDragOverlay();

    const el = this.cardEl?.nativeElement;
    if (el) {
      el.style.height = "";
      el.style.willChange = "";
    }
  }

  // === CRUD & editing (delegated to TaskForm) ===
  startEdit(): void {
    this.patchLocalTask({ isEditing: true });
    this.scheduleEnsureCardVisible();
  }

  async saveEdit(payload: TaskWithPendingFiles): Promise<void> {
    const pendingFiles = payload._pendingFiles;

    const fullTask: Task = {
      ...this.localTask(),
      ...payload,
      title: payload.title ?? this.localTask().title ?? "",
      description: payload.description ?? this.localTask().description ?? "",
      kanbanColumnId:
        payload.kanbanColumnId ?? this.localTask().kanbanColumnId!,
      completed: payload.completed ?? this.localTask().completed ?? false,
      isEditing: false,
    };
    this.localTask.set(fullTask);

    if (fullTask.id) {
      await this.taskService.updateTask(fullTask.id, fullTask);
      await this.refreshFromBackend(fullTask.id);
      this.dragDropGlobal.markTaskSaved(fullTask.id);
    } else {
      try {
        const createdTask = await this.taskService.createTask(fullTask);
        if (pendingFiles?.length) {
          const results = await Promise.all(
            pendingFiles.map((file) =>
              this.attachmentService.uploadAttachment(createdTask.id!, file)
            )
          );
          const lastTaskWithAttachments = results
            .reverse()
            .find((t) => t && t.attachments);
          if (lastTaskWithAttachments?.attachments) {
            this.localTask.set({
              ...createdTask,
              attachments: lastTaskWithAttachments.attachments,
            });
          } else {
            this.localTask.set(createdTask);
          }
        } else {
          this.localTask.set(createdTask);
        }
        if (createdTask.id) await this.refreshFromBackend(createdTask.id);
      } catch {
        this.alertService.show(
          "error",
          this.i18n.translate("errors.creatingTask")
        );
      }
    }
  }

  async cancelEdit(): Promise<void> {
    const id = this.localTask().id ?? this.task.id;
    if (id) await this.refreshFromBackend(id);
    else this.patchLocalTask({ isEditing: false });
  }

  async confirmDelete(): Promise<void> {
    const id = this.localTask().id;
    if (!id) return;

    const title =
      this.localTask().title || this.i18n.translate("task.titlePlaceholder");
    const ok = await this.confirmDialog.open(
      this.i18n.translate("task.deleteConfirmTitle"),
      this.i18n.translate("task.deleteConfirmMessage", { title })
    );
    if (!ok) return;

    await this.taskService.deleteTask(id);
  }

  toggleCompleted(): void {
    const updated = {
      ...this.localTask(),
      completed: !this.localTask().completed,
    };
    this.patchLocalTask({ completed: updated.completed });
    this.taskService.updateTask(updated.id!, updated);
  }

  onDescriptionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    if (this.canTruncateDescription()) this.toggleDescriptionTruncate();
  }

  patchLocalTask(patch: Partial<Task>): void {
    this.localTask.set({ ...this.localTask(), ...patch });
  }

  onAttachmentUploaded(files: File[]): void {
    const taskId = this.localTask().id!;
    if (!taskId) return;

    Promise.all(
      files.map((file) => this.attachmentService.uploadAttachment(taskId, file))
    ).then(() => {
      this.taskService.fetchTaskById(taskId).then((freshTask) => {
        if (freshTask?.attachments) {
          this.localTask.set({
            ...this.localTask(),
            attachments: freshTask.attachments,
          });
          this.taskService.updateTaskFromApi(freshTask);
        }
        this.taskService.refreshTaskById(taskId);
      });
    });
  }

  onAttachmentDeleted(filename: string): void {
    const taskId = this.localTask().id!;
    if (!taskId) return;

    this.attachmentService
      .deleteAttachment(taskId, filename)
      .then((updated) => {
        if (updated?.attachments) {
          this.localTask.set({
            ...this.localTask(),
            attachments: updated.attachments,
          });
          this.taskService.updateTaskFromApi(updated);
        }
      });
  }

  onAttachmentDownloaded(filename: string): void {
    const taskId = this.localTask().id!;
    if (!taskId) return;
    this.attachmentService.downloadAttachment(taskId, filename);
  }

  /** Refetch a task and sync both local and global state. */
  async refreshFromBackend(id: number): Promise<void> {
    const fresh = await this.taskService.fetchTaskById(id);
    if (fresh) {
      this.localTask.set({ ...fresh, isEditing: false });
      this.taskService.updateTaskFromApi(fresh);
    }
  }

  // ===== DUE BADGE + DATE (language-reactive) =====

  /** Parse YYYY-MM-DD as a *local* date (avoid TZ shifts). */
  private parseLocalISO(iso: string): Date | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  /** Compute day difference (due - today), or null if unavailable. */
  private computeDueDiffDays(): number | null {
    const dueRaw = this.localTask().dueDate;
    if (!dueRaw) return null;

    const dueDate = this.parseLocalISO(dueRaw);
    if (!dueDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /** Localized badge text that recomputes when the language changes. */
  readonly dueBadge = computed(() => {
    // Recompute when language changes.
    this.lang();

    const diffDays = this.computeDueDiffDays();
    if (diffDays == null) return null;

    if (diffDays < 0) return this.i18n.translate("task.due.late");
    if (diffDays === 0) return this.i18n.translate("task.due.today");
    if (diffDays === 1) return this.i18n.translate("task.due.oneDay");
    return this.i18n.translate("task.due.nDays", { count: diffDays });
  });

  /** True if due date is in the past (separate from i18n). */
  readonly isDueLate = computed(() => {
    const diff = this.computeDueDiffDays();
    return diff != null && diff < 0;
  });

  /** Localized due date text (en: month/day/year, fr: day/month/year). */
  readonly formattedDueDate = computed(() => {
    const lang = (this.lang() as string) || "en";

    const raw = this.localTask().dueDate;
    if (!raw) return null;

    const date = this.parseLocalISO(raw);
    if (!date) return null;

    const locale = lang.startsWith("fr") ? "fr-FR" : "en-US";
    // Use short month + 2-digit day for compact badge row.
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  });

  // ===== DnD helpers =====

  /** Initialize global drag state and DataTransfer payload. */
  private initDragState(event: DragEvent): void {
    const id = this.localTask().id!;
    const columnId = this.localTask().kanbanColumnId!;
    setTaskDragData(event, id, columnId);
    this.dragDropGlobal.startTaskDrag(id, columnId);
    if (event.dataTransfer) {
      // Hint intent for better cursor/UX across browsers.
      event.dataTransfer.effectAllowed = "move";
    }
  }

  /** Capture card size to drive placeholder height + smooth collapse of source. */
  private applyPlaceholderSizing(): void {
    const el = this.cardEl?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.dragDropGlobal.setDragPreviewSize(rect.width, rect.height);
    el.style.height = `${Math.round(rect.height)}px`;
    el.style.willChange = "height, margin, padding";
  }

  /**
   * Create a minimal, semi-transparent overlay that follows the cursor.
   * We hide the native drag image to avoid browser sizing/cropping.
   */
  private applyDragOverlay(event: DragEvent): void {
    // Clean previous overlay if any.
    this.cleanupDragOverlay();

    const src = this.cardEl?.nativeElement;
    const { width, height } = src?.getBoundingClientRect() ?? {
      width: 220,
      height: 72,
    };

    // Light clone: exact proportions, but no interactive affordances.
    const overlay = (
      src ? src.cloneNode(true) : document.createElement("div")
    ) as HTMLElement;

    overlay.classList.remove(
      "dragging",
      "drag-over-card",
      "dropped-pulse",
      "ghost"
    );
    overlay.classList.add("task-drag-overlay");

    // Frame & positioning controlled here; visuals handled by CSS class.
    overlay.style.width = `${Math.round(width)}px`;
    overlay.style.height = `${Math.round(height)}px`;
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.margin = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";
    overlay.style.transition = "none";
    overlay.style.transform = "translate(-9999px, -9999px)";

    // Disable interactivity inside the clone.
    overlay
      .querySelectorAll("button, [href], input, textarea, select")
      .forEach((el) => {
        (el as HTMLElement).setAttribute("disabled", "true");
        (el as HTMLElement).style.pointerEvents = "none";
      });

    if (!src) {
      // Minimal fallback when no source node is available.
      overlay.textContent = this.localTask().title ?? "";
      overlay.style.padding = "0.6rem 1rem";
    }

    document.body.appendChild(overlay);
    this._dragOverlayEl = overlay;

    // Cursor grip offset (feels more natural than top-left sticking).
    const offsetX = Math.min(24, Math.round(width * 0.12));
    const offsetY = Math.min(20, Math.round(height * 0.1));
    this._overlayOffset = { x: offsetX, y: offsetY };

    // Always track cursor, even if dropzones stop propagation.
    this._onDocDragOver = (e: DragEvent) => {
      const x = (e.clientX ?? 0) - this._overlayOffset.x;
      const y = (e.clientY ?? 0) - this._overlayOffset.y;
      overlay.style.transform = `translate(${x}px, ${y}px)`;
    };
    document.addEventListener("dragover", this._onDocDragOver, {
      capture: true,
    });

    // --- Global fallbacks to guarantee cleanup on fast drops / ESC ---
    const hardEnd = () => {
      // Ensure we don't leave a stuck overlay when dropping very fast.
      this.dragging.set(false);
      this.dragDropGlobal.endDrag();
      this.cleanupDragOverlay();
    };
    const softOverlayOnly = () => {
      // Do not touch global drag state; lets column drop handlers run.
      this.cleanupDragOverlay();
    };

    this._onDocDragEnd = (_e: DragEvent) => hardEnd();

    // Use BOTH capture + bubble:
    // - capture: overlay cleanup even if targets stopPropagation()
    // - bubble: full end after targets handled
    this._onDocDropCapture = (_e: DragEvent) => softOverlayOnly();
    this._onDocDropBubble = (_e: DragEvent) => hardEnd();

    this._onDocKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hardEnd();
    };

    document.addEventListener("dragend", this._onDocDragEnd, { capture: true });
    document.addEventListener("drop", this._onDocDropCapture, {
      capture: true,
    });
    document.addEventListener("drop", this._onDocDropBubble, {
      capture: false,
    });
    document.addEventListener("keydown", this._onDocKeydown, { capture: true });

    // Extra safety for window/tab changes or odd pointer sequences.
    this._onWindowBlur = (_e: FocusEvent) => hardEnd();
    this._onDocVisibilityChange = () => {
      if (document.hidden) hardEnd();
    };
    this._onWindowPageHide = (_e: PageTransitionEvent) => hardEnd();
    window.addEventListener("blur", this._onWindowBlur, { capture: true });
    document.addEventListener("visibilitychange", this._onDocVisibilityChange, {
      capture: true,
    });
    window.addEventListener("pagehide", this._onWindowPageHide);

    // Soft overlay removal if the platform emits only pointer/mouse up.
    this._onDocPointerUp = () => softOverlayOnly();
    this._onDocMouseUp = () => softOverlayOnly();
    document.addEventListener("pointerup", this._onDocPointerUp, {
      capture: true,
    });
    document.addEventListener("mouseup", this._onDocMouseUp, {
      capture: true,
    });

    // Hide native drag image so ONLY our overlay is visible.
    const shim = document.createElement("canvas");
    shim.width = 1;
    shim.height = 1;
    event.dataTransfer?.setDragImage(shim, 0, 0);
  }

  /** Remove the overlay and detach the document listeners. */
  private cleanupDragOverlay(): void {
    if (this._onDocDragOver) {
      document.removeEventListener("dragover", this._onDocDragOver, {
        capture: true,
      } as any);
      this._onDocDragOver = null;
    }
    if (this._onDocDragEnd) {
      document.removeEventListener("dragend", this._onDocDragEnd, {
        capture: true,
      } as any);
      this._onDocDragEnd = null;
    }
    if (this._onDocDropCapture) {
      document.removeEventListener("drop", this._onDocDropCapture, {
        capture: true,
      } as any);
      this._onDocDropCapture = null;
    }
    if (this._onDocDropBubble) {
      document.removeEventListener("drop", this._onDocDropBubble, {
        capture: false,
      } as any);
      this._onDocDropBubble = null;
    }
    if (this._onDocKeydown) {
      document.removeEventListener("keydown", this._onDocKeydown, {
        capture: true,
      } as any);
      this._onDocKeydown = null;
    }
    if (this._onWindowBlur) {
      window.removeEventListener("blur", this._onWindowBlur, {
        capture: true,
      } as any);
      this._onWindowBlur = null;
    }
    if (this._onDocVisibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        this._onDocVisibilityChange,
        { capture: true } as any
      );
      this._onDocVisibilityChange = null;
    }
    if (this._onWindowPageHide) {
      window.removeEventListener("pagehide", this._onWindowPageHide as any);
      this._onWindowPageHide = null;
    }
    if (this._onDocPointerUp) {
      document.removeEventListener("pointerup", this._onDocPointerUp, {
        capture: true,
      } as any);
      this._onDocPointerUp = null;
    }
    if (this._onDocMouseUp) {
      document.removeEventListener("mouseup", this._onDocMouseUp, {
        capture: true,
      } as any);
      this._onDocMouseUp = null;
    }

    if (this._dragOverlayEl?.parentNode) {
      this._dragOverlayEl.parentNode.removeChild(this._dragOverlayEl);
    }
    this._dragOverlayEl = null;
  }
}
