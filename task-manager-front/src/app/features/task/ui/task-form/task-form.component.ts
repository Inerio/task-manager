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
import { AttachmentZoneComponent } from "../../../attachments/ui/attachment-zone/attachment-zone.component";
import { EmojiPickerComponent } from "../../../../shared/ui/emoji-picker/emoji-picker.component";
import { StopBubblingDirective } from "../../../../shared/directives/stop-bubbling.directive";
import { ClickOutsideDirective } from "../../../../shared/directives/click-outside.directive";
import { NativeDialogGuardService } from "../../../../core/guards/native-dialog-guard.service";
import { TaskAttachmentsFacade } from "../../../attachments/state/attachments.facade";
import { BrowserInfoService } from "../../../../core/services/browser-info.service";
import { insertAtCaret } from "../../../../shared/utils/dom-text";
import { AutofocusOnInitDirective } from "../../../../shared/directives/autofocus-on-init.directive";
import { AttachmentService } from "../../../attachments/data/attachment.service";

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
    AutofocusOnInitDirective,
  ],
  templateUrl: "./task-form.component.html",
  styleUrls: ["./task-form.component.scss"],
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
  @ViewChild("descTextarea") descTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild("formContainer", { static: true })
  formContainer?: ElementRef<HTMLElement>;

  // ===== Injections / form =====
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly guard = inject(NativeDialogGuardService);
  private readonly attachments = inject(TaskAttachmentsFacade);
  private readonly browserInfo = inject(BrowserInfoService);
  private readonly attachmentService = inject(AttachmentService);

  readonly form = this.fb.group({
    title: this.fb.control<string>("", { validators: [Validators.required] }),
    description: this.fb.control<string>(""),
    dueDate: this.fb.control<string>(""),
  });

  // ===== Local state =====
  readonly showEmojiPicker = signal(false);

  /** UI-level submit guard to prevent double-click spamming. */
  readonly submitting = signal(false);
  private static readonly SUBMIT_DEBOUNCE_MS = 1200;

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
    void this.browserInfo
      .isBrave()
      .then((v) => this.isBrave.set(v))
      .catch(() => this.isBrave.set(false));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const c = changes["task"];
    if (!c) return;
    const incoming: Partial<Task> = this.task ?? {};
    const first = c.firstChange;
    const prevVal = c.previousValue as Partial<Task> | undefined;
    const idChanged = (prevVal?.id ?? null) !== (incoming.id ?? null);
    if (!this.editMode || first || idChanged) {
      this.applyTaskToState(incoming);
      return;
    }
    const hasUserEdits = this.form.dirty || this.form.touched;
    if (hasUserEdits) {
      const curr = this.form.getRawValue();
      const prev = this.localTask();
      this.localTask.set({
        ...prev,
        ...incoming,
        title: curr.title,
        description: curr.description,
        dueDate: curr.dueDate,
      });
    } else {
      this.applyTaskToState(incoming);
    }
  }

  ngAfterViewInit(): void {}
  ngOnDestroy(): void {}

  // ===== UI actions =====
  onDialogOpen(open: boolean): void {
    this.guard.setOpen(open);
  }

  toggleEmojiPicker(): void {
    const next = !this.showEmojiPicker();
    this.showEmojiPicker.set(next);
    if (next) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.ensureEmojiPickerVisible());
      });
    }
  }

  private ensureEmojiPickerVisible(): void {
    const container = this.formContainer?.nativeElement;
    if (!container) return;

    const dropdown = container.querySelector(
      ".emoji-picker-dropdown"
    ) as HTMLElement | null;
    if (!dropdown) return;

    const vpH = window.innerHeight || document.documentElement.clientHeight;
    const FORM_TOP_SAFE = 12;
    const TOP_MARGIN = 8;
    const BOTTOM_SAFE = 240;

    let dy = 0;
    const contRect = container.getBoundingClientRect();
    if (contRect.top < FORM_TOP_SAFE) {
      dy = contRect.top - FORM_TOP_SAFE;
    } else {
      const dropRect = dropdown.getBoundingClientRect();
      if (dropRect.top < TOP_MARGIN) {
        dy = dropRect.top - TOP_MARGIN;
      } else if (dropRect.bottom > vpH - BOTTOM_SAFE) {
        dy = dropRect.bottom - (vpH - BOTTOM_SAFE) + 30;
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
      ctrl.markAsDirty();
      ctrl.markAsTouched();
      return;
    }

    insertAtCaret(ta, emoji);
    ctrl.setValue(ta.value);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  // ===== Files =====
  onFilesBuffered(files: File[]): void {
    if (!this.localTask().id) {
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

  onClearAllBuffered(): void {
    this.attachments.flushBuffer();
  }

  async onDeleteAllEdit(): Promise<void> {
    const id = this.localTask().id;
    if (!id) return;
    const updated = await this.attachmentService.deleteAll(id);
    if (updated?.attachments) {
      this.localTask.set({
        ...this.localTask(),
        attachments: updated.attachments,
      });
    }
  }

  // ===== Save / Cancel =====
  private clearBufferIfNeeded(): void {
    if (!this.localTask().id) this.attachments.flushBuffer();
  }

  handleSave(): void {
    if (this.form.invalid) return;

    // Ignore while a previous submit is being processed.
    if (this.submitting()) return;
    this.submitting.set(true);

    try {
      const values = this.form.getRawValue();
      this.save.emit({
        ...this.localTask(),
        ...values,
        _pendingFiles: this.pendingFiles(),
      });
      this.clearBufferIfNeeded();
    } finally {
      // Release the UI lock after a short debounce window.
      setTimeout(
        () => this.submitting.set(false),
        TaskFormComponent.SUBMIT_DEBOUNCE_MS
      );
    }
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
