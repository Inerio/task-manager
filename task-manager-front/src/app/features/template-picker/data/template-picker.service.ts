import { Injectable, signal, type Signal } from "@angular/core";
import type { BoardTemplateId } from "../../board/utils/board-templates";

/** Minimal state for the template picker modal. */
interface PickerState {
  visible: boolean;
  resolve?: (value: BoardTemplateId | null) => void;
}

@Injectable({ providedIn: "root" })
export class TemplatePickerService {
  private readonly _state = signal<PickerState>({ visible: false });

  /** Readonly state consumed by the modal component. */
  readonly state: Signal<PickerState> = this._state.asReadonly();

  /**
   * Open the picker. Resolves with a template id, or null if skipped/closed.
   * If a picker is already open, the previous Promise resolves to `null`.
   */
  open(): Promise<BoardTemplateId | null> {
    if (this._state().visible) this._state().resolve?.(null);

    return new Promise<BoardTemplateId | null>((resolve) => {
      this._state.set({ visible: true, resolve });
    });
  }

  /** Choose a template and close. */
  choose(id: BoardTemplateId): void {
    if (!this._state().visible) return;
    this._state().resolve?.(id);
    this._state.set({ visible: false, resolve: undefined });
  }

  /** Skip selection and close. */
  skip(): void {
    if (!this._state().visible) return;
    this._state().resolve?.(null);
    this._state.set({ visible: false, resolve: undefined });
  }
}
