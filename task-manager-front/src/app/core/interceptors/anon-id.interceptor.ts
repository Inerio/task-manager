import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";

/** Local cache to avoid repeated localStorage hits. */
let cachedUid: string | null = null;
const LS_KEY = "tasukeru_uid" as const;

/** Generate a UUID (fallback for older engines). */
function createUid(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Fallback: non-cryptographic but stable enough for anon id
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

/** Get or create the persistent anonymous id. */
function getOrCreateAnonId(): string {
  if (cachedUid) return cachedUid;
  const existing = lsGet(LS_KEY);
  if (existing) {
    cachedUid = existing;
    return existing;
  }
  const fresh = createUid();
  lsSet(LS_KEY, fresh);
  cachedUid = fresh;
  return fresh;
}

/** Only attach header for same-origin requests to avoid leaking the UID. */
function isSameOrigin(url: string): boolean {
  try {
    // Relative URL -> same origin
    if (!/^https?:\/\//i.test(url)) return true;
    const target = new URL(url, globalThis.location?.origin ?? undefined);
    return target.origin === globalThis.location?.origin;
  } catch {
    // On parsing error, be conservative and skip
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
  if (req.headers.has(headerName)) return next(req); // respect upstream header
  if (!isSameOrigin(req.url)) return next(req); // don't leak across origins

  const uid = getOrCreateAnonId();
  const cloned = req.clone({ setHeaders: { [headerName]: uid } });
  return next(cloned);
};
