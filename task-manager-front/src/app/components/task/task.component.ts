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
export class TaskComponent implements OnChanges {
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

  // === Truncation logic ===
  private readonly TITLE_TRUNCATE_BASE = 18;
  private readonly TITLE_TRUNCATE_WITH_BADGE = 22;
  private readonly DESC_TRUNCATE = 139;

  readonly showFullTitle = signal(false);
  readonly showFullDescription = signal(false);

  constructor() {
    // Pulse exactly once per new token for drop/created/saved.
    effect(() => {
      const me = this.localTask().id;
      if (!me) return;

      const d = this.dragDropGlobal.lastDroppedTask();
      if (d && d.id === me && d.token !== this.lastPulseToken.drop) {
        this.triggerPulse();
        this.lastPulseToken.drop = d.token;
      }

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
    this.droppedPulse.set(false);
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this.droppedPulse.set(true);
    this._pulseTimer = setTimeout(() => this.droppedPulse.set(false), 950);
  }

  // === Drag & drop handlers (for the dragged card itself) ===
  onTaskDragStart(event: DragEvent): void {
    if (this.ghost || this.localTask().isEditing) {
      event.preventDefault();
      return;
    }
    this.dragging.set(true);

    setTaskDragData(
      event,
      this.localTask().id!,
      this.localTask().kanbanColumnId!
    );
    this.dragDropGlobal.startTaskDrag(
      this.localTask().id!,
      this.localTask().kanbanColumnId!
    );

    // Capture card size to size the placeholder accurately + smooth collapse.
    const cardEl = this.cardEl?.nativeElement;
    const rect = cardEl?.getBoundingClientRect();
    if (rect) {
      this.dragDropGlobal.setDragPreviewSize(rect.width, rect.height);
      cardEl!.style.height = `${Math.round(rect.height)}px`;
      cardEl!.style.willChange = "height, margin, padding";
    }

    // Build a nicer drag image snapshot.
    const card = (event.target as HTMLElement).closest(
      ".task-card"
    ) as HTMLElement | null;
    if (card) {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.classList.remove(
        "dragging",
        "drag-over-card",
        "dropped-pulse",
        "ghost"
      );
      clone.classList.add("task-drag-image");

      // Disable interactivity inside the clone.
      clone
        .querySelectorAll("button, [href], input, textarea, select")
        .forEach((el) => {
          (el as HTMLElement).setAttribute("disabled", "true");
          (el as HTMLElement).style.pointerEvents = "none";
        });

      const { width, height } = card.getBoundingClientRect();
      clone.style.width = `${Math.round(width)}px`;
      clone.style.height = `${Math.round(height)}px`;
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      clone.style.zIndex = "2147483647"; // max
      clone.style.transition = "none";
      document.body.appendChild(clone);
      const offsetX = Math.min(24, Math.round(width * 0.12));
      const offsetY = Math.min(20, Math.round(height * 0.1));
      event.dataTransfer?.setDragImage(clone, offsetX, offsetY);
      setTimeout(() => document.body.removeChild(clone), 0);
    } else {
      // Fallback snapshot.
      const dragImage = document.createElement("div");
      dragImage.textContent = this.localTask().title;
      dragImage.style.cssText = `
        position:absolute; top:-1000px; padding:0.6rem 1rem; background:white;
        border:2px solid var(--brand, #1976d2);
        box-shadow:0 8px 20px rgba(25,118,210,.25),0 3px 8px rgba(0,0,0,.15);
        border-radius:8px; font-weight:700; font-size:1rem;`;
      document.body.appendChild(dragImage);
      event.dataTransfer?.setDragImage(dragImage, 12, 10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }

  onTaskDragEnd(): void {
    if (this.ghost) return;
    this.dragging.set(false);
    this.dragDropGlobal.endDrag();
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
}
