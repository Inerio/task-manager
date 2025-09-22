import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { TaskDndDirective } from "./task-dnd.directive";
import { TaskDndService } from "../data/task-dnd.service";

@Component({
  standalone: true,
  imports: [TaskDndDirective],
  template: `
    <div
      appTaskDnd
      [appTaskDndTaskId]="taskId"
      [appTaskDndColumnId]="columnId"
      [appTaskDndDisabled]="disabled"
      (taskDraggingChange)="dragging = $event"
      (taskPreviewSize)="size = $event"
    >
      Card
    </div>
  `,
})
class HostCmp {
  taskId = 1;
  columnId = 10;
  disabled = false;
  dragging = false;
  size: { width: number; height: number } | null = null;
}

function withDT(ev: Event, dt: any) {
  Object.defineProperty(ev, "dataTransfer", { value: dt, configurable: true });
}

describe("TaskDndDirective", () => {
  let startSpy: jasmine.Spy;
  let endSpy: jasmine.Spy;

  beforeEach(() => {
    startSpy = jasmine.createSpy("start");
    endSpy = jasmine.createSpy("end");
    TestBed.configureTestingModule({
      imports: [HostCmp],
      providers: [
        { provide: TaskDndService, useValue: { start: startSpy, end: endSpy } },
      ],
    });
  });

  it("starts drag when dragstart fires and ids are present", () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector("div") as HTMLDivElement;

    const dt = { setData: () => {}, effectAllowed: "" };
    const ev = new DragEvent("dragstart", { bubbles: true });
    withDT(ev, dt);
    el.dispatchEvent(ev);
    fixture.detectChanges();

    expect(startSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.dragging).toBeTrue();

    el.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    fixture.detectChanges();
    expect(endSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.dragging).toBeFalse();
  });

  it("prevents drag when disabled, ghost, or ids missing", () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector("div") as HTMLDivElement;
    const ev = new DragEvent("dragstart", { bubbles: true });
    const prevent = spyOn(ev, "preventDefault").and.callThrough();
    withDT(ev, null);
    el.dispatchEvent(ev);

    expect(prevent).toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("blocks drag when data-preview-lock='1' present", () => {
    const fixture = TestBed.createComponent(HostCmp);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector("div") as HTMLDivElement;
    el.setAttribute("data-preview-lock", "1");

    const ev = new DragEvent("dragstart", { bubbles: true });
    const prevent = spyOn(ev, "preventDefault").and.callThrough();
    withDT(ev, null);
    el.dispatchEvent(ev);

    expect(prevent).toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });
});
