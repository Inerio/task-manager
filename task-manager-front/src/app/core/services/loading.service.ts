import {
  Injectable,
  computed,
  signal,
  type Signal,
  type WritableSignal,
} from "@angular/core";
import { Observable, finalize, firstValueFrom, defer } from "rxjs";

/**
 * Global + scoped loading manager with reference counters.
 * - isLoading() -> global spinner (backward compatible)
 * - isLoadingScope(key) -> spinner for a specific area (e.g. "board")
 * - show()/wrap()/wrap$ accept an optional 'scope' to toggle only that area.
 *
 * A built-in delay prevents the spinner from appearing on fast operations
 * (< DELAY_MS). This avoids flickering on quick network round-trips.
 */
@Injectable({ providedIn: "root" })
export class LoadingService {
  /** Minimum time (ms) before the spinner becomes visible. */
  private static readonly DELAY_MS = 300;

  // --- Global counter (back-compat) ---
  private readonly _active = signal(0);
  readonly isLoading = computed(() => this._active() > 0);

  // --- Scoped counters ---
  private readonly _scopeCounters = new Map<string, WritableSignal<number>>();

  private getScopeCounter(scope: string): WritableSignal<number> {
    let c = this._scopeCounters.get(scope);
    if (!c) {
      c = signal(0);
      this._scopeCounters.set(scope, c);
    }
    return c;
  }

  /** Reactive boolean for a given scope. */
  isLoadingScope(scope: string): Signal<boolean> {
    const counter = this.getScopeCounter(scope);
    return computed(() => counter() > 0);
  }

  /**
   * Manually start/stop a loading scope (global if scope not provided).
   * The spinner only appears after DELAY_MS. If closed before the delay,
   * the counter is never incremented — no flicker.
   */
  show(scope?: string): () => void {
    const counter: WritableSignal<number> = scope
      ? this.getScopeCounter(scope)
      : this._active;

    let closed = false;
    let activated = false;

    const timer = setTimeout(() => {
      if (!closed) {
        counter.update((n) => n + 1);
        activated = true;
      }
    }, LoadingService.DELAY_MS);

    return () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (activated) {
        counter.update((n) => Math.max(0, n - 1));
      }
    };
  }

  /** Wrap a Promise and auto-toggle the spinner (global or scoped). */
  async wrap<T>(op: Promise<T>, scope?: string): Promise<T> {
    const done = this.show(scope);
    try {
      return await op;
    } finally {
      done();
    }
  }

  /**
   * Wrap an Observable and auto-toggle the spinner (global or scoped).
   * Loading starts **on subscribe**, not on wrap$ call.
   */
  wrap$<T>(obs$: Observable<T>, scope?: string): Observable<T> {
    return defer(() => {
      const done = this.show(scope);
      return obs$.pipe(finalize(done));
    });
  }

  /** Convenience for Observable -> Promise with spinner (global or scoped). */
  async toPromiseWithLoading<T>(
    obs$: Observable<T>,
    scope?: string
  ): Promise<T> {
    return firstValueFrom(this.wrap$(obs$, scope));
  }
}
