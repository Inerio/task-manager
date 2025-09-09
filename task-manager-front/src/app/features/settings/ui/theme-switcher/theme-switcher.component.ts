import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";

type Theme = "light" | "dark";

/**
 * Theme Switcher
 * - Toggles [data-theme] on <html> to avoid FOUC.
 * - Persists to localStorage.
 * - Respects prefers-color-scheme (inline script may set data-theme early).
 * - Syncs across tabs via "storage" event.
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
  /** LocalStorage key for theme persistence. */
  private readonly LS_KEY = "appTheme";

  /** Current theme as a signal. */
  readonly active = signal<Theme>("light");

  /** Keep tabs in sync (no reassign). */
  private readonly onStorage = (e: StorageEvent) => {
    if (
      e.key === this.LS_KEY &&
      (e.newValue === "light" || e.newValue === "dark")
    ) {
      this.setTheme(e.newValue as Theme, /*persist*/ false);
    }
  };

  ngOnInit(): void {
    // Initialize from: LS -> existing [data-theme] -> fallback
    const saved = (localStorage.getItem(this.LS_KEY) as Theme | null) ?? null;
    const fromAttr =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      null;
    const initial: Theme = saved ?? fromAttr ?? "light";
    this.setTheme(initial, false);
    window.addEventListener("storage", this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener("storage", this.onStorage);
  }

  /** Toggle between light/dark. */
  toggle(): void {
    const next: Theme = this.active() === "light" ? "dark" : "light";
    this.setTheme(next, true);
  }

  /** Apply theme to <html> and optionally persist. */
  private setTheme(theme: Theme, persist: boolean): void {
    this.active.set(theme);
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) localStorage.setItem(this.LS_KEY, theme);
  }

  /** Convenience flags for template. */
  readonly isLight = computed(() => this.active() === "light");
  readonly isDark = computed(() => this.active() === "dark");
}
