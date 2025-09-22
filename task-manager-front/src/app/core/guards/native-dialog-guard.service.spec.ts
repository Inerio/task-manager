import { TestBed } from "@angular/core/testing";
import { RendererFactory2 } from "@angular/core";
import { NativeDialogGuardService } from "./native-dialog-guard.service";

describe("NativeDialogGuardService", () => {
  let service: NativeDialogGuardService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NativeDialogGuardService],
    });
    service = TestBed.inject(NativeDialogGuardService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it("should set and read open state", () => {
    expect(service.isOpen()).toBeFalse();
    service.setOpen(true);
    expect(service.isOpen()).toBeTrue();
    service.setOpen(false);
    expect(service.isOpen()).toBeFalse();
  });

  it("should swallow document mouse events when open", () => {
    const called = { value: false };
    const handler = () => (called.value = true);
    document.addEventListener("mousedown", handler);

    // Open -> should swallow
    service.setOpen(true);
    const e1 = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    const preventedBefore = e1.defaultPrevented;
    document.dispatchEvent(e1);

    expect(preventedBefore).toBeFalse();
    expect(e1.defaultPrevented).toBeTrue();
    expect(called.value).toBeFalse();

    // Close -> should not swallow
    service.setOpen(false);
    const e2 = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    called.value = false;
    document.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBeFalse();
    expect(called.value).toBeTrue();

    document.removeEventListener("mousedown", handler);
  });

  it("should swallow Escape keydown when open", () => {
    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    service.setOpen(true);
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBeTrue();
  });

  it("should release guard after window focus with timeout", (done) => {
    service.setOpen(true);
    window.dispatchEvent(new Event("focus"));

    // Use a micro delay to allow setTimeout(0) to run.
    setTimeout(() => {
      expect(service.isOpen()).toBeFalse();
      done();
    }, 0);
  });

  it("ngOnDestroy should remove listeners without throwing", () => {
    const rf = TestBed.inject(RendererFactory2);
    expect(() => service.ngOnDestroy()).not.toThrow();
    document.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
});
