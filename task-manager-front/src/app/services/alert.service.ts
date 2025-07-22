import { Injectable, signal, Signal } from "@angular/core";

/* ==== ALERT SERVICE ==== */

@Injectable({ providedIn: "root" })
export class AlertService {
  private _alert = signal<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  get alert(): Signal<{
    type: "success" | "error" | "info";
    message: string;
  } | null> {
    return this._alert.asReadonly();
  }

  /**
   * Show an alert of the given type and message for a limited duration (default: 3500ms).
   * Automatically clears the alert after the duration.
   */
  show(type: "success" | "error" | "info", message: string, durationMs = 3500) {
    this._alert.set({ type, message });
    setTimeout(() => this.clear(), durationMs);
  }

  /** Clear the currently displayed alert. */
  clear() {
    this._alert.set(null);
  }
}
