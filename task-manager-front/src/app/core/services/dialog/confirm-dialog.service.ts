import { Injectable, signal, type Signal } from "@angular/core";

/** Internal state for the confirm dialog. */
interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  resolve?: (value: boolean) => void;
  confirmText?: string;
  cancelText?: string;
  allowEnterConfirm: boolean;
}

type ConfirmDialogOptions = {
  confirmText?: string;
  cancelText?: string;
  allowEnterConfirm?: boolean;
};

@Injectable({ providedIn: "root" })
export class ConfirmDialogService {
  private readonly _state = signal<ConfirmDialogState>({
    visible: false,
    title: "",
    message: "",
    resolve: undefined,
    confirmText: undefined,
    cancelText: undefined,
    allowEnterConfirm: true,
  });

  /** Readonly state consumed by the dialog component. */
  readonly state: Signal<ConfirmDialogState> = this._state.asReadonly();

  /**
   * Open the dialog and resolve with the user's choice (true/false).
   * If a dialog is already open, the previous Promise resolves to `false`.
   */
  open(
    title: string,
    message: string,
    options?: ConfirmDialogOptions
  ): Promise<boolean> {
    if (this._state().visible) this._state().resolve?.(false);

    return new Promise<boolean>((resolve) => {
      this._state.set({
        visible: true,
        title,
        message,
        resolve,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        allowEnterConfirm: options?.allowEnterConfirm ?? true,
      });
    });
  }

  /** Confirm action. */
  confirm(): void {
    if (!this._state().visible) return;
    this._state().resolve?.(true);
    this.close();
  }

  /** Cancel action. */
  cancel(): void {
    if (!this._state().visible) return;
    this._state().resolve?.(false);
    this.close();
  }

  /** Close dialog and clear resolver/labels. */
  close(): void {
    const s = this._state();
    this._state.set({
      ...s,
      visible: false,
      resolve: undefined,
      confirmText: undefined,
      cancelText: undefined,
      allowEnterConfirm: true,
    });
  }
}
