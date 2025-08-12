import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  OnDestroy,
  inject,
} from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";
import { Subscription } from "rxjs";
import i18nEn from "emoji-picker-element/i18n/en";
import i18nFr from "emoji-picker-element/i18n/fr";

/** Narrow type for the <emoji-picker> element so we avoid 'any'. */
type EmojiPickerEl = HTMLElement & {
  shadowRoot: ShadowRoot | null;
  locale?: string; // "en" | "fr"
  dataSource?: string | any;
  i18n?: Record<string, any>;
};

@Component({
  selector: "app-emoji-picker",
  standalone: true,
  template: `
    <emoji-picker
      #emojiPicker
      theme="light"
      (emoji-click)="onEmojiClick($event)"
      class="emoji-picker-dropdown"
      [attr.locale]="currentLocale"
      [attr.data-source]="currentDataUrl"
      style="
        position:absolute; left:50%; top:calc(100% - 18px); z-index:99;
        width:min(340px, 40vw); max-height:370px;
        transform: translateX(-50%) scale(0.77); transform-origin: top center;
        /* brand variables used by the picker CSS */
        --background:#fff;
        --category-button-active-background:#e3f2fd;
        --search-background:#f7f9fc;
        --border-radius:16px;
        --color:#232323;
        /* avoid flash of unstyled content */
        visibility:hidden;
      "
    ></emoji-picker>
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmojiPickerComponent implements AfterViewInit, OnDestroy {
  @ViewChild("emojiPicker", { static: false })
  emojiPickerRef?: ElementRef<EmojiPickerEl>;
  @Output() emojiSelected = new EventEmitter<string>();

  private readonly i18n = inject(TranslocoService);
  private langSub?: Subscription;

  /** Bound into the template as attributes so the custom element sees changes early. */
  currentLocale: "en" | "fr" = (this.i18n.getActiveLang?.() || "").startsWith(
    "fr"
  )
    ? "fr"
    : "en";
  currentDataUrl = this.toDataUrl(this.currentLocale);

  /** Prevent double-application of styles. */
  private stylesApplied = false;

  ngAfterViewInit(): void {
    this.applyAllWithRetries();
    this.langSub = this.i18n.langChanges$.subscribe(() => {
      this.currentLocale = (this.i18n.getActiveLang?.() || "").startsWith("fr")
        ? "fr"
        : "en";
      this.currentDataUrl = this.toDataUrl(this.currentLocale);
      this.configurePicker();
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  /** Build the public URL to the emojibase dataset under /public. */
  private toDataUrl(locale: "en" | "fr"): string {
    return `/emoji-picker/${locale}/emojibase/data.json`;
  }

  // --- bootstrap styles + first configuration with small retry window
  private applyAllWithRetries(): void {
    let tries = 0;
    const MAX_TRIES = 12;

    const apply = () => {
      const picker = this.emojiPickerRef?.nativeElement;
      const sr = picker?.shadowRoot ?? null;

      if (!picker || !sr) {
        if (tries++ < MAX_TRIES) requestAnimationFrame(apply);
        return;
      }

      const searchInput = sr.querySelector(
        'input[type="search"]'
      ) as HTMLInputElement | null;

      if (!searchInput) {
        if (tries++ < MAX_TRIES) requestAnimationFrame(apply);
        return;
      }

      // --- cosmetic tweaks inside the shadow DOM
      searchInput.style.color = "#111";
      searchInput.style.caretColor = "#111";
      if (!sr.getElementById("custom-scrollbar-style")) {
        const style = document.createElement("style");
        style.id = "custom-scrollbar-style";
        style.textContent = `
          ::-webkit-scrollbar { width: 9px; background: #f7f9fc; border-radius: 12px; }
          ::-webkit-scrollbar-thumb { background: #d3d8e2; border-radius: 12px; }
          ::-webkit-scrollbar-thumb:hover { background: #b2b8c7; }
          input[type="search"] { color: #111 !important; caret-color: #111 !important; }
          input[type="search"]::placeholder { color: #8fa1b6 !important; opacity: 1; }
        `;
        sr.appendChild(style);
      }

      // First full configuration (locale + dataset + placeholder + labels)
      this.configurePicker().then(() => {
        picker.style.visibility = "visible";
        this.stylesApplied = true;
      });
    };
    Promise.resolve().then(apply);
  }

  /** Configure locale + dataset (+placeholder + labels) — called at init and on language change. */
  private async configurePicker(): Promise<void> {
    const picker = this.emojiPickerRef?.nativeElement;
    if (!picker) return;

    const locale = this.currentLocale;

    // UI labels (category names, "Search", etc.)
    const ui = locale === "fr" ? (i18nFr as any) : (i18nEn as any);
    try {
      picker.i18n = ui;
    } catch {}

    // Make sure properties are also set on the element
    try {
      picker.locale = locale;
    } catch {}
    try {
      picker.dataSource = this.currentDataUrl;
    } catch {}

    // Placeholder (Transloco > UI fallback)
    const placeholder =
      this.i18n.translate("emoji.searchPlaceholder") ||
      ui?.searchLabel ||
      (locale === "fr" ? "Rechercher" : "Search");

    const input = picker.shadowRoot?.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement | null;
    if (input) {
      input.placeholder = placeholder;
      input.setAttribute("aria-label", placeholder);
    }
  }

  onEmojiClick(event: any): void {
    // Defensive extraction across picker versions.
    const emoji =
      event?.detail?.unicode ??
      event?.emoji?.native ??
      event?.emoji?.emoji ??
      event?.detail ??
      "";
    if (emoji) this.emojiSelected.emit(emoji);
  }
}
