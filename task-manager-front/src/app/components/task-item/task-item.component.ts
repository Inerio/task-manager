/** GLOBAL VARIABLE **/
(window as any).CURRENT_DRAGGED_TASK_STATUS = null;

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

@Component({
  selector: "app-task-item",
  standalone: true,
  imports: [FormsModule, LinkifyPipe, AttachmentZoneComponent],
  templateUrl: "./task-item.component.html",
  styleUrls: ["./task-item.component.scss"],
})
export class TaskItemComponent implements OnChanges {
  // --------------------------------------------------------------------
  // [STATE & SIGNALS]
  // --------------------------------------------------------------------
  /** Input: Task object (not a signal) */
  @Input({ required: true }) task!: Task;

  /** Internal reactive signal for editing/view updates */
  readonly localTask: WritableSignal<Task> = signal({} as Task);

  /** Drag state for animation */
  dragging = signal(false);

  /** File types allowed for upload */
  acceptTypes = "image/*,.pdf,.doc,.docx,.txt";

  /** Max file size (5MB) */
  maxSize = 5 * 1024 * 1024;

  private taskService = inject(TaskService);

  // --------------------------------------------------------------------
  // [LIFECYCLE]
  // --------------------------------------------------------------------
  constructor() {
    // Sync localTask signal when component (or task) changes
    effect(() => {
      this.localTask();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Rebuilds the local signal each time @Input task changes
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
    }
  }

  // --------------------------------------------------------------------
  // [UI LOGIC]
  // --------------------------------------------------------------------
  /** Deadline badge (computed from due date) */
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

  // --------------------------------------------------------------------
  // [DRAG & DROP - TASKS]
  // --------------------------------------------------------------------
  onTaskDragStart(event: DragEvent): void {
    if (this.localTask().isEditing) {
      event.preventDefault();
      return;
    }
    this.dragging.set(true);
    const task = this.localTask();
    if (!task.id) return;
    event.dataTransfer?.setData("text/plain", task.id.toString());
    event.dataTransfer?.setData("task-status", task.status);

    // Store the status in the global variable
    (window as any).CURRENT_DRAGGED_TASK_STATUS = task.status;

    // Custom drag image (task title)
    const dragImage = document.createElement("div");
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    dragImage.style.padding = "0.5rem 1rem";
    dragImage.style.background = "white";
    dragImage.style.border = "1px solid #ccc";
    dragImage.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";
    dragImage.style.borderRadius = "4px";
    dragImage.style.fontWeight = "bold";
    dragImage.style.fontSize = "1rem";
    dragImage.innerText = task.title;
    document.body.appendChild(dragImage);
    event.dataTransfer?.setDragImage(dragImage, 10, 10);
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }

  onTaskDragEnd(): void {
    this.dragging.set(false);
    // Reset the global variable
    (window as any).CURRENT_DRAGGED_TASK_STATUS = null;
  }

  // --------------------------------------------------------------------
  // [TASK EDIT / VIEW LOGIC]
  // --------------------------------------------------------------------
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
    // Reset to last parent value
    this.localTask.set({ ...this.task, isEditing: false });
  }

  deleteTask(): void {
    const current = this.localTask();
    if (current.id) this.taskService.deleteTask(current.id);
  }

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

  // --------------------------------------------------------------------
  // [ATTACHMENTS / FILES]
  // --------------------------------------------------------------------
  async onUploadFiles(files: File[]) {
    const taskId = this.localTask().id!;
    for (const file of files) {
      // (Optional: check here, but backend will validate as well)
      if (file.size > this.maxSize) {
        alert(`Fichier trop volumineux (${file.name})`);
        continue;
      }
      if (
        !file.type.match(/(image|pdf|text|word)/) &&
        !file.name.match(/\.(pdf|docx?|txt)$/i)
      ) {
        alert(`Type de fichier non autorisé (${file.name})`);
        continue;
      }
      try {
        await this.taskService.uploadAttachment(taskId, file);
        // Refresh task from backend after each upload
        await this.refreshTask(taskId);
      } catch {
        alert("Erreur upload fichier");
      }
    }
  }

  onDeleteAttachment(filename: string) {
    this.taskService
      .deleteAttachment(this.localTask().id!, filename)
      .catch(() => alert("Erreur suppression fichier"));
  }

  onDownloadAttachment(filename: string) {
    this.taskService.downloadAttachment(this.localTask().id!, filename);
  }

  async refreshTask(taskId: number) {
    // Reload the up-to-date task from backend (replace localTask)
    const tasks = this.taskService.tasks();
    const fresh = tasks.find((t) => t.id === taskId);
    if (fresh) {
      this.localTask.set({ ...fresh });
    }
  }
}
