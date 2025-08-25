import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";

type Theme = "light" | "dark";

/**
 * Theme Switcher
 * - Toggles [data-theme] on <html> to avoid FOUC.
 * - Persists to localStorage.
 * - Respects prefers-color-scheme on first load (index.html inline script).
 * - Listens to 'storage' so multiple tabs stay in sync.
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
  private readonly LS_KEY = "appTheme";
  readonly active = signal<Theme>("light");

  private onStorage = (e: StorageEvent) => {
    if (
      e.key === this.LS_KEY &&
      (e.newValue === "light" || e.newValue === "dark")
    ) {
      this.setTheme(e.newValue as Theme, /*persist*/ false);
    }
  };

  ngOnInit(): void {
    const saved = (localStorage.getItem(this.LS_KEY) as Theme) || "light";
    this.setTheme(saved, false);
    window.addEventListener("storage", this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener("storage", this.onStorage);
  }

  toggle(): void {
    const next: Theme = this.active() === "light" ? "dark" : "light";
    this.setTheme(next, true);
  }

  private setTheme(theme: Theme, persist: boolean): void {
    this.active.set(theme);
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) localStorage.setItem(this.LS_KEY, theme);
  }

  isLight = computed(() => this.active() === "light");
  isDark = computed(() => this.active() === "dark");
}
