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
      style="position:absolute; left:50%; top:calc(100% - 18px); z-index:99; width:min(340px, 40vw); max-height:370px;"
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
    // Apply styles once the shadow DOM is ready. Some builds render the input a frame later,
    // so we retry a few times (cheap, no listeners).
    let tries = 0;
    const MAX_TRIES = 8;

    const apply = () => {
      if (this.stylesApplied || !this.emojiPickerRef?.nativeElement) return;

      const picker = this.emojiPickerRef.nativeElement;
      const host = picker.shadowRoot?.host as HTMLElement | undefined;
      if (!host) {
        // Shadow root not ready yet — try next frame.
        if (tries++ < MAX_TRIES) requestAnimationFrame(apply);
        return;
      }

      // --- Host-level sizing/skin (kept from your version) ---
      host.style.transform = "translateX(-50%) scale(0.77)";
      host.style.transformOrigin = "top center";
      host.style.setProperty("--background", "#fff");
      host.style.setProperty("--category-button-active-background", "#e3f2fd");
      host.style.setProperty("--search-background", "#f7f9fc");
      host.style.setProperty("--border-radius", "16px");
      host.style.setProperty("--color", "#232323");

      // Ensure the search input exists before styling it; if not, retry.
      const searchInput = picker.shadowRoot?.querySelector(
        'input[type="search"]'
      ) as HTMLInputElement | null;

      if (!searchInput) {
        if (tries++ < MAX_TRIES) requestAnimationFrame(apply);
        return;
      }

      // Text & caret color (readability on light bg).
      searchInput.style.color = "#111";
      searchInput.style.caretColor = "#111";

      // Inject once: scrollbar cosmetics + placeholder color.
      if (!picker.shadowRoot!.getElementById("custom-scrollbar-style")) {
        const style = document.createElement("style");
        style.id = "custom-scrollbar-style";
        style.textContent = `
          ::-webkit-scrollbar { width: 9px; background: #f7f9fc; border-radius: 12px; }
          ::-webkit-scrollbar-thumb { background: #d3d8e2; border-radius: 12px; }
          ::-webkit-scrollbar-thumb:hover { background: #b2b8c7; }

          input[type="search"] { color: #111 !important; caret-color: #111 !important; }
          input[type="search"]::placeholder { color: #8fa1b6 !important; opacity: 1; }
        `;
        picker.shadowRoot!.appendChild(style);
      }

      this.stylesApplied = true;
    };

    requestAnimationFrame(apply);
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
