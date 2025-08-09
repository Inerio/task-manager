import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment.local";
import { type Task, type TaskId } from "../models/task.model";
import { firstValueFrom } from "rxjs";
import { AlertService } from "./alert.service";

/**
 * File attachment operations for tasks (upload / download / delete).
 */
@Injectable({ providedIn: "root" })
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);
  private readonly apiUrl = environment.apiUrl;

  /** Build the download/preview URL for a given attachment. */
  buildAttachmentUrl(taskId: TaskId, filename: string): string {
    return `${this.apiUrl}/tasks/${taskId}/attachments/${encodeURIComponent(
      filename
    )}`;
  }

  /** Upload an attachment; returns the updated Task or null on failure. */
  async uploadAttachment(taskId: TaskId, file: File): Promise<Task | null> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      return await firstValueFrom(
        this.http.post<Task>(
          `${this.apiUrl}/tasks/${taskId}/attachments`,
          formData
        )
      );
    } catch {
      this.alert.show("error", "Error uploading attachment.");
      return null;
    }
  }

  /** Download an attachment (triggers a browser download). */
  downloadAttachment(taskId: TaskId, filename: string): void {
    this.http
      .get(this.buildAttachmentUrl(taskId, filename), { responseType: "blob" })
      .subscribe({
        next: (blob) => {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          link.click();
          URL.revokeObjectURL(link.href);
        },
        error: () => this.alert.show("error", "Error downloading attachment."),
      });
  }

  /** Delete an attachment; returns the updated Task or null on failure. */
  async deleteAttachment(
    taskId: TaskId,
    filename: string
  ): Promise<Task | null> {
    try {
      return await firstValueFrom(
        this.http.delete<Task>(this.buildAttachmentUrl(taskId, filename))
      );
    } catch {
      this.alert.show("error", "Error deleting attachment.");
      return null;
    }
  }
}
