import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { AlertService } from "./alert.service";

describe("AlertService (toast stack)", () => {
  let svc: AlertService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlertService);
  });

  it("show() pushes a toast and auto-dismisses after default timeout", fakeAsync(() => {
    expect(svc.alerts().length).toBe(0);

    svc.show("error", "attachments.errors.upload"); // default 3500ms
    expect(svc.alerts().length).toBe(1);
    const firstId = svc.alerts()[0].id;

    // Still present before timeout
    tick(3499);
    expect(svc.alerts().some((a) => a.id === firstId)).toBeTrue();

    // After timeout -> auto-dismissed
    tick(1);
    expect(svc.alerts().some((a) => a.id === firstId)).toBeFalse();
  }));

  it("show() with custom duration", fakeAsync(() => {
    svc.show("info", "hello", 100);
    expect(svc.alerts().length).toBe(1);
    tick(100);
    expect(svc.alerts().length).toBe(0);
  }));

  it("dismiss() removes a toast early and clears its timer", fakeAsync(() => {
    svc.show("success", "ok", 1000);
    const id = svc.alerts()[0].id;

    // Dismiss before timeout
    svc.dismiss(id);
    expect(svc.alerts().length).toBe(0);

    // Advance time — should not reappear nor throw
    tick(2000);
    expect(svc.alerts().length).toBe(0);
  }));

  it("clearAll() removes all toasts and cancels timers", fakeAsync(() => {
    svc.show("info", "a", 1000);
    svc.show("error", "b", 1000);
    expect(svc.alerts().length).toBe(2);

    svc.clearAll();
    expect(svc.alerts().length).toBe(0);

    tick(2000);
    expect(svc.alerts().length).toBe(0);
  }));
});
