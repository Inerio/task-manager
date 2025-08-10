import { Injectable, computed, signal } from "@angular/core";
import { Observable, finalize, firstValueFrom } from "rxjs";

/**
 * Global loading manager with a reference counter.
 * - isLoading() becomes true if ≥1 operation is active.
 * - show() returns a disposer to be called when finished.
 * - wrap()/wrap$() helpers to instrument Promises/Observables.
 */
@Injectable({ providedIn: "root" })
export class LoadingService {
  private readonly _active = signal(0);
  readonly isLoading = computed(() => this._active() > 0);

  /** Manually start/stop a loading scope. */
  show(): () => void {
    this._active.update((n) => n + 1);
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      this._active.update((n) => Math.max(0, n - 1));
    };
  }

  /** Wrap a Promise and auto-toggle the spinner. */
  async wrap<T>(op: Promise<T>): Promise<T> {
    const done = this.show();
    try {
      return await op;
    } finally {
      done();
    }
  }

  /** Wrap an Observable and auto-toggle the spinner. */
  wrap$<T>(obs$: Observable<T>): Observable<T> {
    const done = this.show();
    return obs$.pipe(finalize(done));
  }

  /** Convenience for Observable -> Promise with spinner. */
  async toPromiseWithLoading<T>(obs$: Observable<T>): Promise<T> {
    return this.wrap(firstValueFrom(obs$));
  }
}
