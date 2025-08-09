import { Injectable, signal, type Signal } from "@angular/core";

/** Internal state shape for the confirm dialog. */
interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  resolve?: (value: boolean) => void;
}

@Injectable({ providedIn: "root" })
export class ConfirmDialogService {
  private readonly _state = signal<ConfirmDialogState>({
    visible: false,
    title: "",
    message: "",
    resolve: undefined,
  });

  readonly state: Signal<ConfirmDialogState> = this._state.asReadonly();

  /** Open the dialog and resolve with user's choice (true/false). */
  open(title: string, message: string): Promise<boolean> {
    // If already open, resolve previous as "cancel".
    if (this._state().visible) {
      this._state().resolve?.(false);
    }
    return new Promise<boolean>((resolve) => {
      this._state.set({ visible: true, title, message, resolve });
    });
  }

  /** Confirm action (idempotent). */
  confirm(): void {
    if (this._state().visible) {
      this._state().resolve?.(true);
      this.close();
    }
  }

  /** Cancel action (idempotent). */
  cancel(): void {
    if (this._state().visible) {
      this._state().resolve?.(false);
      this.close();
    }
  }

  /** Close dialog and clear resolver. */
  close(): void {
    this._state.set({ ...this._state(), visible: false, resolve: undefined });
  }
}
