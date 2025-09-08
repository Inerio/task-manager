import {
  Injectable,
  OnDestroy,
  Renderer2,
  RendererFactory2,
  signal,
} from "@angular/core";

/**
 * Swallows document/window interactions while a native OS dialog (file picker) is open.
 * Scoped at the component level: add it to `providers` of the component using it.
 */
@Injectable()
export class NativeDialogGuardService implements OnDestroy {
  private readonly r: Renderer2;
  private readonly _open = signal(false);
  private unlisteners: Array<() => void> = [];

  constructor(rendererFactory: RendererFactory2) {
    this.r = rendererFactory.createRenderer(null, null);

    // Single handler that swallows events when a native dialog is open.
    const swallowIfOpen = (e: Event) => {
      if (!this._open()) return;
      (
        e as { stopImmediatePropagation?: () => void }
      ).stopImmediatePropagation?.();
      e.stopPropagation();
      e.preventDefault();
    };

    this.unlisteners.push(
      this.r.listen("document", "mousedown", swallowIfOpen),
      this.r.listen("document", "mouseup", swallowIfOpen),
      this.r.listen("document", "click", swallowIfOpen),
      this.r.listen("document", "focusin", swallowIfOpen),
      this.r.listen("document", "keydown", (e: KeyboardEvent) => {
        if (this._open() && e.key === "Escape") swallowIfOpen(e);
      }),
      this.r.listen("window", "focus", () => {
        if (this._open()) {
          // Allow the OS dialog to fully close before releasing the guard.
          setTimeout(() => this.setOpen(false), 0);
        }
      })
    );
  }

  /** External API used by the form: (dialogOpen) -> guard.setOpen(true|false) */
  setOpen(open: boolean): void {
    this._open.set(open);
  }

  /** Optional read access. */
  isOpen(): boolean {
    return this._open();
  }

  ngOnDestroy(): void {
    this.unlisteners.forEach((u) => {
      try {
        u();
      } catch {
        // no-op
      }
    });
    this.unlisteners = [];
  }
}
