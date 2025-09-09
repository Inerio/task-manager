import {
  Directive,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";

/**
 * Generic "click to expand/collapse truncated text" directive.
 * - Adds .truncated class while collapsed (so existing CSS keeps working).
 * - Sets cursor, role, aria-expanded and title for a11y.
 * - Ignores clicks on links inside the host.
 *
 * Exported as "appToggleTruncate" so templates can read `expanded`.
 */
@Directive({
  selector: "[appToggleTruncate]",
  standalone: true,
  exportAs: "appToggleTruncate",
})
export class ToggleTruncateDirective implements OnChanges {
  /** Full plain-text content used to decide if truncation is needed. */
  @Input() ttContent: string = "";
  /** Max chars when collapsed. */
  @Input() ttMaxLen = 140;
  /** When this input changes, the directive collapses (resets). */
  @Input() ttResetKey: unknown;

  /** Optional Transloco keys for the title attribute. */
  @Input() ttShowLabelKey?: string;
  @Input() ttHideLabelKey?: string;

  /** Current expansion state (exposed via exportAs). */
  expanded = false;

  constructor(private readonly i18n: TranslocoService) {}

  private get canTruncate(): boolean {
    return !!this.ttContent && this.ttContent.length > (this.ttMaxLen || 0);
  }

  // === Host bindings (keep previous UX 1:1) ===
  @HostBinding("class.truncated") get truncatedClass() {
    return this.canTruncate && !this.expanded;
  }
  @HostBinding("style.cursor") get cursor() {
    return this.canTruncate ? "pointer" : "auto";
  }
  @HostBinding("attr.role") get role() {
    return this.canTruncate ? "button" : null;
  }
  @HostBinding("attr.aria-expanded") get ariaExpanded() {
    return this.canTruncate ? String(this.expanded) : null;
  }
  @HostBinding("attr.title") get titleAttr() {
    if (!this.canTruncate) return null;
    const key = this.expanded ? this.ttHideLabelKey : this.ttShowLabelKey;
    return key ? this.i18n.translate(key) : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reset on identity/content changes.
    if (changes["ttResetKey"] && !changes["ttResetKey"].firstChange) {
      this.expanded = false;
    }
    if (changes["ttContent"] || changes["ttMaxLen"]) {
      if (!this.canTruncate) this.expanded = false;
    }
  }

  @HostListener("click", ["$event"])
  onClick(ev: MouseEvent): void {
    // Do not toggle when clicking a link inside the host.
    const target = ev.target as HTMLElement | null;
    if (target?.closest("a")) return;
    if (!this.canTruncate) return;
    this.expanded = !this.expanded;
  }
}
