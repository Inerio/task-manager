import { Component, ViewChild } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { ToggleTruncateDirective } from "./toggle-truncate.directive";
import { TranslocoService } from "@jsverse/transloco";

@Component({
  standalone: true,
  imports: [ToggleTruncateDirective],
  template: `<div
    appToggleTruncate
    [ttContent]="content"
    [ttMaxLen]="len"
    [ttMode]="mode"
  ></div>`,
})
class HostCmp {
  @ViewChild(ToggleTruncateDirective) dir!: ToggleTruncateDirective;
  content = "hello";
  len = 3;
  mode: "length" | "overflow" = "length";
}

describe("ToggleTruncateDirective", () => {
  const i18nStub = { translate: (k: string) => k };

  beforeEach(() => {
    spyOn(window, "requestAnimationFrame").and.callFake(
      (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      }
    );
    TestBed.configureTestingModule({
      imports: [HostCmp],
      providers: [{ provide: TranslocoService, useValue: i18nStub }],
    });
  });

  it("length mode: toggles expansion only if content exceeds max length", () => {
    const f = TestBed.createComponent(HostCmp);
    f.detectChanges();
    const host = f.nativeElement.querySelector("div") as HTMLDivElement;
    const dir = f.componentInstance.dir;

    host.click();
    f.detectChanges();
    expect(dir.expanded).toBeTrue();

    f.componentInstance.content = "ok";
    f.detectChanges();
    expect(dir.expanded).toBeFalse();
  });

  it("overflow mode: measures overflow and toggles collapsed class", fakeAsync(() => {
    const f = TestBed.createComponent(HostCmp);
    f.componentInstance.mode = "overflow";
    f.detectChanges();

    const host = f.nativeElement.querySelector("div") as HTMLDivElement;
    const dir = f.componentInstance.dir;

    Object.defineProperty(host, "scrollHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(host, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(host, "scrollWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(host, "clientWidth", {
      configurable: true,
      value: 100,
    });

    window.dispatchEvent(new Event("resize"));
    tick(50);
    f.detectChanges();

    expect(host.classList.contains("truncated")).toBeTrue();
    expect(host.classList.contains("is-overflowing")).toBeTrue();

    host.click();
    f.detectChanges();
    expect(dir.expanded).toBeTrue();
  }));
});
