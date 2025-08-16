import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TranslocoService } from "@jsverse/transloco";
import { environment } from "../../environments/environment.local";
import { type Task, type TaskId } from "../models/task.model";
import { firstValueFrom } from "rxjs";
import { AlertService } from "./alert.service";

/**
 * File attachment operations for tasks (upload / download / delete / preview).
 * Important: all HTTP calls passent par HttpClient -> l'interceptor ajoute X-Client-Id.
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

  /** Return a Blob for preview; wrapped as an object URL by the caller. */
  async getPreviewObjectUrl(taskId: TaskId, filename: string): Promise<string> {
    const blob = await firstValueFrom(
      this.http.get(this.buildAttachmentUrl(taskId, filename), {
        responseType: "blob",
      })
    );
    // Preserve server-provided type if any; otherwise browser will still sniff for images.
    const typedBlob = blob.type
      ? blob
      : new Blob([blob], { type: this.guessMime(filename) });
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
          const link = document.createElement("a");
          link.href = URL.createObjectURL(typed);
          link.download = filename;
          link.click();
          URL.revokeObjectURL(link.href);
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

  /** Minimal MIME guess by extension (fallback if server doesn't set Content-Type). */
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
