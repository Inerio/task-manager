import { Injectable, signal, type Signal } from "@angular/core";
import type { BoardTemplateId } from "../utils/board-templates";

interface PickerState {
  visible: boolean;
  resolve?: (value: BoardTemplateId | null) => void;
}

@Injectable({ providedIn: "root" })
export class TemplatePickerService {
  private readonly _state = signal<PickerState>({ visible: false });
  readonly state: Signal<PickerState> = this._state.asReadonly();

  open(): Promise<BoardTemplateId | null> {
    // Close any previous
    if (this._state().visible) this._state().resolve?.(null);
    return new Promise<BoardTemplateId | null>((resolve) => {
      this._state.set({ visible: true, resolve });
    });
  }

  choose(id: BoardTemplateId): void {
    if (!this._state().visible) return;
    this._state().resolve?.(id);
    this._state.set({ visible: false, resolve: undefined });
  }

  skip(): void {
    if (!this._state().visible) return;
    this._state().resolve?.(null);
    this._state.set({ visible: false, resolve: undefined });
  }
}
