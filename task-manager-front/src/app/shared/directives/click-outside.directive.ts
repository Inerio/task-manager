import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from "@angular/core";

/**
 * Emits (clickOutside) when a mousedown happens outside the host element.
 * Optional `coIgnore` allows ignoring clicks when the target (or its ancestors)
 * matches one (or many) CSS selectors (e.g. dropdowns/portals).
 *
 * Usage:
 * <div appClickOutside (clickOutside)="..." coIgnore=".emoji-picker-dropdown"></div>
 */
@Directive({
  selector: "[appClickOutside]",
  standalone: true,
})
export class ClickOutsideDirective {
  /** One or many CSS selectors to ignore for outside detection. */
  @Input() coIgnore: string | string[] | null = null;

  /** Fired when a click happens outside the host (and not in ignored areas). */
  @Output() readonly clickOutside = new EventEmitter<MouseEvent>();

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  @HostListener("document:mousedown", ["$event"])
  onDocumentMouseDown(ev: MouseEvent): void {
    const host = this.el.nativeElement;
    const target = ev.target as Node | null;
    if (!target) return;

    // Inside host → ignore.
    if (host.contains(target)) return;

    // If the target (or its ancestors) matches any ignored selector → ignore.
    if (this.matchesAnyIgnoreSelector(target)) return;

    this.clickOutside.emit(ev);
  }

  private matchesAnyIgnoreSelector(node: Node): boolean {
    const asEl = node as Element | null;
    if (!asEl) return false;

    const list =
      typeof this.coIgnore === "string"
        ? [this.coIgnore]
        : Array.isArray(this.coIgnore)
        ? this.coIgnore
        : [];

    for (const sel of list) {
      if (!sel) continue;
      if (asEl.closest(sel)) return true;
    }
    return false;
  }
}
