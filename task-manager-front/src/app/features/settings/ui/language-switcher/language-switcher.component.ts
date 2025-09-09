import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { TranslocoService, TranslocoModule } from "@jsverse/transloco";

type Lang = "en" | "fr";

/**
 * Language switcher:
 * - Persists active lang in localStorage.
 * - Updates <html lang> attribute.
 * - Subscribes to Transloco changes to keep local state in sync.
 */
@Component({
  selector: "app-language-switcher",
  standalone: true,
  templateUrl: "./language-switcher.component.html",
  styleUrls: ["./language-switcher.component.scss"],
  imports: [TranslocoModule], // needed for the |transloco pipe
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent implements OnInit, OnDestroy {
  private readonly transloco = inject(TranslocoService);

  /** Current language as a signal. */
  readonly active = signal<Lang>("en");

  /** Lazy subscription holder. */
  private sub?: { unsubscribe(): void };

  ngOnInit(): void {
    // Restore last language; fallback to Transloco active or "en"
    const saved =
      (localStorage.getItem("translocoLang") as Lang | null) ?? null;
    const current = (this.transloco.getActiveLang() as Lang) || "en";
    const initial: Lang = saved ?? current;

    if (initial !== current) {
      this.transloco.setActiveLang(initial);
    }
    this.active.set(initial);
    document.documentElement.setAttribute("lang", initial);

    this.sub = this.transloco.langChanges$.subscribe((l) => {
      const lang = (l as Lang) || "en";
      this.active.set(lang);
      document.documentElement.setAttribute("lang", lang);
      localStorage.setItem("translocoLang", lang);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe?.();
  }

  /** Explicitly set the requested language. */
  set(lang: Lang): void {
    if (lang === this.active()) return;
    this.transloco.setActiveLang(lang);
  }
}
