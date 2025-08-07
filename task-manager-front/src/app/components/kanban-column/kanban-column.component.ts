import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  Signal,
  ViewChild,
  ElementRef,
  AfterViewInit,
  AfterViewChecked,
  Renderer2,
  CUSTOM_ELEMENTS_SCHEMA,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { TaskComponent } from "../task/task.component";
import { getTaskDragData } from "../../utils/drag-drop-utils";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";

/**
 * KanbanColumnComponent:
 * Displays a single kanban column with its tasks,
 * add form, and drag & drop for tasks (Angular v20+ full signal).
 */
@Component({
  selector: "app-kanban-column",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskComponent, AttachmentZoneComponent],
  templateUrl: "./kanban-column.component.html",
  styleUrls: ["./kanban-column.component.scss"],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class KanbanColumnComponent implements AfterViewInit, AfterViewChecked {
  // Emoji picker references
  @ViewChild("emojiPicker", { static: false }) emojiPickerRef?: ElementRef;
  @ViewChild("emojiPickerContainer", { static: false })
  emojiPickerContainer?: ElementRef<HTMLDivElement>;
  @ViewChild("descTextarea") descTextarea?: ElementRef<HTMLTextAreaElement>;
  readonly showEmojiPicker = signal(false);

  // Attachment parameters
  readonly acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  readonly maxSize = 5 * 1024 * 1024;

  @Input({ required: true }) title!: string;
  @Input({ required: true }) kanbanColumnId!: number;
  @Input() hasAnyTask = false;

  // Services
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly renderer = inject(Renderer2);

  // State signals
  readonly showForm = signal(false);
  readonly newTask = signal<Partial<Task>>(this.getEmptyTask());
  readonly dragOverIndex = signal<number | null>(null);
  readonly dropzoneDragOver = signal(false);

  /**
   * List of tasks for this column, sorted by position.
   */
  readonly filteredTasks: Signal<Task[]> = computed(() =>
    this.taskService
      .tasks()
      .filter((task) => task.kanbanColumnId === this.kanbanColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  // ========== Emoji Picker Shadow DOM Handling ==========
  ngAfterViewInit(): void {
    // Auto-close emoji picker on click outside
    this.renderer.listen("document", "mousedown", (event: MouseEvent) => {
      if (!this.showEmojiPicker()) return;
      const inContainer = this.emojiPickerContainer?.nativeElement.contains(
        event.target as Node
      );
      let inPicker = false;
      if (this.emojiPickerRef?.nativeElement) {
        const picker = this.emojiPickerRef.nativeElement as HTMLElement;
        if (picker.contains(event.target as Node)) inPicker = true;
        else if (
          picker.shadowRoot &&
          picker.shadowRoot.contains(event.target as Node)
        )
          inPicker = true;
      }
      if (!inContainer && !inPicker) this.showEmojiPicker.set(false);
    });
  }

  ngAfterViewChecked(): void {
    // Style the emoji picker shadow root (copy from TaskComponent)
    if (this.showEmojiPicker() && this.emojiPickerRef?.nativeElement) {
      const picker = this.emojiPickerRef.nativeElement;
      if (picker.shadowRoot) {
        picker.shadowRoot.host.style.transform = "scale(0.715)";
        picker.shadowRoot.host.style.transformOrigin = "top left";
        picker.shadowRoot.host.style.width = "140%";
        picker.shadowRoot.host.style.minWidth = "0";
        picker.shadowRoot.host.style.setProperty("--background", "#fff");
        picker.shadowRoot.host.style.setProperty(
          "--category-button-active-background",
          "#e3f2fd"
        );
        picker.shadowRoot.host.style.setProperty(
          "--search-background",
          "#f7f9fc"
        );
        picker.shadowRoot.host.style.setProperty("--border-radius", "16px");
        picker.shadowRoot.host.style.setProperty("--color", "#232323");
        if (!picker.shadowRoot.getElementById("custom-scrollbar-style")) {
          const style = document.createElement("style");
          style.id = "custom-scrollbar-style";
          style.textContent = `
            ::-webkit-scrollbar { width: 9px; background: #f7f9fc; border-radius: 12px; }
            ::-webkit-scrollbar-thumb { background: #d3d8e2; border-radius: 12px; }
            ::-webkit-scrollbar-thumb:hover { background: #b2b8c7; }
          `;
          picker.shadowRoot.appendChild(style);
        }
      }
    }
  }

  // ========== Attachments Handlers ==========
  onCreateFilesUploaded(files: File[]) {
    const attachments = [...(this.newTask().attachments ?? [])];
    for (const file of files) {
      if (!attachments.includes(file.name)) {
        attachments.push(file.name);
      }
    }
    this.newTask.set({ ...this.newTask(), attachments });
  }
  onCreateFileDeleted(filename: string) {
    const attachments = (this.newTask().attachments ?? []).filter(
      (f: string) => f !== filename
    );
    this.newTask.set({ ...this.newTask(), attachments });
  }
  onCreateFileDownloaded(filename: string) {
    // Placeholder: No download on creation
  }

  // ========== UI / Form ==========
  toggleEmojiPicker(): void {
    this.showEmojiPicker.set(!this.showEmojiPicker());
  }

  addEmojiToDescription(event: any): void {
    const emoji =
      event.detail?.unicode ??
      event.emoji?.native ??
      event.emoji?.emoji ??
      event.detail ??
      "";
    const current = this.newTask().description || "";
    this.newTask.set({ ...this.newTask(), description: current + emoji });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) this.resetForm();
  }

  addTask(): void {
    const { title, description, dueDate } = this.newTask();
    if (!title) return;
    const taskToCreate: Task = {
      title,
      description: description ?? "",
      completed: false,
      kanbanColumnId: this.kanbanColumnId,
      dueDate: dueDate || null,
    };
    this.taskService.createTask(taskToCreate);
    this.resetForm();
    this.showForm.set(false);
  }

  private resetForm(): void {
    this.newTask.set(this.getEmptyTask());
  }

  private getEmptyTask(): Partial<Task> {
    return { title: "", description: "", completed: false, dueDate: null };
  }

  updateNewTaskField(field: keyof Task, value: string | null): void {
    this.newTask.set({ ...this.newTask(), [field]: value ?? "" });
  }

  async deleteAllInColumn(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Delete all tasks",
      `Do you want to delete all tasks from "${this.title}"?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(this.kanbanColumnId);
  }

  // ========== DRAG & DROP ==========
  onDropzoneDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.dragDropGlobal.isTaskDrag()) {
      if (!this.dropzoneDragOver()) {
        this.dropzoneDragOver.set(true);
      }
    } else {
      if (this.dropzoneDragOver()) this.dropzoneDragOver.set(false);
    }
  }

  onDropzoneDragLeave(): void {
    this.dropzoneDragOver.set(false);
  }

  async onDropzoneDrop(event: DragEvent): Promise<void> {
    this.dropzoneDragOver.set(false);
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      return;
    }
    event.preventDefault();
    await this.onTaskDrop(event, 0);
  }

  onTaskDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.dragDropGlobal.isTaskDrag()) {
      this.dragOverIndex.set(targetIndex);
    } else {
      this.dragOverIndex.set(null);
    }
  }

  onTaskDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  /**
   * Handles drop event on a task or dropzone.
   * - If moving within same column: reorder and sync positions.
   * - If moving between columns: update columnId and reindex both columns.
   */
  async onTaskDrop(event: DragEvent, targetIndex: number): Promise<void> {
    if (
      event.dataTransfer?.types.includes("Files") ||
      event.dataTransfer?.getData("type") !== "task"
    ) {
      return;
    }
    event.preventDefault();
    this.dropzoneDragOver.set(false);
    const dragData = getTaskDragData(event);
    if (!dragData) return;
    const { taskId, kanbanColumnId: fromColumnId } = dragData;
    if (taskId == null || fromColumnId == null) return;

    const allTasks = this.taskService.tasks();
    const draggedTask = allTasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // --- Move within the same column ---
    if (fromColumnId === this.kanbanColumnId) {
      const columnTasks = [...this.filteredTasks()];
      const fromIdx = columnTasks.findIndex((t) => t.id === taskId);
      if (fromIdx === -1) return;
      columnTasks.splice(fromIdx, 1);
      columnTasks.splice(targetIndex, 0, draggedTask);
      const reordered = columnTasks.map((t, idx) => ({ ...t, position: idx }));
      this.taskService.reorderTasks(reordered);
      this.dragOverIndex.set(null);
      return;
    }

    // --- Move to another column ---
    const sourceTasks = allTasks.filter(
      (t) => t.kanbanColumnId === fromColumnId && t.id !== taskId
    );
    const targetTasks = [...this.filteredTasks()];
    const newTask = { ...draggedTask, kanbanColumnId: this.kanbanColumnId };
    targetTasks.splice(targetIndex, 0, newTask);

    const reorderedSource = sourceTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));
    const reorderedTarget = targetTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));

    await this.taskService.updateTask(newTask.id!, newTask);
    this.taskService.reorderTasks(reorderedSource);
    this.taskService.reorderTasks(reorderedTarget);
    this.dragOverIndex.set(null);
  }

  /**
   * Receives task drop event from child task component.
   */
  async onTaskItemDrop(event: DragEvent, targetIndex: number): Promise<void> {
    await this.onTaskDrop(event, targetIndex);
  }

  /** TrackBy for tasks */
  trackById(index: number, task: Task): number | undefined {
    return task.id;
  }
}
