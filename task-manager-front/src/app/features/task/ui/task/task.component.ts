import {
  Component,
  Input,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
  ViewChild,
} from "@angular/core";
import type {
  OnChanges,
  SimpleChanges,
  OnDestroy,
  WritableSignal,
  ElementRef,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { LinkifyPipe } from "../../../../shared/pipes/linkify.pipe";
import { TaskService } from "../../data/task.service";
import { AttachmentZoneComponent } from "../../../attachments/ui/attachment-zone/attachment-zone.component";
import { AttachmentService } from "../../../attachments/data/attachment.service";
import { AlertService } from "../../../../core/services/alert.service";
import { DragDropGlobalService } from "../../../../core/services/dnd/drag-drop-global.service";
import { TaskFormComponent } from "../task-form/task-form.component";
import { UPLOAD_CONFIG } from "../../../attachments/tokens/upload.config";
import { ConfirmDialogService } from "../../../../core/services/dialog/confirm-dialog.service";
import { TaskDueBadgeComponent } from "../task-due-badge/task-due-badge.component";
import { TaskPulseDirective } from "../../directives/task-pulse.directive";
import { EnsureVisibleDirective } from "../../directives/ensure-visible.directive";
import { TaskDndDirective } from "../../directives/task-dnd.directive";
import { ToggleTruncateDirective } from "../../directives/toggle-truncate.directive";
import { TruncateSmartPipe } from "../../../../shared/pipes/truncate-smart.pipe";

@Component({
  selector: "app-task",
  standalone: true,
  imports: [
    TranslocoModule,
    LinkifyPipe,
    AttachmentZoneComponent,
    TaskFormComponent,
    TaskDueBadgeComponent,
    TaskPulseDirective,
    EnsureVisibleDirective,
    TaskDndDirective,
    ToggleTruncateDirective,
    TruncateSmartPipe,
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

  // === Local state ===
  readonly localTask: WritableSignal<Task> = signal({} as Task);

  // Attachment constraints (from token)
  readonly acceptTypes = this.uploadCfg.acceptTypes;
  readonly maxSize = this.uploadCfg.maxSize;

  // DnD (own card)
  readonly dragging = signal(false);

  // === Truncation config (consumed by directive/pipe through the template) ===
  readonly TITLE_TRUNCATE_BASE = 18;
  readonly TITLE_TRUNCATE_WITH_BADGE = 22;
  readonly DESC_TRUNCATE = 139;

  // === Computed (truncate) ===
  /** True if the task has a valid due date (drives top padding + title width). */
  readonly hasDue = computed<boolean>(() => {
    const raw = this.localTask().dueDate;
    if (!raw) return false;
    return !!this.parseLocalISO(raw);
  });

  readonly titleTruncateLength = computed(() =>
    this.hasDue() ? this.TITLE_TRUNCATE_WITH_BADGE : this.TITLE_TRUNCATE_BASE
  );

  // === i/o changes ===
  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
      // Truncate state resets via [ttResetKey] bound to task id.
    }
  }

  ngOnDestroy(): void {
    // Nothing special here anymore; DnD cleanup is handled by services.
  }

  // === DnD callbacks (from directive) ===
  onTaskPreviewSize(sz: { width: number; height: number }): void {
    const el = this.cardEl?.nativeElement;
    if (!el) return;
    el.style.height = `${Math.round(sz.height)}px`;
    el.style.willChange = "height, margin, padding";
  }

  onDndDraggingChange(isDragging: boolean): void {
    this.dragging.set(isDragging);
    if (!isDragging) {
      const el = this.cardEl?.nativeElement;
      if (el) {
        el.style.height = "";
        el.style.willChange = "";
      }
    }
  }

  // === CRUD & editing (delegated to TaskForm) ===
  startEdit(): void {
    this.patchLocalTask({ isEditing: true });
    // Auto-visibility handled by [ensureVisible].
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

  patchLocalTask(patch: Partial<Task>): void {
    this.localTask.set({ ...this.localTask(), ...patch });
  }

  async onAttachmentUploaded(files: File[]): Promise<void> {
    const taskId = this.localTask().id!;
    if (!taskId || files.length === 0) return;

    await Promise.all(
      files.map((file) => this.attachmentService.uploadAttachment(taskId, file))
    );

    const freshTask = await this.taskService.fetchTaskById(taskId);
    if (freshTask?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: freshTask.attachments,
      });
      this.taskService.updateTaskFromApi(freshTask);
    }
    await this.taskService.refreshTaskById(taskId);
  }

  async onAttachmentDeleted(filename: string): Promise<void> {
    const taskId = this.localTask().id!;
    if (!taskId) return;

    const updated = await this.attachmentService.deleteAttachment(
      taskId,
      filename
    );
    if (updated?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: updated.attachments,
      });
      this.taskService.updateTaskFromApi(updated);
    }
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

  // ===== Date helpers =====

  /** Parse YYYY-MM-DD as a *local* date (avoid TZ shifts). */
  private parseLocalISO(iso: string): Date | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
}
