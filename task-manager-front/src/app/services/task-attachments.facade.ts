import { Injectable, signal, type Signal } from "@angular/core";
import { AttachmentService } from "./attachment.service";
import { TaskService } from "./task.service";
import type { Task } from "../models/task.model";

@Injectable({ providedIn: "root" })
export class TaskAttachmentsFacade {
  /** Buffered files used only before a task exists (creation flow). */
  private readonly _pendingFiles = signal<File[]>([]);

  constructor(
    private readonly attachmentService: AttachmentService,
    private readonly taskService: TaskService
  ) {}

  /** Read-only access to the buffer. */
  pendingFiles(): Signal<File[]> {
    return this._pendingFiles.asReadonly();
  }

  /** Add files to buffer with name de-duplication. */
  buffer(files: File[]): void {
    if (!files?.length) return;
    const current = this._pendingFiles();
    const names = new Set(current.map((f) => f.name));
    const uniques = files.filter((f) => !names.has(f.name));
    if (uniques.length) this._pendingFiles.set([...current, ...uniques]);
  }

  /** Remove one buffered file by name (used by the UI delete in creation mode). */
  removeFromBuffer(filename: string): void {
    this._pendingFiles.set(
      this._pendingFiles().filter((f) => f.name !== filename)
    );
  }

  /** Clear the buffer (after successful create or cancel). */
  flushBuffer(): void {
    this._pendingFiles.set([]);
  }

  /**
   * Upload files for an existing task, then refetch and sync global store.
   * Returns the fresh task (or null) so the caller can update local state.
   */
  async uploadForTask(taskId: number, files: File[]): Promise<Task | null> {
    if (!taskId || !files?.length) return null;

    await Promise.all(
      files.map((file) => this.attachmentService.uploadAttachment(taskId, file))
    );

    const fresh = await this.taskService.fetchTaskById(taskId);
    if (fresh) this.taskService.updateTaskFromApi(fresh);
    return fresh ?? null;
  }

  /** Delete one attachment on an existing task and return the updated task. */
  async delete(taskId: number, filename: string): Promise<Task | null> {
    if (!taskId || !filename) return null;

    const updated = await this.attachmentService.deleteAttachment(
      taskId,
      filename
    );
    if (updated) this.taskService.updateTaskFromApi(updated);
    return updated ?? null;
  }

  /** Trigger a download for one attachment. */
  download(taskId: number, filename: string): void {
    if (!taskId || !filename) return;
    this.attachmentService.downloadAttachment(taskId, filename);
  }
}
