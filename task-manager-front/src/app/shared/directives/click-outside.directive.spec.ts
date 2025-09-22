import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ClickOutsideDirective } from "./click-outside.directive";

@Component({
  standalone: true,
  imports: [ClickOutsideDirective],
  template: `
    <div appClickOutside [coIgnore]="ignore" (clickOutside)="fired = true">
      inside
    </div>
    <div class="portal">portal</div>
  `,
})
class HostCmp {
  fired = false;
  ignore: string | string[] | null = null;
}

describe("ClickOutsideDirective", () => {
  it("emits when click is outside, ignores inside", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostCmp],
    }).createComponent(HostCmp);
    fixture.detectChanges();
    const host: HTMLElement =
      fixture.nativeElement.querySelector("[appClickOutside]");
    const portal: HTMLElement = fixture.nativeElement.querySelector(".portal");

    host.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(fixture.componentInstance.fired).toBeFalse();

    document.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        view: window,
        relatedTarget: portal,
      })
    );
    Object.defineProperty(Event.prototype, "target", {
      value: portal,
      configurable: true,
    });
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(fixture.componentInstance.fired).toBeTrue();
  });

  it("respects coIgnore selectors", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostCmp],
    }).createComponent(HostCmp);
    fixture.componentInstance.ignore = ".portal";
    fixture.detectChanges();

    const portal: HTMLElement = fixture.nativeElement.querySelector(".portal");
    Object.defineProperty(Event.prototype, "target", {
      value: portal,
      configurable: true,
    });
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(fixture.componentInstance.fired).toBeFalse();
  });
});
