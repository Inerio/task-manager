import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ViewChild,
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
  Signal,
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
import { StopBubblingDirective } from "./stop-bubbling.directive";
import { ClickOutsideDirective } from "./click-outside.directive";
import { NativeDialogGuardService } from "../../services/native-dialog-guard.service";
import { TaskAttachmentsFacade } from "../../services/task-attachments.facade";

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
  providers: [NativeDialogGuardService],
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
  private readonly guard = inject(NativeDialogGuardService);
  private readonly attachments = inject(TaskAttachmentsFacade);

  readonly form = this.fb.group({
    title: this.fb.control<string>("", { validators: [Validators.required] }),
    description: this.fb.control<string>(""),
    dueDate: this.fb.control<string>(""),
  });

  // ===== Local state =====
  readonly showEmojiPicker = signal(false);

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

  /** Local working copy of the task (id, attachments, etc.). */
  readonly localTask: WritableSignal<Partial<Task>> = signal({
    ...this.emptyTask,
    ...this.task,
  });

  /** Expose buffered files from the facade to the template. */
  readonly pendingFiles: Signal<File[]> = this.attachments.pendingFiles();

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
    // No global listeners here (handled by directives/services).
  }

  ngOnDestroy(): void {
    // Nothing local to clean up.
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
    // Delegate to the scoped guard service.
    this.guard.setOpen(open);
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

  // ===== Files (delegated to facade) =====
  onFilesBuffered(files: File[]): void {
    if (!this.localTask().id) {
      // Creation mode: buffer + dedupe by name.
      this.attachments.buffer(files);
    } else {
      void this.uploadFilesInEditMode(files);
    }
  }

  private async uploadFilesInEditMode(files: File[]): Promise<void> {
    const taskId = this.localTask().id!;
    const fresh = await this.attachments.uploadForTask(taskId, files);
    if (fresh?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: fresh.attachments,
      });
    }
  }

  async onBufferedFileDelete(filename: string): Promise<void> {
    if (!this.localTask().id) {
      this.attachments.removeFromBuffer(filename);
      return;
    }
    const id = this.localTask().id!;
    const updated = await this.attachments.delete(id, filename);
    if (updated?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: updated.attachments,
      });
    }
  }

  onFileDownload(filename: string): void {
    const id = this.localTask().id;
    if (!id) return;
    this.attachments.download(id, filename);
  }

  // ===== Save / Cancel =====
  private clearBufferIfNeeded(): void {
    if (!this.localTask().id) this.attachments.flushBuffer();
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
    this.attachments.flushBuffer();
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
