import { Component, ViewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ClampToRowsDirective } from "./clamp-to-rows.directive";

@Component({
  standalone: true,
  imports: [ClampToRowsDirective],
  template: `
    <div
      appClampToRows="2"
      [appClampExpanded]="expanded"
      (appClampNeedsToggle)="needs = $event"
      (appClampHeight)="h = $event"
    >
      <div class="attachment-tags">
        <span class="attachment-tag">A</span>
        <span class="attachment-tag">B</span>
        <span class="attachment-tag">C</span>
        <span class="attachment-tag">D</span>
      </div>
    </div>
  `,
})
class HostCmp {
  @ViewChild(ClampToRowsDirective) dir!: ClampToRowsDirective;
  expanded = false;
  needs = false;
  h = 0;
}

describe("ClampToRowsDirective", () => {
  beforeEach(() => {
    spyOn(window, "getComputedStyle").and.callFake((el: any) => {
      return { rowGap: "8px", gap: "8px" } as any;
    });
  });

  it("computes collapsed height and emits toggle need", () => {
    const f = TestBed.configureTestingModule({
      imports: [HostCmp],
    }).createComponent(HostCmp);
    f.detectChanges();
    const host: HTMLElement = f.nativeElement.querySelector("[appClampToRows]");
    const anyTag = host.querySelector(".attachment-tag") as HTMLElement;

    spyOn(anyTag, "getBoundingClientRect").and.returnValue({
      height: 20,
    } as any);

    Object.defineProperty(host, "scrollHeight", {
      configurable: true,
      value: 1000,
    });

    f.componentInstance.dir.recompute();
    f.detectChanges();

    // collapsed height = rows*20 + gap -> 2*20 + 8 - 1 = 47px
    expect(f.componentInstance.h).toBe(47);
    expect(f.componentInstance.needs).toBeTrue();
    expect(f.componentInstance.dir["maxHeight"]).toBe(47);

    f.componentInstance.expanded = true;
    f.detectChanges();
    expect(f.componentInstance.dir["maxHeight"]).toBeNull();
  });
});
