import { Injectable, signal, Signal } from "@angular/core";

/* ==== CONFIRM DIALOG SERVICE ==== */

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
   */
  open(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._state.set({ visible: true, title, message, resolve });
    });
  }

  /**
   * Called when the user confirms.
   */
  confirm(): void {
    this._state().resolve?.(true);
    this.close();
  }

  /**
   * Called when the user cancels.
   */
  cancel(): void {
    this._state().resolve?.(false);
    this.close();
  }

  /**
   * Closes the dialog and clears the resolver.
   */
  close(): void {
    this._state.set({ ...this._state(), visible: false, resolve: undefined });
  }
}
