import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Output,
} from "@angular/core";

/**
 * Clamp a wrapping list to N rows when collapsed.
 * - Host must contain items with class ".attachment-tag" inside a flex-wrap container ".attachment-tags".
 * - The directive computes the collapsed maxHeight and whether a toggle is needed.
 * - Parent drives expansion via [appClampExpanded] and listens to outputs.
 */
@Directive({
  selector: "[appClampToRows]",
  standalone: true,
  exportAs: "appClampToRows",
})
export class ClampToRowsDirective
  implements AfterViewInit, OnChanges, OnDestroy
{
  /** Number of rows to show when collapsed (default: 2). */
  @Input("appClampToRows") rows = 2;

  /** Controlled expanded state (parent input). */
  @Input() appClampExpanded = false;

  /** Emits true when content exceeds the collapsed height (i.e., toggle should be shown). */
  @Output() readonly appClampNeedsToggle = new EventEmitter<boolean>();

  /** Emits the computed collapsed height in px. */
  @Output() readonly appClampHeight = new EventEmitter<number>();

  /** Apply clamped visuals on host. */
  @HostBinding("class.clamped") get clamped(): boolean {
    return this._needsToggle && !this.appClampExpanded;
  }

  /** Host max-height in collapsed state. */
  @HostBinding("style.maxHeight.px") maxHeight: number | null = null;

  private _needsToggle = false;
  private _collapsedPx = 0;

  private ro?: ResizeObserver;
  private mo?: MutationObserver;

  constructor(private readonly elRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    // Recompute once rendered.
    this.recompute();

    // React to size changes.
    if ("ResizeObserver" in window) {
      this.ro = new ResizeObserver(() => this.recompute());
      this.ro.observe(this.elRef.nativeElement);
    }

    // React to children mutations (items added/removed).
    this.mo = new MutationObserver(() => this.recompute());
    this.mo.observe(this.elRef.nativeElement, {
      childList: true,
      subtree: true,
    });
  }

  ngOnChanges(): void {
    // Parent toggled expanded; re-apply maxHeight.
    this.applyBindings();
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.mo?.disconnect();
  }

  /** Public hook if caller wants to force a remeasure. */
  public recompute(): void {
    const host = this.elRef.nativeElement;
    const anyTag = host.querySelector(".attachment-tag") as HTMLElement | null;

    if (!anyTag) {
      this._needsToggle = false;
      this._collapsedPx = 0;
      this.emitState();
      this.applyBindings();
      return;
    }

    // Try to read row gap from the wrapping ".attachment-tags"
    const container =
      (host.querySelector(".attachment-tags") as HTMLElement | null) ?? host;
    const style = getComputedStyle(container);
    const rowGap =
      parseFloat((style.rowGap || style.gap || "0").toString()) || 0;

    const itemH = anyTag.getBoundingClientRect().height || 0;

    // Strict N-rows clamp:
    // - use floor to not overshoot
    // - minus 1px epsilon so a 3rd row can't peek in
    const collapsed =
      Math.floor(itemH * this.rows + rowGap * Math.max(0, this.rows - 1)) - 1;

    this._collapsedPx = Math.max(collapsed, 0);

    // +1 px tolerance to avoid flicker when equal.
    this._needsToggle = host.scrollHeight > this._collapsedPx + 1;

    this.emitState();
    this.applyBindings();
  }

  private emitState(): void {
    this.appClampHeight.emit(this._collapsedPx);
    this.appClampNeedsToggle.emit(this._needsToggle);
  }

  private applyBindings(): void {
    this.maxHeight =
      this._needsToggle && !this.appClampExpanded ? this._collapsedPx : null;
  }
}
