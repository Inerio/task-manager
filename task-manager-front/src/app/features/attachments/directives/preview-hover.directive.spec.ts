import { Component } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { PreviewHoverDirective } from "./preview-hover.directive";
import { AttachmentPreviewService } from "../data/attachment-preview.service";

const previewStub: Partial<AttachmentPreviewService> = {
  get: (taskId: number, name: string) =>
    Promise.resolve(`blob:${taskId}/${name}`),
};

@Component({
  standalone: true,
  imports: [PreviewHoverDirective],
  template: `
    <button
      appPreviewHover
      [phTaskId]="1"
      [phFilename]="fname"
      (phShow)="show = $event"
      (phMove)="move = $event"
      (phHide)="hide = true"
    >
      tag
    </button>
  `,
})
class HostCmp {
  fname = "pic.png";
  show: any = null;
  move: any = null;
  hide = false;
}

describe("PreviewHoverDirective", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostCmp],
      providers: [{ provide: AttachmentPreviewService, useValue: previewStub }],
    });
  });

  it("desktop hover: shows on mouseenter, moves on mousemove, hides on mouseleave", async () => {
    const f = TestBed.createComponent(HostCmp);
    f.detectChanges();
    const btn: HTMLElement = f.nativeElement.querySelector("button");

    btn.dispatchEvent(
      new MouseEvent("mouseenter", { clientX: 10, clientY: 20, bubbles: true })
    );
    await Promise.resolve();
    expect(f.componentInstance.show?.url).toContain("blob:1/pic.png");

    btn.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 30, clientY: 40, bubbles: true })
    );
    expect(f.componentInstance.move).toEqual({ x: 48, y: 54 });

    btn.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(f.componentInstance.hide).toBeTrue();
  });

  it("mobile long-press: shows after press, moves while active, hides on release, suppress click", fakeAsync(() => {
    const f = TestBed.createComponent(HostCmp);
    f.detectChanges();
    const btn: HTMLElement = f.nativeElement.querySelector("button");

    btn.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerType: "touch",
        pointerId: 1,
        clientX: 5,
        clientY: 6,
        bubbles: true,
      })
    );
    tick(351);
    expect(f.componentInstance.show?.url).toContain("blob:1/pic.png");

    btn.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerType: "touch",
        pointerId: 1,
        clientX: 15,
        clientY: 16,
        bubbles: true,
      })
    );
    expect(f.componentInstance.move).toEqual({ x: 33, y: 30 });

    btn.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerType: "touch",
        pointerId: 1,
        bubbles: true,
      })
    );
    expect(f.componentInstance.hide).toBeTrue();

    let clicked = false;
    btn.addEventListener("click", () => (clicked = true));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicked).toBeFalse();
  }));

  it("ignores non-image filenames", async () => {
    const f = TestBed.createComponent(HostCmp);
    f.componentInstance.fname = "doc.pdf";
    f.detectChanges();
    const btn: HTMLElement = f.nativeElement.querySelector("button");

    btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await Promise.resolve();
    expect(f.componentInstance.show).toBeNull();
  });
});
