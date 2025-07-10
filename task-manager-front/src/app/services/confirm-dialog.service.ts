import { Injectable, signal, Signal } from "@angular/core";

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

  open(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._state.set({ visible: true, title, message, resolve });
    });
  }

  confirm(): void {
    this._state().resolve?.(true);
    this.close();
  }
  cancel(): void {
    this._state().resolve?.(false);
    this.close();
  }
  close(): void {
    this._state.set({ ...this._state(), visible: false, resolve: undefined });
  }
}
