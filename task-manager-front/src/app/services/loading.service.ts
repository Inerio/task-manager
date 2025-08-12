import {
  Injectable,
  computed,
  signal,
  type Signal,
  type WritableSignal,
} from "@angular/core";
import { Observable, finalize, firstValueFrom } from "rxjs";

/**
 * Global + scoped loading manager with reference counters.
 * - isLoading() -> global spinner (backward compatible)
 * - isLoadingScope(key) -> spinner for a specific area (e.g. "board")
 * - show()/wrap()/wrap$ now accept an optional 'scope' to toggle only that area.
 */
@Injectable({ providedIn: "root" })
export class LoadingService {
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

  /** Manually start/stop a loading scope (global if scope not provided). */
  show(scope?: string): () => void {
    if (!scope) {
      this._active.update((n) => n + 1);
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        this._active.update((n) => Math.max(0, n - 1));
      };
    }

    const scoped = this.getScopeCounter(scope);
    scoped.update((n) => n + 1);
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      scoped.update((n) => Math.max(0, n - 1));
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

  /** Wrap an Observable and auto-toggle the spinner (global or scoped). */
  wrap$<T>(obs$: Observable<T>, scope?: string): Observable<T> {
    const done = this.show(scope);
    return obs$.pipe(finalize(done));
  }

  /** Convenience for Observable -> Promise with spinner (global or scoped). */
  async toPromiseWithLoading<T>(
    obs$: Observable<T>,
    scope?: string
  ): Promise<T> {
    return this.wrap(firstValueFrom(obs$), scope);
  }
}
