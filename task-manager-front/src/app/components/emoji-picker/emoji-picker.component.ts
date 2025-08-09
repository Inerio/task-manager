import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  AfterViewInit,
  Renderer2,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";

@Component({
  selector: "app-emoji-picker",
  standalone: true,
  template: `
    <emoji-picker
      #emojiPicker
      theme="light"
      (emoji-click)="onEmojiClick($event)"
      class="emoji-picker-dropdown"
      style="position: absolute; left: 0; top: 91%; z-index: 99; width: 100%; min-width: 260px; max-height: 370px;"
    ></emoji-picker>
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmojiPickerComponent implements AfterViewInit {
  @ViewChild("emojiPicker", { static: false }) emojiPickerRef?: ElementRef;
  @Output() emojiSelected = new EventEmitter<string>();

  private readonly renderer = inject(Renderer2);
  private stylesApplied = false;

  ngAfterViewInit(): void {
    // Apply shadow DOM styles once, after the web component renders.
    const apply = () => {
      if (this.stylesApplied || !this.emojiPickerRef?.nativeElement) return;
      const picker = this.emojiPickerRef.nativeElement as any;
      const host = picker.shadowRoot?.host as HTMLElement | undefined;
      if (!host) {
        // Try again on next frame if shadowRoot isn't ready yet.
        requestAnimationFrame(apply);
        return;
      }
      this.stylesApplied = true;
      host.style.transform = "scale(0.715)";
      host.style.transformOrigin = "top left";
      host.style.width = "140%";
      host.style.minWidth = "0";
      host.style.setProperty("--background", "#fff");
      host.style.setProperty("--category-button-active-background", "#e3f2fd");
      host.style.setProperty("--search-background", "#f7f9fc");
      host.style.setProperty("--border-radius", "16px");
      host.style.setProperty("--color", "#232323");

      if (!picker.shadowRoot.getElementById("custom-scrollbar-style")) {
        const style = document.createElement("style");
        style.id = "custom-scrollbar-style";
        style.textContent = `
          ::-webkit-scrollbar { width: 9px; background: #f7f9fc; border-radius: 12px; }
          ::-webkit-scrollbar-thumb { background: #d3d8e2; border-radius: 12px; }
          ::-webkit-scrollbar-thumb:hover { background: #b2b8c7; }
        `;
        picker.shadowRoot.appendChild(style);
      }
    };
    requestAnimationFrame(apply);
  }

  onEmojiClick(event: any): void {
    const emoji =
      event?.detail?.unicode ??
      event?.emoji?.native ??
      event?.emoji?.emoji ??
      event?.detail ??
      "";
    if (emoji) this.emojiSelected.emit(emoji);
  }
}
