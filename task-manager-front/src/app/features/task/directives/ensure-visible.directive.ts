import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
} from "@angular/core";

/**
 * Make the host fully visible when `ensureVisible` flips to true.
 * - First scrolls the nearest scrollable ancestor (column with overflow).
 * - Then adjusts the *window* using visualViewport (keyboard-aware).
 * - Retries for ~2s to catch late keyboard animations.
 */
@Directive({
  selector: "[ensureVisible]",
  standalone: true,
})
export class EnsureVisibleDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  // Trigger
  readonly ensureVisible = input<boolean>(false, { alias: "ensureVisible" });

  // Margins & retries
  readonly evTopMargin = input<number>(8, { alias: "evTopMargin" });
  /** Extra pad so buttons at the bottom are comfortably visible. */
  readonly evBottomPad = input<number>(72, { alias: "evBottomPad" });
  /** App-specific safe space kept for backward compatibility. */
  readonly evBottomSafe = input<number>(0, { alias: "evBottomSafe" });
  /** Longer retry window to catch keyboard open animations. */
  readonly evRetries = input<readonly number[]>(
    [0, 120, 240, 400, 700, 1000, 1300, 1700, 2200],
    { alias: "evRetries" }
  );
  /** Toggle keyboard awareness; keep ON for mobile. */
  readonly evKeyboardAware = input<boolean>(true, { alias: "evKeyboardAware" });

  private timers: number[] = [];
  private vv?: VisualViewport;

  constructor() {
    // Schedule checks and temporary viewport listeners when triggered.
    effect(() => {
      if (this.ensureVisible()) {
        this.clearTimers();
        this.attachVisualViewportListeners();

        for (const t of this.evRetries()) {
          const id = window.setTimeout(() => this.ensureNow(), t);
          this.timers.push(id);
        }

        // Detach listeners after the retry window.
        const detachId = window.setTimeout(
          () => this.detachVisualViewportListeners(),
          2400
        );
        this.timers.push(detachId);
      }
    });
  }

  ngOnDestroy(): void {
    this.detachVisualViewportListeners();
    this.clearTimers();
  }

  // ----- visualViewport handling (keyboard-aware) -----
  private onVvChange = (): void => {
    this.ensureNow();
  };

  private attachVisualViewportListeners(): void {
    if (!this.evKeyboardAware()) return;
    const vv = window.visualViewport;
    if (!vv) return;
    this.vv = vv;
    vv.addEventListener("geometrychange", this.onVvChange, {
      passive: true,
    } as AddEventListenerOptions);
    vv.addEventListener("resize", this.onVvChange, {
      passive: true,
    } as AddEventListenerOptions);
  }

  private detachVisualViewportListeners(): void {
    if (!this.vv) return;
    this.vv.removeEventListener("geometrychange", this.onVvChange);
    this.vv.removeEventListener("resize", this.onVvChange);
    this.vv = undefined;
  }

  // ----- core visibility logic -----
  private ensureNow(): void {
    const el = this.host.nativeElement;
    if (!el) return;
    try {
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "auto",
      });
    } catch {
      el.scrollIntoView();
    }
    const vv = (this.evKeyboardAware() ? window.visualViewport : null) || null;
    const viewportHeight =
      vv?.height ?? window.innerHeight ?? document.documentElement.clientHeight;

    const topMargin = this.evTopMargin();

    // Estimated keyboard height (layoutViewport - visualViewport).
    const keyboardInset =
      vv && typeof window.innerHeight === "number"
        ? Math.max(0, Math.round(window.innerHeight - vv.height))
        : 0;

    const bottomBudget =
      this.evBottomSafe() + keyboardInset + this.evBottomPad();

    const rect = el.getBoundingClientRect();

    let dy = 0;
    if (rect.top < topMargin) {
      dy = rect.top - topMargin;
    } else if (rect.bottom > viewportHeight - bottomBudget) {
      dy = rect.bottom - (viewportHeight - bottomBudget);
    }

    if (Math.abs(dy) > 0) {
      window.scrollBy({ top: dy, behavior: "smooth" });
    }
  }

  private clearTimers(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }
}
