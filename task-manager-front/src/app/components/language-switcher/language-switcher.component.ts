import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { TranslocoService, TranslocoModule } from "@jsverse/transloco";

@Component({
  selector: "app-language-switcher",
  standalone: true,
  templateUrl: "./language-switcher.component.html",
  styleUrls: ["./language-switcher.component.scss"],
  imports: [TranslocoModule], // needed for the |transloco pipe
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent implements OnInit, OnDestroy {
  readonly active = signal<"en" | "fr">("en");
  private sub?: { unsubscribe(): void };

  constructor(private transloco: TranslocoService) {}

  ngOnInit(): void {
    // Restore last language (manual persist kept even if plugin is added later)
    const saved =
      (localStorage.getItem("translocoLang") as "en" | "fr") ?? null;
    const initial =
      saved ?? ((this.transloco.getActiveLang() as "en" | "fr") || "en");

    if (initial !== this.transloco.getActiveLang()) {
      this.transloco.setActiveLang(initial);
    }
    this.active.set(initial);
    document.documentElement.setAttribute("lang", initial);

    this.sub = this.transloco.langChanges$.subscribe((l) => {
      this.active.set(l as "en" | "fr");
      document.documentElement.setAttribute("lang", l);
      localStorage.setItem("translocoLang", l);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe?.();
  }

  /** Toggle language regardless of which button is clicked. */
  toggle(): void {
    const next = this.active() === "en" ? "fr" : "en";
    this.transloco.setActiveLang(next);
  }
}
