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

/**
 * Small helper around the anonymous client ID.
 * Keeps LS and the interceptor's in-memory cache in sync.
 * Canonical form = UUID (lowercase). Short form = Base64URL (22 chars).
 */
@Injectable({ providedIn: "root" })
export class AccountIdService {
  readonly headerName = environment.clientIdHeader ?? "X-Client-Id";
  readonly storageKey = ANON_ID_LS_KEY;

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

  /** Normalize and persist. If short code, expand to UUID then lowercase. */
  setUid(input: string): void {
    let v = (input ?? "").trim();
    if (isShort(v)) {
      v = shortToUuid(v);
    }
    if (!isUuid(v)) {
      throw new Error("Invalid UID");
    }
    setAnonIdFromDialog(v.toLowerCase());
  }

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
}
