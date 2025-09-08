import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  inject,
} from "@angular/core";

/**
 * Focus the host element once it is rendered, and place the caret at the end
 * when the host is an <input> or <textarea>.
 */
@Directive({
  selector: "[appAutofocusOnInit]",
  standalone: true,
})
export class AutofocusOnInitDirective implements AfterViewInit {
  /** Allows toggling the behavior: [appAutofocusOnInit]="false" to disable. */
  @Input("appAutofocusOnInit") enabled: boolean | "" = true;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    if (this.enabled === false) return;

    // Defer to next frame to ensure the element is attached & visible.
    requestAnimationFrame(() => {
      queueMicrotask(() => {
        const node = this.el.nativeElement as HTMLElement;
        try {
          node.focus();

          // If it's a text input/textarea, move caret to the end.
          const input = node as HTMLInputElement | HTMLTextAreaElement;
          if (
            typeof input.setSelectionRange === "function" &&
            typeof input.value === "string"
          ) {
            const len = input.value.length;
            input.setSelectionRange(len, len);
          }
        } catch {
          // Silently ignore focus errors (e.g., element disabled or not focusable).
        }
      });
    });
  }
}
