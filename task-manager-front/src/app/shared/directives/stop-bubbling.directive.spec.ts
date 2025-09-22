import { StopBubblingDirective } from "./stop-bubbling.directive";

describe("StopBubblingDirective", () => {
  let dir: StopBubblingDirective;

  beforeEach(() => {
    dir = new StopBubblingDirective();
  });

  function makeEvt(): Event {
    const e = new Event("x", { bubbles: true, cancelable: true });
    spyOn(e, "stopPropagation").and.callThrough();
    spyOn(e, "preventDefault").and.callThrough();
    return e;
  }

  it("stops propagation for mouse/pointer/focus events", () => {
    const evts: Event[] = [
      makeEvt(),
      makeEvt(),
      makeEvt(),
      makeEvt(),
      makeEvt(),
      makeEvt(),
    ];
    dir.onPointerDown(evts[0]);
    dir.onMouseDown(evts[1]);
    dir.onMouseUp(evts[2]);
    dir.onClick(evts[3]);
    dir.onFocusIn(evts[4]);
    dir.onFocusOut(evts[5]);

    for (const e of evts) expect(e.stopPropagation as any).toHaveBeenCalled();
  });

  it("swallows only Escape on keydown", () => {
    const e1 = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    spyOn(e1, "stopPropagation");
    dir.onKeydown(e1);
    expect(e1.stopPropagation).toHaveBeenCalled();

    const e2 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    spyOn(e2, "stopPropagation");
    dir.onKeydown(e2);
    expect(e2.stopPropagation).not.toHaveBeenCalled();
  });
});
