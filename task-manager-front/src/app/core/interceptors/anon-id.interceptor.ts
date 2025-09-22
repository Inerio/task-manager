import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";

/** Local cache to avoid repeated localStorage hits. */
let cachedUid: string | null = null;
const LS_KEY = "tasukeru_uid" as const;
/** Old keys we used in the past (E2E, legacy builds, etc.) */
const LEGACY_KEYS = ["anonId"] as const;

/** Exported key for external consumers . */
export const ANON_ID_LS_KEY = LS_KEY;

/** Generate a UUID. */
function createUid(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Safe localStorage getters/setters. */
function lsGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}
function lsDel(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {}
}

/** Migrate legacy keys to the new one if present. */
function migrateLegacyUid(): string | null {
  for (const k of LEGACY_KEYS) {
    const v = lsGet(k);
    if (v && v.trim()) {
      lsSet(LS_KEY, v);
      lsDel(k);
      cachedUid = v;
      return v;
    }
  }
  return null;
}

/** Get or create the persistent anonymous id. */
function getOrCreateAnonId(): string {
  if (cachedUid) return cachedUid;

  const existing = lsGet(LS_KEY);
  if (existing) {
    cachedUid = existing;
    return existing;
  }
  const migrated = migrateLegacyUid();
  if (migrated) return migrated;

  const fresh = createUid();
  lsSet(LS_KEY, fresh);
  cachedUid = fresh;
  return fresh;
}

/** Only attach header for same-origin requests to avoid leaking the UID. */
function isSameOrigin(url: string): boolean {
  try {
    if (!/^https?:\/\//i.test(url)) return true;
    const target = new URL(url, globalThis.location?.origin ?? undefined);
    return target.origin === globalThis.location?.origin;
  } catch {
    return false;
  }
}

/**
 * Adds a stable anonymous UID to every same-origin request.
 * - Uses env.clientIdHeader
 * - Does not override if header is already set upstream
 */
export const anonIdInterceptor: HttpInterceptorFn = (req, next) => {
  const headerName = environment.clientIdHeader ?? "X-Client-Id";
  if (req.headers.has(headerName)) return next(req);
  if (!isSameOrigin(req.url)) return next(req);

  const uid = getOrCreateAnonId();
  const cloned = req.clone({ setHeaders: { [headerName]: uid } });
  return next(cloned);
};

/* ===== Tiny helpers to keep the interceptor cache in sync ===== */

/** Read the current UID (creates one if missing). */
export function readAnonId(): string {
  return getOrCreateAnonId();
}

/** Overwrite UID (used when user pastes an ID from another device). */
export function setAnonIdFromDialog(newUid: string): void {
  lsSet(LS_KEY, newUid);
  cachedUid = newUid;
}
