import { Component } from "@angular/core";
import { TestBed, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { AutofocusOnInitDirective } from "./autofocus-on-init.directive";

@Component({
  standalone: true,
  imports: [AutofocusOnInitDirective],
  template: `<input appAutofocusOnInit [value]="val" />`,
})
class HostCmp {
  val = "hello";
}

describe("AutofocusOnInitDirective", () => {
  it("focuses input and sets caret at end", fakeAsync(() => {
    spyOn(window, "requestAnimationFrame").and.callFake(
      (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      }
    );

    const fixture = TestBed.configureTestingModule({
      imports: [HostCmp],
    }).createComponent(HostCmp);
    fixture.detectChanges();

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector("input");
    spyOn(input, "focus").and.callThrough();
    spyOn(input, "setSelectionRange").and.callThrough();

    // run microtasks queued by directive
    flushMicrotasks();

    expect(input.focus).toHaveBeenCalled();
    expect(input.setSelectionRange).toHaveBeenCalledWith(5, 5);
  }));
});
