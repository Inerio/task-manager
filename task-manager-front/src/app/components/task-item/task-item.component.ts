import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { LinkifyPipe } from "../../pipes/linkify.pipe";
import { TaskService } from "../../services/task.service";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";
import { AlertService } from "../../services/alert.service";
import { TaskDragDropService } from "../../services/task-drag-drop.service";

@Component({
  selector: "app-task-item",
  standalone: true,
  imports: [FormsModule, LinkifyPipe, AttachmentZoneComponent],
  templateUrl: "./task-item.component.html",
  styleUrls: ["./task-item.component.scss"],
})
export class TaskItemComponent implements OnChanges {
  // ------------------------------------------
  // INPUTS
  // ------------------------------------------
  @Input({ required: true }) task!: Task;

  // ------------------------------------------
  // SERVICES
  // ------------------------------------------
  private readonly taskService = inject(TaskService);
  private readonly alertService = inject(AlertService);
  private readonly dragDropService = inject(TaskDragDropService);

  // ------------------------------------------
  // STATE & SIGNALS
  // ------------------------------------------
  readonly localTask: WritableSignal<Task> = signal({} as Task); // Local reactive copy for editing/view
  dragging = signal(false); // Used for drag animation

  // ------------------------------------------
  // ATTACHMENTS
  // ------------------------------------------
  acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  maxSize = 5 * 1024 * 1024;

  // ------------------------------------------
  // LIFECYCLE
  // ------------------------------------------
  constructor() {
    // Keeps localTask in sync with input changes
    effect(() => {
      this.localTask();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
    }
  }

  // ------------------------------------------
  // DUE BADGE (computed)
  // ------------------------------------------
  dueBadge = computed(() => {
    const due = this.localTask().dueDate;
    if (!due) return null;
    const dueDate = new Date(due);
    const now = new Date();
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "En retard !";
    if (diffDays === 0) return "Dernier jour !";
    if (diffDays === 1) return "1 jour restant";
    return `${diffDays} jours restants`;
  });

  // ------------------------------------------
  // DRAG & DROP
  // ------------------------------------------
  /**
   * Start drag: sets global dragged list ID and a custom drag image.
   */
  onTaskDragStart(event: DragEvent): void {
    this.dragDropService.startTaskDrag(event, this.localTask(), (v) =>
      this.dragging.set(v)
    );
  }

  /**
   * End drag: cleanup global variable.
   */
  onTaskDragEnd(): void {
    this.dragDropService.endTaskDrag((v) => this.dragging.set(v));
  }

  // ------------------------------------------
  // CRUD & EDIT
  // ------------------------------------------
  toggleCompleted(): void {
    const updated = {
      ...this.localTask(),
      completed: !this.localTask().completed,
    };
    this.localTask.set(updated);
    this.taskService.updateTask(updated.id!, updated);
  }

  startEdit(): void {
    const current = this.localTask();
    this.localTask.set({ ...current, isEditing: true });
  }

  saveEdit(): void {
    const current = this.localTask();
    if (!current.title.trim()) return;
    this.localTask.set({ ...current, isEditing: false });
    this.taskService.updateTask(current.id!, this.localTask());
  }

  cancelEdit(): void {
    this.localTask.set({ ...this.task, isEditing: false });
  }

  deleteTask(): void {
    const current = this.localTask();
    if (current.id) this.taskService.deleteTask(current.id);
  }

  // ------------------------------------------
  // EDIT FIELD HELPERS
  // ------------------------------------------
  updateTitleFromEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localTask.set({ ...this.localTask(), title: value });
  }

  updateDescriptionFromEvent(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.localTask.set({ ...this.localTask(), description: value });
  }

  updateDueDateFromEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.localTask.set({ ...this.localTask(), dueDate: value });
  }

  // ------------------------------------------
  // ATTACHMENTS (UPLOAD/DOWNLOAD/DELETE)
  // ------------------------------------------
  async onUploadFiles(files: File[]) {
    const taskId = this.localTask().id!;
    for (const file of files) {
      if (file.size > this.maxSize) {
        this.alertService.show(
          "error",
          `Fichier trop volumineux (${file.name})`
        );
        continue;
      }
      if (
        !file.type.match(/(image|pdf|text|word)/) &&
        !file.name.match(/\.(pdf|docx?|txt)$/i)
      ) {
        this.alertService.show(
          "error",
          `Type de fichier non autorisé (${file.name})`
        );
        continue;
      }
      try {
        await this.taskService.uploadAttachment(taskId, file);
        await this.refreshTask(taskId);
      } catch {
        this.alertService.show("error", "Erreur upload fichier");
      }
    }
  }

  onDeleteAttachment(filename: string) {
    this.taskService
      .deleteAttachment(this.localTask().id!, filename)
      .catch(() =>
        this.alertService.show("error", "Erreur suppression fichier")
      );
  }

  onDownloadAttachment(filename: string) {
    this.taskService.downloadAttachment(this.localTask().id!, filename);
  }

  async refreshTask(taskId: number) {
    const tasks = this.taskService.tasks();
    const fresh = tasks.find((t) => t.id === taskId);
    if (fresh) {
      this.localTask.set({ ...fresh });
    }
  }
}
