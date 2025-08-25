import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
  inject,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../services/alert.service";

type Theme = "light" | "dark";

/**
 * Simple theme switcher (UI-only for now).
 * - Clicking either button toggles the active theme (like the language switcher UX).
 * - Shows an info alert: "not yet implemented".
 * - Persists the last choice in localStorage (cosmetic).
 */
@Component({
  selector: "app-theme-switcher",
  standalone: true,
  templateUrl: "./theme-switcher.component.html",
  styleUrls: ["./theme-switcher.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class ThemeSwitcherComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(TranslocoService);
  private readonly alert = inject(AlertService);

  readonly active = signal<Theme>("light");

  ngOnInit(): void {
    const saved = (localStorage.getItem("appTheme") as Theme) || "light";
    this.active.set(saved);
  }

  ngOnDestroy(): void {}

  /** Toggle theme on ANY button click to mimic the language switcher UX. */
  toggle(): void {
    const next: Theme = this.active() === "light" ? "dark" : "light";
    this.active.set(next);
    localStorage.setItem("appTheme", next);

    // Inform the user this is UI-only for now.
    this.alert.show("info", this.i18n.translate("theme.notImplemented"));
  }
  isLight = computed(() => this.active() === "light");
  isDark = computed(() => this.active() === "dark");
}
