import { Injectable, signal, Signal } from "@angular/core";

/**
 * Provides a reactive alert "stack" (toast) system, with auto-dismiss.
 * Each alert has its own timeout and can be closed manually.
 */
export interface AlertMessage {
  id: number;
  type: "success" | "error" | "info";
  message: string;
  timeout?: number;
}

@Injectable({ providedIn: "root" })
export class AlertService {
  private _alerts = signal<AlertMessage[]>([]);
  private _nextId = 1;

  /** Reactive, readonly stack of alerts. */
  get alerts(): Signal<AlertMessage[]> {
    return this._alerts.asReadonly();
  }

  /**
   * Show an alert (toast) of given type and message.
   * Each alert is auto-dismissed after `durationMs` (default: 3500ms).
   */
  show(type: AlertMessage["type"], message: string, durationMs = 3500) {
    const id = this._nextId++;
    const alert: AlertMessage = { id, type, message, timeout: durationMs };
    this._alerts.update((alerts) => [...alerts, alert]);
    // Auto-dismiss this alert after durationMs
    setTimeout(() => this.dismiss(id), durationMs);
  }

  /** Dismiss a specific alert by its id. */
  dismiss(id: number) {
    this._alerts.update((alerts) => alerts.filter((alert) => alert.id !== id));
  }

  /** Dismiss all alerts (optional utility) */
  clearAll() {
    this._alerts.set([]);
  }
}
