import { Injectable, signal, Signal } from "@angular/core";

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

  show(type: "success" | "error" | "info", message: string, durationMs = 3500) {
    this._alert.set({ type, message });
    setTimeout(() => this.clear(), durationMs);
  }

  clear() {
    this._alert.set(null);
  }
}
