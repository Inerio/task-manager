import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
} from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";

/**
 * Click-to-expand/collapse directive with two modes:
 * - 'length' (legacy): truncation is based on character count (ttMaxLen).
 * - 'overflow' (responsive, default): truncation is CSS-driven; we detect
 *   real overflow with measurements.
 *
 * When expanded, the host remains clickable only if collapsing would
 * truncate again (measured off-screen without flicker).
 */
@Directive({
  selector: "[appToggleTruncate]",
  standalone: true,
  exportAs: "appToggleTruncate",
})
export class ToggleTruncateDirective
  implements AfterViewInit, OnChanges, OnDestroy
{
  /** Full plain-text content; used in 'length' mode. */
  @Input() ttContent: string = "";
  /** Max chars when collapsed (legacy mode). */
  @Input() ttMaxLen = 140;
  /** Reset expansion when key changes. */
  @Input() ttResetKey: unknown;

  /** i18n labels for title tooltips. */
  @Input() ttShowLabelKey?: string;
  @Input() ttHideLabelKey?: string;

  /** Truncation mode: 'length' (legacy) | 'overflow' (responsive). */
  @Input() ttMode: "length" | "overflow" = "overflow";

  /** Public so the template can read the state if needed. */
  expanded = false;

  /** True when collapsed content actually overflows (so expand has impact). */
  private hasOverflow = false;
  /** True when expanded content would overflow again if we collapsed it. */
  private canCollapseWithImpact = false;

  private ro?: ResizeObserver;
  private measureEl?: HTMLElement; // off-screen clone for impact checks

  // Scheduling (avoid jitter during resize / CQ changes)
  private raf1?: number;
  private raf2?: number;
  private resizeTid?: number;

  constructor(
    private readonly i18n: TranslocoService,
    private readonly el: ElementRef<HTMLElement>,
    private readonly zone: NgZone
  ) {}

  // ===== Host bindings =====

  @HostBinding("class.truncated") get truncatedClass(): boolean {
    return !this.expanded;
  }
  @HostBinding("class.is-overflowing") get overflowingClass(): boolean {
    return this.hasOverflow && !this.expanded;
  }

  @HostBinding("style.cursor") get cursor(): string {
    return this.isInteractive ? "pointer" : "auto";
  }
  @HostBinding("attr.role") get role(): string | null {
    return this.isInteractive ? "button" : null;
  }
  @HostBinding("attr.tabindex") get tabIndex(): number | null {
    return this.isInteractive ? 0 : null;
  }
  @HostBinding("attr.aria-expanded") get ariaExpanded(): string | null {
    return this.isInteractive ? String(this.expanded) : null;
  }
  @HostBinding("attr.title") get titleAttr(): string | null {
    if (!this.isInteractive) return null;
    const key = this.expanded ? this.ttHideLabelKey : this.ttShowLabelKey;
    return key ? this.i18n.translate(key) : null;
  }

  /** Clickable only when the action will have a visual impact. */
  private get isInteractive(): boolean {
    if (this.ttMode === "length") {
      return this.canTruncateByLength;
    }
    // overflow mode:
    return (!this.expanded && this.hasOverflow) ||
      (this.expanded && this.canCollapseWithImpact)
      ? true
      : false;
  }

  private get canTruncateByLength(): boolean {
    return !!this.ttContent && this.ttContent.length > (this.ttMaxLen || 0);
  }

  // ===== Lifecycle =====
  ngAfterViewInit(): void {
    if (this.ttMode === "overflow") {
      this.zone.runOutsideAngular(() => {
        // React to element box changes (container queries, column width, etc.)
        this.ro = new ResizeObserver(() => {
          this.scheduleMeasure(this.expanded ? "expanded" : "collapsed");
        });
        this.ro.observe(this.el.nativeElement);

        // React to viewport/orientation changes (some browsers delay RO)
        window.addEventListener("resize", this.onWindowResize, {
          passive: true,
        });
        window.addEventListener("orientationchange", this.onWindowResize, {
          passive: true,
        });

        // Initial measure after first paint
        this.scheduleMeasure("collapsed");
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reset on identity/content changes.
    if (changes["ttResetKey"] && !changes["ttResetKey"].firstChange) {
      this.expanded = false;
      if (this.ttMode === "overflow") {
        this.scheduleMeasure("collapsed");
      }
    }

    if (
      this.ttMode === "length" &&
      (changes["ttContent"] || changes["ttMaxLen"])
    ) {
      if (!this.canTruncateByLength) this.expanded = false;
    }
  }

  ngOnDestroy(): void {
    if (this.ro) this.ro.disconnect();
    this.ro = undefined;

    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("orientationchange", this.onWindowResize);

    if (this.raf1) cancelAnimationFrame(this.raf1);
    if (this.raf2) cancelAnimationFrame(this.raf2);
    if (this.resizeTid) clearTimeout(this.resizeTid);

    if (this.measureEl?.parentElement) {
      this.measureEl.parentElement.removeChild(this.measureEl);
    }
    this.measureEl = undefined;
  }

  // ===== Interaction =====
  @HostListener("click", ["$event"])
  onClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    if (target?.closest("a")) return; // ignore link clicks

    if (!this.isInteractive) return;

    this.expanded = !this.expanded;

    if (this.ttMode === "overflow") {
      this.scheduleMeasure(this.expanded ? "expanded" : "collapsed");
    }
  }

  @HostListener("keydown", ["$event"])
  onKeydown(e: KeyboardEvent): void {
    if (!this.isInteractive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.expanded = !this.expanded;
      if (this.ttMode === "overflow") {
        this.scheduleMeasure(this.expanded ? "expanded" : "collapsed");
      }
    }
  }

  // ===== Scheduling helpers =====

  /** Passive window resize handler. */
  private onWindowResize = (): void => {
    if (this.ttMode !== "overflow") return;
    // Small debounce to let columns finish their own transitions.
    if (this.resizeTid) clearTimeout(this.resizeTid);
    this.resizeTid = window.setTimeout(() => {
      this.scheduleMeasure(this.expanded ? "expanded" : "collapsed");
    }, 40);
  };

  /**
   * Run the requested measurement after layout is stable.
   * We use a double-rAF pattern because container queries and line-clamp
   * can settle one frame later on some browsers during resize.
   */
  private scheduleMeasure(kind: "collapsed" | "expanded"): void {
    if (this.raf1) cancelAnimationFrame(this.raf1);
    if (this.raf2) cancelAnimationFrame(this.raf2);

    this.raf1 = requestAnimationFrame(() => {
      this.raf2 = requestAnimationFrame(() => {
        if (kind === "expanded") this.measureImpactIfCollapsed();
        else this.measureOverflow();
      });
    });
  }

  // ===== Measurements =====

  /** Measure real overflow while collapsed (clamp applied). */
  private measureOverflow(): void {
    if (this.ttMode !== "overflow") return;

    const el = this.el.nativeElement;

    // Only meaningful while collapsed (when clamp is applied).
    if (this.expanded) {
      this.hasOverflow = false;
      return;
    }

    // Detect either vertical or horizontal overflow; allow 1px tolerance.
    const vOverflow = el.scrollHeight - el.clientHeight > 1;
    const hOverflow = el.scrollWidth - el.clientWidth > 1;
    const next = vOverflow || hOverflow;

    if (next !== this.hasOverflow) {
      this.zone.run(() => (this.hasOverflow = next));
    }

    // When collapsed, "would collapsing have impact?" equals current overflow.
    if (this.canCollapseWithImpact !== next) {
      this.zone.run(() => (this.canCollapseWithImpact = next));
    }
  }

  /**
   * When expanded, check if collapsing would visually truncate again.
   * Clone the node as a hidden sibling, force the "truncated" class, then
   * compare scroll size vs client size. No flicker, no layout shift.
   */
  private measureImpactIfCollapsed(): void {
    if (this.ttMode !== "overflow") return;

    const host = this.el.nativeElement;
    const parent = host.parentElement;
    if (!parent) return;

    // Create or reuse a hidden clone inside the same container
    // so container queries & CSS vars resolve identically.
    let m = this.measureEl;
    if (!m) {
      m = host.cloneNode(true) as HTMLElement;
      m.setAttribute("aria-hidden", "true");
      m.style.position = "absolute";
      m.style.left = "0";
      m.style.top = "0";
      m.style.visibility = "hidden";
      m.style.pointerEvents = "none";
      m.style.zIndex = "-1";
      m.style.contain = "layout style size";
      this.measureEl = m;
      parent.appendChild(m);
    }

    // Sync width to host content box for same clamp result.
    const width = host.clientWidth;
    m.style.width = width > 0 ? `${width}px` : "";

    // Copy classes and ensure "truncated" is present; remove state classes.
    m.className = host.className;
    m.classList.add("truncated");
    m.classList.remove("is-overflowing");

    // Copy HTML content (we use linkified HTML in the host).
    m.innerHTML = host.innerHTML;

    // Force layout and measure overflow in clamped state.
    const vOverflow = m.scrollHeight - m.clientHeight > 1;
    const hOverflow = m.scrollWidth - m.clientWidth > 1;
    const next = vOverflow || hOverflow;

    if (next !== this.canCollapseWithImpact) {
      this.zone.run(() => (this.canCollapseWithImpact = next));
    }
  }
}
