import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { TranslocoService } from "@jsverse/transloco";
import { environment } from "../../../../environments/environment";
import { type Task, type TaskId } from "../../task/models/task.model";
import { AlertService } from "../../../core/services/alert.service";

/**
 * File attachment operations for tasks (upload / download / delete / preview).
 * Note: all HTTP calls go through HttpClient; interceptors can decorate requests.
 */
@Injectable({ providedIn: "root" })
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);
  private readonly apiUrl = environment.apiUrl;

  /** Build the API URL for a given attachment. */
  buildAttachmentUrl(taskId: TaskId, filename: string): string {
    return `${this.apiUrl}/tasks/${taskId}/attachments/${encodeURIComponent(
      filename
    )}`;
  }

  /** Build the API URL for the attachments *root* of a task. */
  private buildAttachmentsRoot(taskId: TaskId): string {
    return `${this.apiUrl}/tasks/${taskId}/attachments`;
  }

  /**
   * Returns an object URL for preview.
   * Caller must revoke it with URL.revokeObjectURL(...) when no longer needed.
   */
  async getPreviewObjectUrl(taskId: TaskId, filename: string): Promise<string> {
    const blob = await firstValueFrom(
      this.http.get(this.buildAttachmentUrl(taskId, filename), {
        responseType: "blob",
      })
    );
    const type = blob.type || this.guessMime(filename);
    const typedBlob = type ? new Blob([blob], { type }) : blob;
    return URL.createObjectURL(typedBlob);
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
      this.alert.show(
        "error",
        this.i18n.translate("attachments.errors.upload")
      );
      return null;
    }
  }

  /** Download an attachment (triggers a browser download). */
  downloadAttachment(taskId: TaskId, filename: string): void {
    this.http
      .get(this.buildAttachmentUrl(taskId, filename), { responseType: "blob" })
      .subscribe({
        next: (blob) => {
          const type = blob.type || this.guessMime(filename);
          const typed = type ? new Blob([blob], { type }) : blob;
          this.triggerBrowserDownload(typed, filename);
        },
        error: () =>
          this.alert.show(
            "error",
            this.i18n.translate("attachments.errors.download")
          ),
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
      this.alert.show(
        "error",
        this.i18n.translate("attachments.errors.delete")
      );
      return null;
    }
  }

  /** Delete *all* attachments of a task; returns updated Task or null on failure. */
  async deleteAll(taskId: TaskId): Promise<Task | null> {
    try {
      return await firstValueFrom(
        this.http.delete<Task>(this.buildAttachmentsRoot(taskId))
      );
    } catch {
      this.alert.show(
        "error",
        this.i18n.translate("attachments.errors.delete")
      );
      return null;
    }
  }

  // ---- private helpers ----

  /** Create a temporary link, click it, then clean up and revoke the URL. */
  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  /** Minimal MIME guess by extension (fallback when server omits Content-Type). */
  private guessMime(filename: string): string {
    const f = filename.toLowerCase();
    if (f.endsWith(".png")) return "image/png";
    if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
    if (f.endsWith(".gif")) return "image/gif";
    if (f.endsWith(".webp")) return "image/webp";
    if (f.endsWith(".bmp")) return "image/bmp";
    if (f.endsWith(".svg")) return "image/svg+xml";
    if (f.endsWith(".pdf")) return "application/pdf";
    return "";
  }
}
