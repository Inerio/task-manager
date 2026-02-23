import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { LoadingService } from "./loading.service";
import { of, throwError, timer } from "rxjs";
import { delay, map, mergeMap } from "rxjs/operators";

describe("LoadingService (global + scoped)", () => {
  let svc: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(LoadingService);
  });

  it("show()/closer toggles global isLoading after delay", fakeAsync(() => {
    expect(svc.isLoading()).toBeFalse();

    const close1 = svc.show();
    const close2 = svc.show();
    expect(svc.isLoading()).toBeFalse(); // not yet — delay pending

    tick(300);
    expect(svc.isLoading()).toBeTrue();

    close1();
    expect(svc.isLoading()).toBeTrue(); // still one active

    close2();
    expect(svc.isLoading()).toBeFalse();
  }));

  it("show() does not activate if closed before delay", fakeAsync(() => {
    const close = svc.show();
    expect(svc.isLoading()).toBeFalse();

    close(); // closed before 300ms
    tick(300);
    expect(svc.isLoading()).toBeFalse(); // never activated
  }));

  it("scoped counters are independent and do not affect global isLoading", fakeAsync(() => {
    const scopeA = svc.isLoadingScope("board");
    const scopeB = svc.isLoadingScope("task");

    expect(scopeA()).toBeFalse();
    expect(scopeB()).toBeFalse();
    expect(svc.isLoading()).toBeFalse();

    const doneA1 = svc.show("board");
    const doneA2 = svc.show("board");
    const doneB = svc.show("task");

    tick(300);
    expect(scopeA()).toBeTrue();
    expect(scopeB()).toBeTrue();
    // Global flag reflects only the global counter:
    expect(svc.isLoading()).toBeFalse();

    doneA1();
    expect(scopeA()).toBeTrue();

    doneA2();
    expect(scopeA()).toBeFalse();

    doneB();
    expect(scopeB()).toBeFalse();
  }));

  it("wrap<T>(Promise) does not flicker for fast resolves", fakeAsync(() => {
    expect(svc.isLoading()).toBeFalse();
    let result: number | undefined;
    svc.wrap(Promise.resolve(123)).then((v) => (result = v));
    tick(); // microtask resolves instantly
    expect(result).toBe(123);
    tick(300);
    expect(svc.isLoading()).toBeFalse(); // never shown
  }));

  it("wrap<T>(Promise) toggles and closes on reject", fakeAsync(() => {
    expect(svc.isLoading()).toBeFalse();
    let caught = false;
    svc.wrap(Promise.reject(new Error("boom"))).catch(() => (caught = true));
    tick();
    expect(caught).toBeTrue();
    tick(300);
    expect(svc.isLoading()).toBeFalse();
  }));

  it("wrap$<T>(Observable) toggles for the subscription lifetime after delay", fakeAsync(() => {
    const L = svc.isLoadingScope("io");
    const obs$ = svc.wrap$(of(1).pipe(delay(500)), "io");

    expect(L()).toBeFalse(); // not subscribed yet
    obs$.subscribe();
    expect(L()).toBeFalse(); // subscribed but delay not reached

    tick(300);
    expect(L()).toBeTrue(); // delay passed, observable still pending

    tick(200); // total 500ms — observable completes
    expect(L()).toBeFalse();
  }));

  it("wrap$ does not flicker for fast observables", fakeAsync(() => {
    const L = svc.isLoadingScope("fast");
    const obs$ = svc.wrap$(of(42).pipe(delay(50)), "fast");

    obs$.subscribe();
    tick(50); // completes before 300ms delay
    expect(L()).toBeFalse();

    tick(300); // ensure no delayed activation
    expect(L()).toBeFalse();
  }));

  it("wrap$ toggles and closes on error as well (async error)", fakeAsync(() => {
    const L = svc.isLoadingScope("err");
    const obs$ = svc.wrap$(
      timer(500).pipe(mergeMap(() => throwError(() => new Error("x")))),
      "err"
    );

    obs$.subscribe({ error: () => {} });
    tick(300);
    expect(L()).toBeTrue();

    tick(200); // error fires at 500ms
    expect(L()).toBeFalse();
  }));

  it("toPromiseWithLoading wraps an observable into a promise with scope", fakeAsync(() => {
    const L = svc.isLoadingScope("net");
    const p = svc.toPromiseWithLoading(timer(500).pipe(map(() => 7)), "net");

    expect(L()).toBeFalse(); // delay not reached yet
    tick(300);
    expect(L()).toBeTrue();

    tick(200); // total 500ms
    awaitExpect(p, 7);
    expect(L()).toBeFalse();
  }));

  // Small helper to assert resolved value inside fakeAsync
  function awaitExpect<T>(promise: Promise<T>, expected: T) {
    (promise as any).__thenHandled = false;
    promise.then((v) => {
      expect(v).toBe(expected);
      (promise as any).__thenHandled = true;
    });
    tick();
    expect((promise as any).__thenHandled).toBeTrue();
  }
});
