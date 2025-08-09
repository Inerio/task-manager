import { Injectable, signal, type Signal } from "@angular/core";

/**
 * Simple reactive alert/toast stack.
 * Each alert auto-dismisses after its own timeout.
 */
export interface AlertMessage {
  id: number;
  type: "success" | "error" | "info";
  message: string;
  timeout?: number;
}

@Injectable({ providedIn: "root" })
export class AlertService {
  private readonly _alerts = signal<AlertMessage[]>([]);
  private _nextId = 1;

  /** Readonly, reactive alert list. */
  get alerts(): Signal<AlertMessage[]> {
    return this._alerts.asReadonly();
  }

  /** Show a toast message with optional duration (ms, default 3500). */
  show(type: AlertMessage["type"], message: string, durationMs = 3500): void {
    const id = this._nextId++;
    const alert: AlertMessage = { id, type, message, timeout: durationMs };
    this._alerts.update((list) => [...list, alert]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  /** Remove a toast by id. */
  dismiss(id: number): void {
    this._alerts.update((list) => list.filter((a) => a.id !== id));
  }

  /** Clear all toasts. */
  clearAll(): void {
    this._alerts.set([]);
  }
}
