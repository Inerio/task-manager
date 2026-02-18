import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";

export interface PresenceEntry {
  sessionId: string;
  displayName: string;
}

const LS_SESSION_KEY = "tasukeru_session_id" as const;
const LS_DISPLAY_NAME_KEY = "tasukeru_display_name" as const;

/** Generate a short random session ID (unique per browser tab). */
function createSessionId(): string {
  return (
    crypto.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

@Injectable({ providedIn: "root" })
export class PresenceService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Current user's display name (reactive). */
  readonly displayName = signal<string>(this.loadDisplayName());

  /** List of all online users for the current UID. */
  readonly onlineUsers = signal<PresenceEntry[]>([]);

  /** Unique session ID for this browser tab. */
  private _sessionId: string = this.getOrCreateSessionId();

  get sessionId(): string {
    return this._sessionId;
  }

  /** Returns true if the user has set a display name. */
  hasDisplayName(): boolean {
    return !!this.displayName().trim();
  }

  /** Fetch presence list from backend. */
  loadPresence(): void {
    this.http
      .get<PresenceEntry[]>(`${this.api}/presence`)
      .subscribe({
        next: (entries) => this.onlineUsers.set(entries),
        error: () => {},
      });
  }

  /** Update display name both locally and on the in-memory SSE session. */
  setDisplayName(name: string): void {
    const trimmed = name.trim().slice(0, 40);
    this.displayName.set(trimmed);
    this.saveDisplayNameLocal(trimmed);

    this.http
      .put(`${this.api}/presence/me`, {
        displayName: trimmed,
        sessionId: this._sessionId,
      })
      .subscribe({ error: () => {} });
  }

  /** Reset session ID (e.g. after UID switch). */
  resetSession(): void {
    this._sessionId = createSessionId();
    try {
      sessionStorage.setItem(LS_SESSION_KEY, this._sessionId);
    } catch {}
  }

  private getOrCreateSessionId(): string {
    try {
      const existing = sessionStorage.getItem(LS_SESSION_KEY);
      if (existing) return existing;
    } catch {}
    const id = createSessionId();
    try {
      sessionStorage.setItem(LS_SESSION_KEY, id);
    } catch {}
    return id;
  }

  private loadDisplayName(): string {
    try {
      return localStorage.getItem(LS_DISPLAY_NAME_KEY) ?? "";
    } catch {
      return "";
    }
  }

  private saveDisplayNameLocal(name: string): void {
    try {
      localStorage.setItem(LS_DISPLAY_NAME_KEY, name);
    } catch {}
  }
}
