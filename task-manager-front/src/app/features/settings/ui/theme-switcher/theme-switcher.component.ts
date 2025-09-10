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
 * - Toggle anywhere in the control (container click / Enter / Space).
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
    // Initialize from: LS -> existing [data-theme] -> prefers-color-scheme -> fallback
    const saved = (localStorage.getItem(this.LS_KEY) as Theme | null) ?? null;
    const fromAttr =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      null;
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initial: Theme =
      saved ?? fromAttr ?? (prefersDark ? "dark" : "light");

    this.setTheme(initial, false);
    window.addEventListener("storage", this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener("storage", this.onStorage);
  }

  /** Explicitly select the requested theme (no ambiguous toggle). */
  select(theme: Theme): void {
    if (theme === this.active()) return;
    this.setTheme(theme, true);
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

  /** Toggle helper used by container + buttons. */
  toggle(): void {
    const next: Theme = this.active() === "light" ? "dark" : "light";
    this.setTheme(next, true);
  }

  /** Keyboard support on the wrapper (Enter/Space). */
  onWrapperKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.toggle();
    }
  }
}
