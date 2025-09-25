import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import {
  ANON_ID_LS_KEY,
  readAnonId,
  setAnonIdFromDialog,
} from "../../core/interceptors/anon-id.interceptor";
import {
  isShort,
  isUuid,
  shortToUuid,
  uuidToShort,
} from "../../utils/uid-codec";

export interface NamedIdEntry {
  label: string;
  uid: string;
  code: string;
  savedAt: number;
}

/**
 * Helper around the anonymous client ID.
 * Canonical form = UUID (lowercase). Code = Base64URL (22 chars).
 * Keeps LS and the interceptor's in-memory cache in sync.
 */
@Injectable({ providedIn: "root" })
export class AccountIdService {
  readonly headerName = environment.clientIdHeader ?? "X-Client-Id";
  readonly storageKey = ANON_ID_LS_KEY;

  private readonly historyKeyV1 = "tasukeru_uid_history";
  private readonly historyKeyV2 = "tasukeru_uid_history_v2";
  private readonly historyLimit = 12;

  /** Canonical UUID (lowercase) used in headers/storage. */
  getUid(): string {
    return readAnonId();
  }

  /** 22-char Base64URL code derived from the UUID (for display/sharing). */
  getShortCode(): string {
    try {
      return uuidToShort(this.getUid());
    } catch {
      return "";
    }
  }

  /** Accepts either a UUID or the short Base64URL code. */
  isValid(input: string): boolean {
    const v = (input ?? "").trim();
    return isUuid(v) || isShort(v);
  }

  /** Normalize to canonical uid & code. */
  normalize(input: string): { uid: string; code: string } {
    let v = (input ?? "").trim();
    if (isShort(v)) v = shortToUuid(v);
    if (!isUuid(v)) throw new Error("Invalid UID");
    const uid = v.toLowerCase();
    return { uid, code: uuidToShort(uid) };
  }

  /** Set active UID. */
  setUid(input: string): void {
    const { uid } = this.normalize(input);
    setAnonIdFromDialog(uid);
    this.rememberV1(uid);
  }

  /* ===== Named history ===== */

  getNamedHistory(): NamedIdEntry[] {
    const migrated = this.maybeMigrateHistory();
    return migrated;
  }

  getUidHistory(): string[] {
    return this.getNamedHistory().map((e) => e.uid);
  }

  /** Save/update a named entry and return the normalized ids. */
  saveNamedEntry(
    label: string,
    codeOrUid: string
  ): { uid: string; code: string } {
    const name = (label ?? "").trim();
    const { uid, code } = this.normalize(codeOrUid);

    const list = this.getNamedHistory();
    const now = Date.now();

    const filtered = list.filter((e) => e.uid !== uid);
    const entry: NamedIdEntry = {
      label: name || code,
      uid,
      code,
      savedAt: now,
    };
    const next = [entry, ...filtered].slice(0, this.historyLimit);

    try {
      localStorage.setItem(this.historyKeyV2, JSON.stringify(next));
    } catch {}

    this.rememberV1(uid);

    return { uid, code };
  }

  /** Copy text to clipboard with a small fallback. */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }

  /* ===== Internals ===== */

  private readV1(): string[] {
    try {
      const raw = localStorage.getItem(this.historyKeyV1);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr)
        ? (arr as string[]).filter((s) => typeof s === "string" && isUuid(s))
        : [];
    } catch {
      return [];
    }
  }

  private rememberV1(uid: string): void {
    const cur = this.readV1();
    const next = [uid, ...cur.filter((x) => x !== uid)].slice(0, 5);
    try {
      localStorage.setItem(this.historyKeyV1, JSON.stringify(next));
    } catch {}
  }

  private maybeMigrateHistory(): NamedIdEntry[] {
    try {
      const raw = localStorage.getItem(this.historyKeyV2);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          const cleaned = (arr as any[])
            .map((x) => {
              const uid =
                typeof x?.uid === "string" && isUuid(x.uid)
                  ? x.uid.toLowerCase()
                  : null;
              if (!uid) return null;
              const code = (() => {
                try {
                  return uuidToShort(uid);
                } catch {
                  return "";
                }
              })();
              const label =
                typeof x?.label === "string" && x.label.trim()
                  ? x.label.trim()
                  : code;
              const savedAt =
                typeof x?.savedAt === "number" ? x.savedAt : Date.now();
              return { label, uid, code, savedAt } as NamedIdEntry;
            })
            .filter(Boolean) as NamedIdEntry[];
          cleaned.sort((a, b) => b.savedAt - a.savedAt);
          return cleaned.slice(0, this.historyLimit);
        }
      }
    } catch {}

    const v1 = this.readV1();
    const migrated: NamedIdEntry[] = v1.map((uid, idx) => {
      const code = uuidToShort(uid);
      return {
        label: code,
        uid,
        code,
        savedAt: Date.now() - idx,
      };
    });
    try {
      localStorage.setItem(this.historyKeyV2, JSON.stringify(migrated));
    } catch {}

    return migrated;
  }
}
