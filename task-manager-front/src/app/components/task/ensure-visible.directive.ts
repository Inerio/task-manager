import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
} from "@angular/core";

/**
 * Ensure the host element is fully visible in the viewport when the trigger turns true.
 * Retries a few times to account for transitions/layout shifts.
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
  readonly evBottomSafe = input<number>(0, { alias: "evBottomSafe" });
  readonly evRetries = input<readonly number[]>([0, 80, 160, 260, 360], {
    alias: "evRetries",
  });

  private timers: number[] = [];

  constructor() {
    // When it turns true, schedule multiple checks.
    effect(() => {
      if (this.ensureVisible()) {
        this.clearTimers();
        for (const t of this.evRetries()) {
          const id = window.setTimeout(() => this.ensureNow(), t);
          this.timers.push(id);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private ensureNow(): void {
    const el = this.host.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vpH = window.innerHeight || document.documentElement.clientHeight;

    const topMargin = this.evTopMargin();
    const bottomSafe = this.evBottomSafe();

    let dy = 0;
    if (rect.top < topMargin) {
      dy = rect.top - topMargin;
    } else if (rect.bottom > vpH - bottomSafe) {
      dy = rect.bottom - (vpH - bottomSafe);
    }

    if (dy !== 0) window.scrollBy({ top: dy, behavior: "smooth" });
  }

  private clearTimers(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }
}
