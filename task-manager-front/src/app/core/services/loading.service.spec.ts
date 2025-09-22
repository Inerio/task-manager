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

  it("show()/closer toggles global isLoading with ref counting", () => {
    expect(svc.isLoading()).toBeFalse();

    const close1 = svc.show();
    const close2 = svc.show();
    expect(svc.isLoading()).toBeTrue();

    close1();
    expect(svc.isLoading()).toBeTrue();

    close2();
    expect(svc.isLoading()).toBeFalse();
  });

  it("scoped counters are independent and do not affect global isLoading", () => {
    const scopeA = svc.isLoadingScope("board");
    const scopeB = svc.isLoadingScope("task");

    expect(scopeA()).toBeFalse();
    expect(scopeB()).toBeFalse();
    expect(svc.isLoading()).toBeFalse();

    const doneA1 = svc.show("board");
    const doneA2 = svc.show("board");
    const doneB = svc.show("task");

    expect(scopeA()).toBeTrue();
    expect(scopeB()).toBeTrue();
    // Global flag in this implementation reflects only the global counter:
    expect(svc.isLoading()).toBeFalse();

    doneA1();
    expect(scopeA()).toBeTrue();

    doneA2();
    expect(scopeA()).toBeFalse();

    doneB();
    expect(scopeB()).toBeFalse();
  });

  it("wrap<T>(Promise) toggles during the promise and closes on resolve", async () => {
    expect(svc.isLoading()).toBeFalse();
    const result = await svc.wrap(Promise.resolve(123));
    expect(result).toBe(123);
    expect(svc.isLoading()).toBeFalse();
  });

  it("wrap<T>(Promise) toggles and closes on reject", async () => {
    expect(svc.isLoading()).toBeFalse();
    await expectAsync(
      svc.wrap(Promise.reject(new Error("boom")))
    ).toBeRejectedWithError("boom");
    expect(svc.isLoading()).toBeFalse();
  });

  it("wrap$<T>(Observable) toggles for the subscription lifetime (complete)", fakeAsync(() => {
    const L = svc.isLoadingScope("io");
    const obs$ = svc.wrap$(of(1).pipe(delay(50)), "io");

    expect(L()).toBeFalse(); // not subscribed yet
    obs$.subscribe(); // subscribing turns it on
    expect(L()).toBeTrue();

    tick(50); // completion turns it off
    expect(L()).toBeFalse();
  }));

  it("wrap$ toggles and closes on error as well (async error)", fakeAsync(() => {
    const L = svc.isLoadingScope("err");
    // Make the error asynchronous so we can observe the 'true' state after subscribe
    const obs$ = svc.wrap$(
      timer(0).pipe(mergeMap(() => throwError(() => new Error("x")))),
      "err"
    );

    obs$.subscribe({ error: () => {} });
    expect(L()).toBeTrue();

    tick();
    expect(L()).toBeFalse();
  }));

  it("toPromiseWithLoading wraps an observable into a promise with scope", fakeAsync(() => {
    const L = svc.isLoadingScope("net");
    const p = svc.toPromiseWithLoading(timer(30).pipe(map(() => 7)), "net");

    expect(L()).toBeTrue();

    tick(30);
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
