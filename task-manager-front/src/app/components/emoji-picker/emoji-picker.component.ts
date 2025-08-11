import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
} from "@angular/core";

/** Narrow type for the <emoji-picker> element so we avoid 'any'. */
type EmojiPickerEl = HTMLElement & { shadowRoot: ShadowRoot | null };

@Component({
  selector: "app-emoji-picker",
  standalone: true,
  template: `
    <emoji-picker
      #emojiPicker
      theme="light"
      (emoji-click)="onEmojiClick($event)"
      class="emoji-picker-dropdown"
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
        /* prevent flash of unstyled content */
        visibility:hidden;
      "
    ></emoji-picker>
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmojiPickerComponent implements AfterViewInit {
  @ViewChild("emojiPicker", { static: false })
  emojiPickerRef?: ElementRef<EmojiPickerEl>;
  @Output() emojiSelected = new EventEmitter<string>();

  /** Prevent double-application of styles. */
  private stylesApplied = false;

  ngAfterViewInit(): void {
    // Try immediately; if shadow isn't ready, retry for a few frames.
    let tries = 0;
    const MAX_TRIES = 12;

    const apply = () => {
      if (this.stylesApplied) return;
      const picker = this.emojiPickerRef?.nativeElement;
      if (!picker) return;

      // If the element hasn't been upgraded yet, try again shortly.
      const host: HTMLElement | undefined = picker.shadowRoot?.host as any;
      if (!host) {
        if (tries++ < MAX_TRIES) {
          requestAnimationFrame(apply);
        }
        return;
      }

      // --- Shadow-level tweaks (cannot be done via outer CSS) ---
      const sr = picker.shadowRoot!;

      // Style the search input (text and caret) once it exists.
      const searchInput = sr.querySelector(
        'input[type="search"]'
      ) as HTMLInputElement | null;

      if (!searchInput) {
        if (tries++ < MAX_TRIES) {
          requestAnimationFrame(apply);
        }
        return;
      }

      searchInput.style.color = "#111";
      searchInput.style.caretColor = "#111";

      // Inject once: scrollbar cosmetics + placeholder color.
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

      // All set → reveal instantly (no flash of default skin).
      picker.style.visibility = "visible";
      this.stylesApplied = true;
    };

    // Kick off immediately (microtask), then let RAF retries pick it up.
    Promise.resolve().then(apply);
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
