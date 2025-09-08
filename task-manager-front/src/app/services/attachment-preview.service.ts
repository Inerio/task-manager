import { Injectable, OnDestroy } from "@angular/core";
import { AttachmentService } from "./attachment.service";

/**
 * Preview cache with in-flight de-duplication + LRU of Object URLs.
 * API:
 *  - get(taskId, filename): Promise<string>  // returns Object URL
 *  - clearAll(): void                        // revokes all cached URLs
 */
@Injectable({ providedIn: "root" })
export class AttachmentPreviewService implements OnDestroy {
  private readonly MAX_CACHE = 16;

  /** key -> Object URL */
  private readonly cache = new Map<string, string>();
  /** LRU order: oldest at index 0, newest at the end */
  private readonly order: string[] = [];
  /** key -> running Promise for de-duplication */
  private readonly inFlight = new Map<string, Promise<string>>();

  constructor(private readonly attachments: AttachmentService) {}

  async get(taskId: number, filename: string): Promise<string> {
    const key = this.key(taskId, filename);

    // Fast path: cache hit
    const hit = this.cache.get(key);
    if (hit) {
      this.bump(key);
      return hit;
    }

    // De-dup concurrent fetches
    const running = this.inFlight.get(key);
    if (running) return running;

    const promise = this.fetchAndCache(key, taskId, filename);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  clearAll(): void {
    for (const url of this.cache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.cache.clear();
    this.order.length = 0;
    this.inFlight.clear();
  }

  ngOnDestroy(): void {
    this.clearAll();
  }

  // ---- internals ----------------------------------------------------------

  private key(taskId: number, filename: string): string {
    return `${taskId}::${filename}`;
  }

  private bump(key: string): void {
    const i = this.order.indexOf(key);
    if (i !== -1) this.order.splice(i, 1);
    this.order.push(key);
  }

  private async fetchAndCache(
    key: string,
    taskId: number,
    filename: string
  ): Promise<string> {
    // This assumes AttachmentService exposes getPreviewObjectUrl(taskId, filename)
    // that returns Promise<string> (already an Object URL) OR a Blob.
    // If it returns a Blob instead, replace the next line by:
    //   const blob = await this.attachments.downloadPreviewBlob(taskId, filename);
    //   const url = URL.createObjectURL(blob);
    const url = await this.attachments.getPreviewObjectUrl(taskId, filename);
    this.addToCache(key, url);
    return url;
  }

  private addToCache(key: string, url: string): void {
    // Replace existing entry (revoke old)
    const prev = this.cache.get(key);
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {}
      this.cache.delete(key);
    }
    this.cache.set(key, url);
    this.bump(key);

    // Enforce LRU size
    while (this.order.length > this.MAX_CACHE) {
      const oldest = this.order.shift()!;
      const u = this.cache.get(oldest);
      if (u) {
        try {
          URL.revokeObjectURL(u);
        } catch {}
        this.cache.delete(oldest);
      }
    }
  }
}
