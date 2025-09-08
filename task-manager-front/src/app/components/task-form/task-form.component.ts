import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ViewChild,
  Renderer2,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  inject,
} from "@angular/core";
import type {
  WritableSignal,
  ElementRef,
  AfterViewInit,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from "@angular/core";

import {
  ReactiveFormsModule,
  NonNullableFormBuilder,
  Validators,
} from "@angular/forms";
import { TranslocoModule } from "@jsverse/transloco";

import { Task, TaskWithPendingFiles } from "../../models/task.model";
import { AttachmentZoneComponent } from "../attachment-zone/attachment-zone.component";
import { EmojiPickerComponent } from "../emoji-picker/emoji-picker.component";
import { AttachmentService } from "../../services/attachment.service";
import { TaskService } from "../../services/task.service";
import { StopBubblingDirective } from "./stop-bubbling.directive";
import { ClickOutsideDirective } from "./click-outside.directive";

@Component({
  selector: "app-task-form",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    AttachmentZoneComponent,
    EmojiPickerComponent,
    StopBubblingDirective,
    ClickOutsideDirective,
  ],
  templateUrl: "./task-form.component.html",
  styleUrls: ["./task-form.component.scss"],
  // Keep schema in case other custom elements appear inside the form.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormComponent
  implements AfterViewInit, OnInit, OnChanges, OnDestroy
{
  // ===== Inputs / Outputs =====
  @Input({ required: true }) task: Partial<Task> = {};
  @Input() editMode = false;
  @Input() acceptTypes = "image/*,.pdf,.doc,.docx,.txt";
  @Input() maxSize = 5 * 1024 * 1024;

  @Output() readonly save = new EventEmitter<TaskWithPendingFiles>();
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly filesUploaded = new EventEmitter<File[]>();
  @Output() readonly fileDeleted = new EventEmitter<string>();
  @Output() readonly fileDownloaded = new EventEmitter<string>();

  // ===== Template refs =====
  @ViewChild("titleInput") private titleInput?: ElementRef<HTMLInputElement>;
  @ViewChild("descTextarea") descTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild("formContainer", { static: true })
  formContainer?: ElementRef<HTMLElement>;

  // ===== Injections / form =====
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    title: this.fb.control<string>("", { validators: [Validators.required] }),
    description: this.fb.control<string>(""),
    dueDate: this.fb.control<string>(""),
  });

  // ===== Local state =====
  readonly showEmojiPicker = signal(false);
  private readonly renderer = inject(Renderer2);

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

  /** Swallow outside events while native file dialog is open. */
  readonly nativeDialogOpen = signal(false);
  private unlisteners: Array<() => void> = [];

  /** True when the browser is Brave (used to hide attachment zone). */
  readonly isBrave = signal(false);

  // ===== Lifecycle =====
  ngOnInit(): void {
    this.applyTaskToState(this.task);
    void this.detectBrave();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["task"]) {
      this.applyTaskToState(this.task);
    }
  }

  ngAfterViewInit(): void {
    // Swallow global events while native file dialog is open.
    const swallowIfDialog = (e: Event) => {
      if (this.nativeDialogOpen()) {
        // Stop handlers installed by the board/columns while the OS dialog is open.
        (
          e as { stopImmediatePropagation?: () => void }
        ).stopImmediatePropagation?.();
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
          // Let the browser fully close the file dialog before releasing the guard.
          setTimeout(() => this.nativeDialogOpen.set(false), 0);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.unlisteners.forEach((u) => {
      try {
        u();
      } catch {
        // ignore listener cleanup errors
      }
    });
    this.unlisteners = [];
  }

  // ===== Public imperative API =====
  /** Focus the title input (parents call after the form is rendered). */
  focusTitle(): void {
    const el = this.titleInput?.nativeElement;
    if (!el) {
      // Late render fallback.
      queueMicrotask(() => this.titleInput?.nativeElement?.focus());
      return;
    }
    el.focus();
    // Put caret at end (non-breaking).
    try {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    } catch {
      // Older browsers may throw — safe to ignore.
    }
  }

  // ===== Brave detection =====
  /**
   * Detect Brave browser.
   * Primary: navigator.brave.isBrave() when available.
   * Fallback: userAgent/brands may contain "Brave".
   */
  private async detectBrave(): Promise<void> {
    try {
      const nav = navigator as unknown as {
        brave?: { isBrave?: () => Promise<boolean> };
        userAgentData?: { brands?: { brand: string }[] };
        userAgent?: string;
      };

      const res = await nav.brave?.isBrave?.();
      if (typeof res === "boolean") {
        this.isBrave.set(res);
        return;
      }

      const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
      const hay = `${brands.join(" ")} ${(nav.userAgent || "").toLowerCase()}`;
      this.isBrave.set(hay.includes("brave"));
    } catch {
      this.isBrave.set(false);
    }
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
   * If the TOP of the form is above the viewport, scroll UP first.
   * Else, if the picker overflows the bottom, scroll DOWN a bit.
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
    // ------------------

    let dy = 0;

    // Ensure the top of the task form (title/desc) is visible.
    const contRect = container.getBoundingClientRect();
    if (contRect.top < FORM_TOP_SAFE) {
      dy = contRect.top - FORM_TOP_SAFE; // negative = scroll up
    } else {
      // Ensure the dropdown itself doesn't overflow the viewport.
      const dropRect = dropdown.getBoundingClientRect();

      if (dropRect.top < TOP_MARGIN) {
        dy = dropRect.top - TOP_MARGIN;
      } else if (dropRect.bottom > vpH - BOTTOM_SAFE) {
        dy = dropRect.bottom - (vpH - BOTTOM_SAFE) + 30; // extra down
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
    const start = (ta.selectionStart ?? ta.value.length) as number;
    const end = (ta.selectionEnd ?? start) as number;

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

  // ===== Files =====
  onFilesBuffered(files: File[]): void {
    if (!this.localTask().id) {
      // Creation mode: buffer + dedupe by name.
      const current = this.pendingFiles();
      const names = new Set(current.map((f) => f.name));
      const uniques = files.filter((f) => !names.has(f.name));
      this.pendingFiles.set([...current, ...uniques]);
    } else {
      void this.uploadFilesInEditMode(files);
    }
  }

  private async uploadFilesInEditMode(files: File[]): Promise<void> {
    const taskId = this.localTask().id!;
    await Promise.all(
      files.map((file) => this.attachmentService.uploadAttachment(taskId, file))
    );

    const fresh = await this.taskService.fetchTaskById(taskId);
    if (fresh?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: fresh.attachments,
      });
      // Keep global store in sync for other views.
      this.taskService.updateTaskFromApi(fresh);
    }
  }

  async onBufferedFileDelete(filename: string): Promise<void> {
    if (!this.localTask().id) {
      this.pendingFiles.set(
        this.pendingFiles().filter((f) => f.name !== filename)
      );
      return;
    }

    const id = this.localTask().id!;
    const updated = await this.attachmentService.deleteAttachment(id, filename);
    if (updated?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: updated.attachments,
      });
      this.taskService.updateTaskFromApi(updated);
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

  // ===== Internals =====
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
}
