import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment.local";
import { Task } from "../models/task.model";
import { firstValueFrom } from "rxjs";
import { AlertService } from "./alert.service";

/**
 * Handles file attachments for tasks: upload, download, delete, preview.
 */
@Injectable({ providedIn: "root" })
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly alertService = inject(AlertService);
  readonly apiUrl = environment.apiUrl;

  /** Returns the download/preview URL for an attachment */
  buildAttachmentUrl(taskId: number, filename: string): string {
    return `${this.apiUrl}/tasks/${taskId}/attachments/${encodeURIComponent(
      filename
    )}`;
  }

  /** Uploads an attachment to a given task, returns updated task or null */
  async uploadAttachment(taskId: number, file: File): Promise<Task | null> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const updated = await firstValueFrom(
        this.http.post<Task>(
          `${this.apiUrl}/tasks/${taskId}/attachments`,
          formData
        )
      );
      return updated;
    } catch (err) {
      this.alertService.show("error", "Error uploading attachment.");
      return null;
    }
  }

  /** Triggers download of an attachment for a given task */
  downloadAttachment(taskId: number, filename: string): void {
    this.http
      .get(this.buildAttachmentUrl(taskId, filename), { responseType: "blob" })
      .subscribe({
        next: (blob) => {
          const link = document.createElement("a");
          link.href = window.URL.createObjectURL(blob);
          link.download = filename;
          link.click();
          window.URL.revokeObjectURL(link.href);
        },
        error: () => {
          this.alertService.show("error", "Error downloading attachment.");
        },
      });
  }

  /** Deletes an attachment for a given task, returns updated task or null */
  async deleteAttachment(
    taskId: number,
    filename: string
  ): Promise<Task | null> {
    try {
      const updated = await firstValueFrom(
        this.http.delete<Task>(this.buildAttachmentUrl(taskId, filename))
      );
      return updated;
    } catch (err) {
      this.alertService.show("error", "Error deleting attachment.");
      return null;
    }
  }
}
