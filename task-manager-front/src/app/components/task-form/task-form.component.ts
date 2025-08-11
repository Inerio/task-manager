import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  type WritableSignal,
  ViewChild,
  ElementRef,
  AfterViewInit,
  Renderer2,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectionStrategy,
} from "@angular/core";
import {
  ReactiveFormsModule,
  NonNullableFormBuilder,
  Validators,
} from "@angular/forms";
import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";
import { EmojiPickerComponent } from "../emoji-picker/emoji-picker.component";
import { AttachmentService } from "../../services/attachment.service";
import { TaskService } from "../../services/task.service";

@Component({
  selector: "app-task-form",
  standalone: true,
  imports: [ReactiveFormsModule, AttachmentZoneComponent, EmojiPickerComponent],
  templateUrl: "./task-form.component.html",
  styleUrls: ["./task-form.component.scss"],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormComponent
  implements AfterViewInit, OnInit, OnChanges, OnDestroy
{
  @Input({ required: true }) task: Partial<Task> = {};
  @Input() editMode = false;
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;

  @Output() save = new EventEmitter<TaskWithPendingFiles>();
  @Output() cancel = new EventEmitter<void>();
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();

  @ViewChild("descTextarea") descTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild("formContainer", { static: true })
  formContainer?: ElementRef<HTMLElement>;

  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    title: this.fb.control<string>("", { validators: [Validators.required] }),
    description: this.fb.control<string>(""),
    dueDate: this.fb.control<string>(""),
  });

  readonly showEmojiPicker = signal(false);
  private readonly renderer = inject(Renderer2);
  private globalClickUnlisten: (() => void) | null = null;

  private readonly attachmentService = inject(AttachmentService);
  private readonly taskService = inject(TaskService);

  private readonly emptyTask: Task = {
    id: undefined,
    title: "",
    description: "",
    completed: false,
    kanbanColumnId: 0,
    dueDate: null,
    attachments: [],
    position: undefined,
    isEditing: false,
  };

  /** Buffer of files to upload after creation only. */
  readonly pendingFiles: WritableSignal<File[]> = signal([]);

  /** Local working copy of the task (id, attachments, etc.). */
  readonly localTask: WritableSignal<Partial<Task>> = signal({
    ...this.emptyTask,
    ...this.task,
  });

  /** To swallow outside events while native file dialog is open. */
  readonly nativeDialogOpen = signal(false);
  private unlisteners: Array<() => void> = [];

  // ===== Lifecycle =====
  ngOnInit(): void {
    this.applyTaskToState(this.task);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"]) {
      this.applyTaskToState(this.task);
    }
  }

  private applyTaskToState(task: Partial<Task>): void {
    const t: Task = { ...this.emptyTask, ...task };
    this.localTask.set(t);
    this.pendingFiles.set([]);
    this.form.setValue(
      {
        title: t.title ?? "",
        description: t.description ?? "",
        dueDate: t.dueDate ?? "",
      },
      { emitEvent: false }
    );
  }

  ngAfterViewInit(): void {
    // Close emoji picker on true outside click
    if (this.globalClickUnlisten) this.globalClickUnlisten();
    this.globalClickUnlisten = this.renderer.listen(
      "document",
      "mousedown",
      (event: MouseEvent) => {
        if (!this.showEmojiPicker()) return;
        const container = this.formContainer?.nativeElement;
        if (
          container &&
          !container.contains(event.target as Node) &&
          !(event.target as HTMLElement).closest(".emoji-picker-dropdown")
        ) {
          this.showEmojiPicker.set(false);
        }
      }
    );

    // Swallow global events while native file dialog is open
    const swallowIfDialog = (e: Event) => {
      if (this.nativeDialogOpen()) {
        (e as any).stopImmediatePropagation?.();
        e.stopPropagation();
        e.preventDefault();
      }
    };
    this.unlisteners.push(
      this.renderer.listen("document", "mousedown", swallowIfDialog),
      this.renderer.listen("document", "mouseup", swallowIfDialog),
      this.renderer.listen("document", "click", swallowIfDialog),
      this.renderer.listen("document", "focusin", swallowIfDialog),
      this.renderer.listen("document", "keydown", (e: KeyboardEvent) => {
        if (this.nativeDialogOpen() && e.key === "Escape") swallowIfDialog(e);
      }),
      this.renderer.listen("window", "focus", () => {
        if (this.nativeDialogOpen()) {
          setTimeout(() => this.nativeDialogOpen.set(false), 0);
        }
      })
    );
  }

  ngOnDestroy(): void {
    if (this.globalClickUnlisten) this.globalClickUnlisten();
    this.unlisteners.forEach((u) => {
      try {
        u();
      } catch {}
    });
    this.unlisteners = [];
  }

  // ===== UI actions =====
  onDialogOpen(open: boolean): void {
    this.nativeDialogOpen.set(open);
  }

  toggleEmojiPicker(): void {
    const next = !this.showEmojiPicker();
    this.showEmojiPicker.set(next);

    // When opening, wait for the DOM to paint the web component
    // then ensure it is visible inside the viewport.
    if (next) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.ensureEmojiPickerVisible());
      });
    }
  }

  /**
   * Ensure the emoji picker is visible in the viewport.
   * If the TOP of the task form is above the viewport, scroll UP first
   * so the title/description are visible.
   * Otherwise, if the picker overflows the bottom, scroll DOWN a bit.
   */
  private ensureEmojiPickerVisible(): void {
    const container = this.formContainer?.nativeElement;
    if (!container) return;

    const dropdown = container.querySelector(
      ".emoji-picker-dropdown"
    ) as HTMLElement | null;
    if (!dropdown) return;

    const vpH = window.innerHeight || document.documentElement.clientHeight;

    // --- tweakables ---
    const FORM_TOP_SAFE = 12;
    const TOP_MARGIN = 8;
    const BOTTOM_SAFE = 240;
    // -------------------

    let dy = 0;

    // make sure the top of the task form (title/desc) is visible
    const contRect = container.getBoundingClientRect();
    if (contRect.top < FORM_TOP_SAFE) {
      dy = contRect.top - FORM_TOP_SAFE; // negative -> scroll up
    } else {
      // otherwise, ensure the dropdown itself doesn't overflow the viewport
      const dropRect = dropdown.getBoundingClientRect();

      if (dropRect.top < TOP_MARGIN) {
        dy = dropRect.top - TOP_MARGIN;
      } else if (dropRect.bottom > vpH - BOTTOM_SAFE) {
        dy = dropRect.bottom - (vpH - BOTTOM_SAFE) + 30; // scroll down a bit extra
      }
    }

    if (Math.abs(dy) > 1) {
      window.scrollBy({ top: dy, behavior: "smooth" });
    }
  }

  onEmojiSelected(emoji: string): void {
    const ta = this.descTextarea?.nativeElement;
    const ctrl = this.form.controls.description;
    if (!ta) {
      ctrl.setValue((ctrl.value ?? "") + emoji);
      return;
    }
    ta.focus();
    const prevScroll = ta.scrollTop;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    if (typeof ta.setRangeText === "function") {
      ta.setRangeText(emoji, start, end, "end");
    } else {
      const v = ta.value;
      ta.value = v.slice(0, start) + emoji + v.slice(end);
      const caret = start + emoji.length;
      ta.setSelectionRange(caret, caret);
    }
    ta.scrollTop = prevScroll;
    ctrl.setValue(ta.value);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  // === Files ===
  onFilesBuffered(files: File[]): void {
    if (!this.localTask().id) {
      // creation mode: buffer + dedupe by name
      const current = this.pendingFiles();
      const names = current.map((f) => f.name);
      const uniques = files.filter((f) => !names.includes(f.name));
      this.pendingFiles.set([...current, ...uniques]);
    } else {
      this.uploadFilesInEditMode(files);
    }
  }

  private async uploadFilesInEditMode(files: File[]): Promise<void> {
    const taskId = this.localTask().id!;
    await Promise.all(
      files.map((file) => this.attachmentService.uploadAttachment(taskId, file))
    );
    this.taskService.fetchTaskById(taskId).then((fresh) => {
      if (fresh?.attachments) {
        this.localTask.set({
          ...this.localTask(),
          attachments: fresh.attachments,
        });
      }
    });
  }

  onBufferedFileDelete(filename: string): void {
    if (!this.localTask().id) {
      this.pendingFiles.set(
        this.pendingFiles().filter((f) => f.name !== filename)
      );
    } else {
      const id = this.localTask().id!;
      this.attachmentService.deleteAttachment(id, filename).then(() => {
        this.taskService.fetchTaskById(id).then((fresh) => {
          if (fresh?.attachments) {
            this.localTask.set({
              ...this.localTask(),
              attachments: fresh.attachments,
            });
          }
        });
      });
    }
  }

  onFileDownload(filename: string): void {
    const id = this.localTask().id;
    if (!id) return;
    this.attachmentService.downloadAttachment(id, filename);
  }

  // ===== Save / Cancel =====
  private clearBufferIfNeeded(): void {
    if (!this.localTask().id) this.pendingFiles.set([]);
  }

  handleSave(): void {
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    this.save.emit({
      ...this.localTask(),
      ...values,
      _pendingFiles: this.pendingFiles(),
    });
    this.clearBufferIfNeeded();
  }

  handleCancel(): void {
    this.clearBufferIfNeeded();
    this.cancel.emit();
  }
}
