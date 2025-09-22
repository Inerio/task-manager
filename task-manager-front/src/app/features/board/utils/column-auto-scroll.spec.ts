import { ColumnAutoScroller } from "./column-auto-scroll";

describe("ColumnAutoScroller", () => {
  const raf = window.requestAnimationFrame;
  const caf = window.cancelAnimationFrame;

  beforeEach(() => {
    let called = false;
    (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      if (!called) {
        called = true;
        cb(0 as any);
      }
      return 1 as any;
    };
    (window as any).cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    (window as any).requestAnimationFrame = raf;
    (window as any).cancelAnimationFrame = caf;
  });

  function host(): HTMLElement {
    const el = document.createElement("div");
    Object.defineProperties(el, {
      clientHeight: { value: 200 },
      scrollHeight: { value: 1200, writable: true },
      scrollTop: { value: 100, writable: true },
      getBoundingClientRect: {
        value: () => ({ top: 0, bottom: 200 } as any),
      },
    });
    return el as any;
  }

  it("scrolls down when the pointer is near the bottom", () => {
    const h = host();
    const s = new ColumnAutoScroller();
    (s as any).attachHost(h);
    s.updateFromPointerY(10_000);
    expect((h as any).scrollTop).toBeGreaterThan(100);
    s.stop();
  });
});
