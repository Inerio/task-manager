import { Injectable, signal, type Signal } from "@angular/core";

/** Allowed alert kinds. */
export type AlertType = "success" | "error" | "info";

/** Toast/alert message model. */
export interface AlertMessage {
  readonly id: number;
  readonly type: AlertType;
  readonly message: string;
  /** Auto-dismiss delay in ms (informative). */
  readonly timeout?: number;
}

/**
 * Simple reactive alert/toast stack.
 * Each alert auto-dismisses after its own timeout.
 */
@Injectable({ providedIn: "root" })
export class AlertService {
  private readonly _alerts = signal<AlertMessage[]>([]);
  private _nextId = 1;

  /** Track active timers to avoid stray callbacks after clear/dismiss. */
  private readonly _timers = new Map<number, number>();

  /** Readonly, reactive alert list (consumed by the UI component). */
  get alerts(): Signal<AlertMessage[]> {
    return this._alerts.asReadonly();
  }

  /** Show a toast with optional duration (ms, default 3500). */
  show(type: AlertType, message: string, durationMs = 3500): void {
    const id = this._nextId++;
    const alert: AlertMessage = { id, type, message, timeout: durationMs };
    this._alerts.update((list) => [...list, alert]);

    const handle = window.setTimeout(() => {
      this._timers.delete(id);
      this.dismiss(id);
    }, durationMs);
    this._timers.set(id, handle);
  }

  /** Remove a toast by id (clears its timer if still pending). */
  dismiss(id: number): void {
    const handle = this._timers.get(id);
    if (handle != null) {
      clearTimeout(handle);
      this._timers.delete(id);
    }
    this._alerts.update((list) => list.filter((a) => a.id !== id));
  }

  /** Clear all toasts and cancel pending timers. */
  clearAll(): void {
    this._timers.forEach((h) => clearTimeout(h));
    this._timers.clear();
    this._alerts.set([]);
  }
}
