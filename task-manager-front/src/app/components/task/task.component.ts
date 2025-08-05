import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  WritableSignal,
  computed,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  AfterViewChecked,
  Renderer2,
  CUSTOM_ELEMENTS_SCHEMA,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { LinkifyPipe } from "../../pipes/linkify.pipe";
import { TaskService } from "../../services/task.service";
import { AttachmentService } from "../../services/attachment.service";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";
import { AlertService } from "../../services/alert.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";
import { setTaskDragData } from "../../utils/drag-drop-utils";

/**
 * TaskComponent: Displays and edits a single task card (modern Angular signal-based).
 * Supports drag & drop, attachment management, and emoji picker (as a custom element).
 */
@Component({
  selector: "app-task-item",
  standalone: true,
  imports: [FormsModule, LinkifyPipe, AttachmentZoneComponent],
  templateUrl: "./task.component.html",
  styleUrls: ["./task.component.scss"],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TaskComponent
  implements OnChanges, AfterViewInit, AfterViewChecked
{
  // === Inputs & Outputs ===
  @Input({ required: true }) task!: Task;
  @Output() taskDropped = new EventEmitter<DragEvent>();

  // === Emoji Picker / View refs ===
  @ViewChild("emojiPicker", { static: false }) emojiPickerRef?: ElementRef;
  @ViewChild("emojiPickerContainer", { static: false })
  emojiPickerContainer?: ElementRef<HTMLDivElement>;
  @ViewChild("descTextarea") descTextarea?: ElementRef<HTMLTextAreaElement>;
  showEmojiPicker = signal(false);

  // === Services & State ===
  private readonly taskService = inject(TaskService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly alertService = inject(AlertService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly renderer = inject(Renderer2);

  readonly localTask: WritableSignal<Task> = signal({} as Task);

  // --- Drag/drop state ---
  private dragEnterCount = 0;
  private dragOver = signal(false);
  isDragOver = () => this.dragOver();
  dragging = signal(false);

  // --- Attachment settings ---
  readonly acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  readonly maxSize = 5 * 1024 * 1024;

  // --- Truncation config & state ---
  readonly TITLE_TRUNCATE = 32;
  readonly DESC_TRUNCATE = 120;
  showFullTitle = signal(false);
  showFullDescription = signal(false);

  // --- Display computed (signal-based, reactive) ---
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

  // --- Lifecycle ---

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"] && this.task) {
      this.localTask.set({ ...this.task });
      this.showFullTitle.set(false);
      this.showFullDescription.set(false);
    }
  }

  ngAfterViewInit(): void {
    // Shadow DOM outside click detection for emoji picker
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
    // Custom style injection for emoji picker shadow DOM
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

  // --- Emoji picker logic ---
  toggleEmojiPicker(): void {
    this.showEmojiPicker.set(!this.showEmojiPicker());
  }
  addEmojiToDescription(event: any): void {
    // Accept both emoji-picker-element and Angular emoji pickers
    const emoji =
      event.detail?.unicode ??
      event.emoji?.native ??
      event.emoji?.emoji ??
      event.detail ??
      "";
    const current = this.localTask().description || "";
    this.patchLocalTask({ description: current + emoji });
    this.showEmojiPicker.set(false);
  }

  // --- Drag & drop handlers (only for task card) ---

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

    // Custom drag image for better UX (removes after single event loop)
    const dragImage = document.createElement("div");
    dragImage.textContent = this.localTask().title;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      padding: 0.5rem 1rem;
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 0 5px rgba(0,0,0,0.3);
      border-radius: 4px;
      font-weight: bold;
      font-size: 1rem;
    `;
    document.body.appendChild(dragImage);
    event.dataTransfer?.setDragImage(dragImage, 10, 10);
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }

  onTaskDragEnd(): void {
    this.dragging.set(false);
    this.dragDropGlobal.endDrag();
  }

  /**
   * Drag over: prevent default, but state handled by enter/leave only.
   */
  onTaskDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  /**
   * Drag enter: stable highlight with internal counter.
   */
  onTaskDragEnter(event: DragEvent): void {
    if (!this.localTask().isEditing && this.dragDropGlobal.isTaskDrag()) {
      this.dragEnterCount++;
      this.dragOver.set(true);
    }
  }

  /**
   * Drag leave: counter for robust highlight (avoids flicker on nested nodes).
   */
  onTaskDragLeave(event: DragEvent): void {
    if (!this.localTask().isEditing && this.dragDropGlobal.isTaskDrag()) {
      this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
      if (this.dragEnterCount === 0) {
        this.dragOver.set(false);
      }
    }
  }

  /**
   * Drop: always reset counter and highlight; emit event for parent to handle.
   */
  async onTaskDrop(event: DragEvent) {
    if (this.localTask().isEditing) return;
    if (!event.dataTransfer || event.dataTransfer.getData("type") !== "task")
      return;
    event.preventDefault();
    this.dragEnterCount = 0;
    this.dragOver.set(false);
    this.taskDropped.emit(event);
  }

  // --- CRUD & editing ---
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

  /**
   * Handles clicks on the description <p> (which uses [innerHTML]).
   * - If user clicks a link (<a>), let the browser handle navigation.
   * - Only toggles truncated/full view if description is truncatable and click was NOT on a link.
   */
  onDescriptionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest("a")) {
      // Let the link open natively (browser handles the click)
      return;
    }
    if (this.canTruncateDescription()) {
      this.toggleDescriptionTruncate();
    }
  }

  // --- Two-way helpers for forms (if not using ngModel in edit mode) ---
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
  patchLocalTask(patch: Partial<Task>): void {
    this.localTask.set({ ...this.localTask(), ...patch });
  }

  // --- Attachments (async, strict, safe) ---
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

  // --- Due date badge (computed label for UI) ---
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
