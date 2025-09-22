import { Component, ViewChild } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { EnsureVisibleDirective } from "./ensure-visible.directive";

@Component({
  standalone: true,
  imports: [EnsureVisibleDirective],
  template: `
    <div
      id="host"
      [ensureVisible]="flag"
      [evTopMargin]="top"
      [evBottomPad]="pad"
      [evBottomSafe]="safe"
      [evKeyboardAware]="kbd"
      [evRetries]="retries"
    ></div>
  `,
})
class HostCmp {
  @ViewChild(EnsureVisibleDirective) dir!: EnsureVisibleDirective;
  flag = false;
  top = 8;
  pad = 72;
  safe = 0;
  kbd = true;
  retries: readonly number[] = [0];
}

describe("EnsureVisibleDirective", () => {
  let hostEl: HTMLElement;
  let scrollIntoViewSpy: jasmine.Spy;
  let scrollBySpy: jasmine.Spy;

  function withVisualViewport(height: number) {
    const vv: any = {
      height,
      addEventListener: jasmine.createSpy("addEventListener"),
      removeEventListener: jasmine.createSpy("removeEventListener"),
    };
    (window as any).visualViewport = vv;
    return vv;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostCmp] });
  });

  afterEach(() => {
    delete (window as any).visualViewport;
  });

  it("scrolls into view and adjusts window with keyboard-aware bottom budget", fakeAsync(() => {
    (window as any).innerHeight = 800;
    const vv = withVisualViewport(600);

    const f = TestBed.createComponent(HostCmp);
    f.detectChanges();
    hostEl = f.nativeElement.querySelector("#host") as HTMLElement;

    scrollIntoViewSpy = spyOn(hostEl, "scrollIntoView").and.callThrough();
    scrollBySpy = spyOn(window as any, "scrollBy").and.stub();
    spyOn(hostEl, "getBoundingClientRect").and.returnValue({
      top: 750,
      bottom: 1000,
    } as any);

    // ajuster inputs via host
    f.componentInstance.top = 10;
    f.componentInstance.pad = 50;
    f.componentInstance.safe = 20;
    f.componentInstance.kbd = true;
    f.componentInstance.retries = [0];
    f.componentInstance.flag = true;
    f.detectChanges();

    tick(); // run timeout(0)

    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollBySpy).toHaveBeenCalledWith({ top: 670, behavior: "smooth" });

    expect(vv.addEventListener).toHaveBeenCalled();
    tick(2400);
    expect(vv.removeEventListener).toHaveBeenCalled();
  }));

  it("no-op when element already fully visible (no scrollBy)", fakeAsync(() => {
    (window as any).innerHeight = 800;
    withVisualViewport(800);

    const f = TestBed.createComponent(HostCmp);
    f.detectChanges();
    hostEl = f.nativeElement.querySelector("#host") as HTMLElement;

    scrollIntoViewSpy = spyOn(hostEl, "scrollIntoView").and.callThrough();
    const sb = spyOn(window as any, "scrollBy").and.stub();
    spyOn(hostEl, "getBoundingClientRect").and.returnValue({
      top: 20,
      bottom: 400,
    } as any);

    f.componentInstance.top = 10;
    f.componentInstance.pad = 20;
    f.componentInstance.safe = 0;
    f.componentInstance.retries = [0];
    f.componentInstance.flag = true;
    f.detectChanges();

    tick();

    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(sb).not.toHaveBeenCalled();
  }));
});
