import { HttpInterceptorFn } from "@angular/common/http";

/**
 * Adds a stable anonymous UID to every request.
 * The UID is stored in localStorage and never expires.
 */
export const anonIdInterceptor: HttpInterceptorFn = (req, next) => {
  let uid = localStorage.getItem("tasukeru_uid");
  if (!uid) {
    try {
      uid = crypto.randomUUID();
    } catch {
      // Fallback (older browsers/environments)
      uid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    localStorage.setItem("tasukeru_uid", uid);
  }
  const cloned = req.clone({ setHeaders: { "X-Client-Id": uid! } });
  return next(cloned);
};
