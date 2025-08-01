import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  WritableSignal,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { LinkifyPipe } from "../../pipes/linkify.pipe";
import { TaskService } from "../../services/task.service";
import { AttachmentService } from "../../services/attachment.service";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";
import { AlertService } from "../../services/alert.service";
import { TaskDragDropService } from "../../services/task-drag-drop.service";

@Component({
  selector: "app-task-item",
  standalone: true,
  imports: [FormsModule, LinkifyPipe, AttachmentZoneComponent],
  templateUrl: "./task.component.html",
  styleUrls: ["./task.component.scss"],
})
export class TaskComponent implements OnChanges {
  @Input({ required: true }) task!: Task;

  private readonly taskService = inject(TaskService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);
  private readonly dragDropService = inject(TaskDragDropService);

  private dragOver = signal(false);
  isDragOver = () => this.dragOver();

  readonly localTask: WritableSignal<Task> = signal({} as Task);
  dragging = signal(false);
  acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  maxSize = 5 * 1024 * 1024;

  readonly TITLE_TRUNCATE = 32;
  readonly DESC_TRUNCATE = 120;
  showFullTitle = signal(false);
  showFullDescription = signal(false);

  readonly displayedTitle = computed(() => {
    const title = this.localTask().title ?? "";
    if (this.showFullTitle() || !title) return title;
    return title.length <= this.TITLE_TRUNCATE
      ? title
      : title.slice(0, this.TITLE_TRUNCATE) + "…";
  });

  readonly displayedDescription = computed(() => {
    const desc = this.localTask().description ?? "";
    if (this.showFullDescription() || !desc) return desc;
    return desc.length <= this.DESC_TRUNCATE
      ? desc
      : desc.slice(0, this.DESC_TRUNCATE) + "…";
  });

  readonly canTruncateTitle = computed(
    () => (this.localTask().title ?? "").length > this.TITLE_TRUNCATE
  );
  readonly canTruncateDescription = computed(
    () => (this.localTask().description ?? "").length > this.DESC_TRUNCATE
  );

  toggleTitleTruncate = () =>
    this.canTruncateTitle() && this.showFullTitle.set(!this.showFullTitle());
  toggleDescriptionTruncate = () =>
    this.canTruncateDescription() &&
    this.showFullDescription.set(!this.showFullDescription());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
      this.showFullTitle.set(false);
      this.showFullDescription.set(false);
    }
  }

  patchLocalTask(patch: Partial<Task>): void {
    this.localTask.set({ ...this.localTask(), ...patch });
  }

  onTaskDragStart(event: DragEvent): void {
    this.dragDropService.startTaskDrag(
      event,
      this.localTask(),
      (value: boolean) => {
        this.dragging.set(value);
      }
    );
  }

  onTaskDragEnd(): void {
    this.dragDropService.endTaskDrag((value: boolean) => {
      this.dragging.set(value);
    });
  }

  onTaskDragOver(event: DragEvent) {
    event.preventDefault();
    if (
      !this.localTask().isEditing &&
      event.dataTransfer &&
      event.dataTransfer.getData("type") === "task"
    ) {
      this.dragOver.set(true);
    }
  }

  onTaskDragLeave() {
    this.dragOver.set(false);
  }

  async onTaskDrop(event: DragEvent) {
    if (this.localTask().isEditing) return;
    if (!event.dataTransfer || event.dataTransfer.getData("type") !== "task")
      return;
    event.preventDefault();
    this.dragOver.set(false);

    await this.dragDropService.handleTaskDropzoneDrop({
      event,
      targetKanbanColumnId: this.localTask().kanbanColumnId!,
      targetIndex: this.localTask().position ?? 0,
      getAllTasks: () => this.taskService.tasks(),
      getColumnTasks: () =>
        this.taskService
          .tasks()
          .filter((t) => t.kanbanColumnId === this.localTask().kanbanColumnId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      reorderTasks: (tasks) => this.taskService.reorderTasks(tasks),
      updateTask: (id, task) => this.taskService.updateTask(id, task), // Promise
    });
  }

  toggleCompleted(): void {
    const updated = {
      ...this.localTask(),
      completed: !this.localTask().completed,
    };
    this.localTask.set(updated);
    this.taskService.updateTask(updated.id!, updated);
  }

  startEdit(): void {
    this.patchLocalTask({ isEditing: true });
  }

  saveEdit(): void {
    const current = this.localTask();
    if (!current.title.trim()) return;
    this.patchLocalTask({ isEditing: false });
    this.taskService.updateTask(current.id!, this.localTask());
  }

  cancelEdit(): void {
    this.localTask.set({ ...this.task, isEditing: false });
  }

  deleteTask(): void {
    const id = this.localTask().id;
    if (id) this.taskService.deleteTask(id);
  }

  updateTitleFromEvent(event: Event): void {
    this.patchLocalTask({ title: (event.target as HTMLInputElement).value });
  }

  updateDescriptionFromEvent(event: Event): void {
    this.patchLocalTask({
      description: (event.target as HTMLTextAreaElement).value,
    });
  }

  updateDueDateFromEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.patchLocalTask({ dueDate: value });
  }

  async onUploadFiles(files: File[]) {
    const taskId = this.localTask().id!;
    for (const file of files) {
      if (file.size > this.maxSize) {
        this.alertService.show("error", `File too large (${file.name})`);
        continue;
      }
      if (
        !file.type.match(/(image|pdf|text|word)/) &&
        !file.name.match(/\.(pdf|docx?|txt)$/i)
      ) {
        this.alertService.show("error", `File type not allowed (${file.name})`);
        continue;
      }
      try {
        const updated = await this.attachmentService.uploadAttachment(
          taskId,
          file
        );
        if (updated) {
          this.taskService.updateTaskFromApi(updated);
          this.localTask.set({ ...updated });
        }
      } catch {
        this.alertService.show("error", "File upload error");
      }
    }
  }

  async onDeleteAttachment(filename: string) {
    const taskId = this.localTask().id!;
    try {
      const updated = await this.attachmentService.deleteAttachment(
        taskId,
        filename
      );
      if (updated) {
        this.taskService.updateTaskFromApi(updated);
        this.localTask.set({ ...updated });
      }
    } catch {
      this.alertService.show("error", "File deletion error");
    }
  }

  onDownloadAttachment(filename: string) {
    this.attachmentService.downloadAttachment(this.localTask().id!, filename);
  }

  dueBadge = computed(() => {
    const due = this.localTask().dueDate;
    if (!due) return null;
    const dueDate = new Date(due);
    const now = new Date();
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) return "Late!";
    if (diffDays === 0) return "Due today!";
    if (diffDays === 1) return "1 day left";
    return `${diffDays} days left`;
  });
}
