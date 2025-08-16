import {
  Component,
  Input,
  Output,
  EventEmitter,
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
import { Task } from "../../models/task.model";
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
  @Input({ required: true }) task!: Task;
  @Output() taskDropped = new EventEmitter<DragEvent>();

  @ViewChild("cardEl") private cardEl?: ElementRef<HTMLElement>;

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

  readonly localTask: WritableSignal<Task> = signal({} as Task);

  // Attachment constraints (from token)
  readonly acceptTypes = this.uploadCfg.acceptTypes;
  readonly maxSize = this.uploadCfg.maxSize;

  // Local DnD flags
  private dragEnterCount = 0;
  private dragOver = signal(false);
  isDragOver = () => this.dragOver();
  readonly dragging = signal(false);

  // --- Drop / save / create pulse (visual confirmation) ---
  readonly droppedPulse = signal(false);
  private _pulseTimer: any = null;

  /** Per-card debounce so we don't re-pulse on unrelated signal changes. */
  private lastPulseToken = { drop: 0, created: 0, saved: 0 };

  constructor() {
    // Pulse exactly once per new token for drop/created/saved
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

    // When a task switches to edit mode, ensure the whole form is visible
    effect(() => {
      const editing = this.localTask().isEditing;
      if (editing) {
        this.scheduleEnsureCardVisible();
      }
    });
  }

  private triggerPulse(): void {
    this.droppedPulse.set(false);
    clearTimeout(this._pulseTimer);
    this.droppedPulse.set(true);
    this._pulseTimer = setTimeout(() => this.droppedPulse.set(false), 950);
  }

  // Truncation logic
  readonly TITLE_TRUNCATE_BASE = 18;
  readonly TITLE_TRUNCATE_WITH_BADGE = 22;
  readonly DESC_TRUNCATE = 139;
  readonly showFullTitle = signal(false);
  readonly showFullDescription = signal(false);

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
      this.showFullTitle.set(false);
      this.showFullDescription.set(false);
    }
  }

  // ==== Ensure the edit form is fully visible ====
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

    if (dy !== 0) {
      window.scrollBy({ top: dy, behavior: "smooth" });
    }
  }

  private scheduleEnsureCardVisible(): void {
    const runs = [0, 80, 160, 260, 360]; // ms
    runs.forEach((t) => setTimeout(() => this.ensureCardFullyVisible(), t));
  }

  // --- Drag & drop handlers (card only) ---
  onTaskDragStart(event: DragEvent): void {
    if (this.localTask().isEditing) {
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

    const card = (event.target as HTMLElement).closest(".task-card");
    if (card && card instanceof HTMLElement) {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.classList.remove("dragging", "drag-over-card");
      clone.querySelectorAll("button, input[type='checkbox']").forEach((el) => {
        (el as HTMLElement).setAttribute("disabled", "true");
        (el as HTMLElement).style.pointerEvents = "none";
        (el as HTMLElement).style.opacity = "0.6";
      });
      clone.style.width = `${(card as HTMLElement).offsetWidth}px`;
      clone.style.height = `${(card as HTMLElement).offsetHeight}px`;
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      clone.style.zIndex = "99999";
      clone.style.boxShadow = "0 4px 14px 2px #1976d23d";
      document.body.appendChild(clone);

      event.dataTransfer?.setDragImage(
        clone,
        clone.offsetWidth / 2,
        clone.offsetHeight / 2
      );
      setTimeout(() => document.body.removeChild(clone), 0);
    } else {
      const dragImage = document.createElement("div");
      dragImage.textContent = this.localTask().title;
      dragImage.style.cssText = `
        position: absolute; top: -1000px; padding: 0.5rem 1rem; background: white;
        border: 1px solid #ccc; box-shadow: 0 0 5px rgba(0,0,0,0.3);
        border-radius: 4px; font-weight: bold; font-size: 1rem;`;
      document.body.appendChild(dragImage);
      event.dataTransfer?.setDragImage(dragImage, 10, 10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }

  onTaskDragEnd(): void {
    this.dragging.set(false);
    this.dragDropGlobal.endDrag();
  }

  onTaskDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onTaskDragEnter(_event?: DragEvent): void {
    if (!this.localTask().isEditing && this.dragDropGlobal.isTaskDrag()) {
      this.dragEnterCount++;
      this.dragOver.set(true);
    }
  }

  onTaskDragLeave(_event?: DragEvent): void {
    if (!this.localTask().isEditing && this.dragDropGlobal.isTaskDrag()) {
      this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
      if (this.dragEnterCount === 0) this.dragOver.set(false);
    }
  }

  onTaskDrop(event: DragEvent): void {
    if (this.localTask().isEditing) return;
    if (!event.dataTransfer || event.dataTransfer.getData("type") !== "task")
      return;
    event.preventDefault();
    this.dragEnterCount = 0;
    this.dragOver.set(false);
    this.taskDropped.emit(event);
  }

  // --- CRUD & editing (delegated to TaskForm) ---
  startEdit(): void {
    this.patchLocalTask({ isEditing: true });
    this.scheduleEnsureCardVisible();
  }

  async saveEdit(partialTask: Partial<Task>): Promise<void> {
    const pendingFiles = (partialTask as any)._pendingFiles as
      | File[]
      | undefined;

    const fullTask: Task = {
      ...this.localTask(),
      ...partialTask,
      title: partialTask.title ?? this.localTask().title ?? "",
      description:
        partialTask.description ?? this.localTask().description ?? "",
      kanbanColumnId:
        partialTask.kanbanColumnId ?? this.localTask().kanbanColumnId!,
      completed: partialTask.completed ?? this.localTask().completed ?? false,
      isEditing: false,
    };
    this.localTask.set(fullTask);

    if (fullTask.id) {
      await this.taskService.updateTask(fullTask.id, fullTask);
      await this.refreshFromBackend(fullTask.id);
      // Pulse on save
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
        if (createdTask.id) {
          await this.refreshFromBackend(createdTask.id);
        }
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

  /** Ask confirmation before deleting the task. */
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

  /** Localized badge text that recomputes when the language changes. */
  dueBadge = computed(() => {
    // Touch the language signal so this recomputes on language switch.
    this.lang();

    const dueRaw = this.localTask().dueDate;
    if (!dueRaw) return null;

    const dueDate = this.parseLocalISO(dueRaw);
    if (!dueDate) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return this.i18n.translate("task.due.late");
    if (diffDays === 0) return this.i18n.translate("task.due.today");
    if (diffDays === 1) return this.i18n.translate("task.due.oneDay");
    return this.i18n.translate("task.due.nDays", { count: diffDays });
  });

  /** Localized due date text (en: month/day/year, fr: day/month/year). */
  readonly formattedDueDate = computed(() => {
    // Touch language so it recomputes on switch
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
