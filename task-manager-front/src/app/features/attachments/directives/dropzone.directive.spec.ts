import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { DropzoneDirective } from "./dropzone.directive";

@Component({
  standalone: true,
  imports: [DropzoneDirective],
  template: `<div
    appDropzone
    (dzFiles)="files = $event"
    (dzStateChange)="over = $event"
  ></div>`,
})
class HostCmp {
  files: File[] = [];
  over = false;
}

function withDataTransfer(ev: Event, value: any): void {
  Object.defineProperty(ev, "dataTransfer", { value, configurable: true });
}

describe("DropzoneDirective", () => {
  it("emits dzStateChange on dragover and emits files on drop", () => {
    const f = TestBed.configureTestingModule({
      imports: [HostCmp],
    }).createComponent(HostCmp);
    f.detectChanges();
    const host: HTMLElement = f.nativeElement.querySelector("[appDropzone]");

    const overEv = new DragEvent("dragover", { bubbles: true });
    withDataTransfer(overEv, { types: ["Files"], dropEffect: "" });
    host.dispatchEvent(overEv);
    expect(f.componentInstance.over).toBeTrue();

    const file = new File(["a"], "a.png");
    const dropEv = new DragEvent("drop", { bubbles: true });
    withDataTransfer(dropEv, { types: ["Files"], files: [file] });
    host.dispatchEvent(dropEv);
    expect(f.componentInstance.files.length).toBe(1);
    expect(f.componentInstance.over).toBeFalse();
  });

  it("ignores when disabled", () => {
    @Component({
      standalone: true,
      imports: [DropzoneDirective],
      template: `<div
        appDropzone
        [dzDisabled]="true"
        (dzStateChange)="hit = true"
      ></div>`,
    })
    class Cmp {
      hit = false;
    }

    const f = TestBed.configureTestingModule({
      imports: [Cmp],
    }).createComponent(Cmp);
    f.detectChanges();
    const host: HTMLElement = f.nativeElement.querySelector("[appDropzone]");

    const ev = new DragEvent("dragover", { bubbles: true });
    withDataTransfer(ev, { types: ["Files"] });
    host.dispatchEvent(ev);
    expect(f.componentInstance.hit).toBeFalse();
  });
});
