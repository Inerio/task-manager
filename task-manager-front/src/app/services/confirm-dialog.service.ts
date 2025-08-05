import { Injectable, signal, Signal } from "@angular/core";

/* ==== CONFIRM DIALOG SERVICE ==== */

/**
 * Internal state for confirm dialog.
 */
interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  resolve?: (value: boolean) => void;
}

@Injectable({ providedIn: "root" })
export class ConfirmDialogService {
  private _state = signal<ConfirmDialogState>({
    visible: false,
    title: "",
    message: "",
    resolve: undefined,
  });

  readonly state: Signal<ConfirmDialogState> = this._state.asReadonly();

  /**
   * Opens the dialog and returns a promise that resolves with the user's choice.
   * Prevents multiple dialogs open at once (resolves previous as false if any).
   */
  open(title: string, message: string): Promise<boolean> {
    // If already open, auto-resolve previous as "cancel"
    if (this._state().visible) {
      this._state().resolve?.(false);
    }
    return new Promise<boolean>((resolve) => {
      this._state.set({ visible: true, title, message, resolve });
    });
  }

  /**
   * Called when the user confirms. Idempotent.
   */
  confirm(): void {
    if (this._state().visible) {
      this._state().resolve?.(true);
      this.close();
    }
  }

  /**
   * Called when the user cancels. Idempotent.
   */
  cancel(): void {
    if (this._state().visible) {
      this._state().resolve?.(false);
      this.close();
    }
  }

  /**
   * Closes the dialog and clears the resolver.
   */
  close(): void {
    this._state.set({ ...this._state(), visible: false, resolve: undefined });
  }
}
