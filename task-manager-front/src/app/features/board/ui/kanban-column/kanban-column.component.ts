import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  type Signal,
  ViewChild,
  afterNextRender,
  ElementRef,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { Task, TaskWithPendingFiles } from "../../../task/models/task.model";
import { TaskService } from "../../../task/data/task.service";
import { ConfirmDialogService } from "../../../../core/services/dialog/confirm-dialog.service";
import { DragDropGlobalService } from "../../../../core/services/dnd/drag-drop-global.service";
import { TaskComponent } from "../../../task/ui/task/task.component";
import { TaskFormComponent } from "../../../task/ui/task-form/task-form.component";
import { AttachmentService } from "../../../attachments/data/attachment.service";
import { KanbanColumnDndService } from "../../data/kanban-column-dnd.service";
import { EnsureVisibleDirective } from "../../../task/directives/ensure-visible.directive"; // ⬅️ added

/**
 * Kanban column (UI + form). Pure DnD logic is delegated to KanbanColumnDndService.
 */
@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    TaskComponent,
    TaskFormComponent,
    EnsureVisibleDirective, // ⬅️ added
  ],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
  providers: [KanbanColumnDndService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanColumnComponent implements OnChanges {
  // ===== Inputs =====
  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;
  @Input() hasAnyTask = false;

  // ===== Child refs =====
  @ViewChild(TaskFormComponent) private taskForm?: TaskFormComponent;
  @ViewChild("scrollHost", { static: true })
  private scrollHost?: ElementRef<HTMLElement>;

  // ===== Injections =====
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly i18n = inject(TranslocoService);

  /** Local DnD service. */
  readonly dnd = inject(KanbanColumnDndService);

  // ===== UI state (non-DnD) =====
  readonly showForm = signal(false);
  readonly editingTask = signal<null | Task>(null);

  // Keep a direct ref for trackBy.
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  constructor() {
    // Attach the scroll host for autoscroll once the view is ready.
    afterNextRender(() =>
      this.dnd.attachScrollHost(this.scrollHost?.nativeElement ?? null)
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ("kanbanColumnId" in changes && this.kanbanColumnId != null) {
      this.dnd.setColumnId(this.kanbanColumnId);
    }
  }

  // ===== Form actions =====
  openForm(): void {
    if (this.showForm()) return;
    this.showForm.set(true);
    this.editingTask.set(null);
  }

  closeForm(): void {
    if (this.showForm()) this.showForm.set(false);
    this.editingTask.set(null);
  }

  /** Called when save from the form is validated. */
  async handleTaskFormSave(payload: TaskWithPendingFiles): Promise<void> {
    const { _pendingFiles = [], ...task } = payload;

    if (!task.title || !task.kanbanColumnId) {
      this.closeForm();
      return;
    }

    try {
      if (!task.id) {
        const created = await this.taskService.createTask(task as Task);

        // Reorder locally so the new task is visually first.
        const current = this.filteredTasks();
        const withoutCreated = current.filter((t) => t.id !== created.id);
        const reordered = [
          { ...created, position: 0 },
          ...withoutCreated.map((t, idx) => ({ ...t, position: idx + 1 })),
        ];
        await this.taskService.reorderTasks(reordered);

        if (_pendingFiles.length) {
          await Promise.all(
            _pendingFiles.map((f) =>
              this.attachmentService.uploadAttachment(created.id!, f)
            )
          );
          await this.taskService.refreshTaskById(created.id!);
        }

        if (created.id) {
          setTimeout(() => this.dragDropGlobal.markTaskCreated(created.id!), 0);
        }
      } else {
        await this.taskService.updateTask(task.id!, task as Task);
        if (_pendingFiles.length) {
          await Promise.all(
            _pendingFiles.map((f) =>
              this.attachmentService.uploadAttachment(task.id!, f)
            )
          );
          await this.taskService.refreshTaskById(task.id!);
        }
      }
    } finally {
      this.closeForm();
    }
  }

  handleTaskFormCancel(): void {
    this.closeForm();
  }

  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      this.i18n.translate("boards.column.deleteAllTasksTitle"),
      this.i18n.translate("boards.column.deleteAllTasksConfirm", {
        title: this.title,
      })
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // ===== Template utils kept local =====
  trackById(_index: number, task: Task): number | undefined {
    return task.id;
  }
}
