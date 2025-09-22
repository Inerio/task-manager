import { BoardAutoScroller } from "./board-auto-scroll";

describe("BoardAutoScroller", () => {
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
      clientWidth: { value: 300 },
      scrollWidth: { value: 2000, writable: true },
      scrollLeft: { value: 0, writable: true },
      getBoundingClientRect: {
        value: () => ({ left: 0, right: 300, width: 300 } as any),
      },
    });
    return el as any;
  }

  it("scroll à droite quand le pointeur est proche du bord droit", () => {
    const h = host();
    const s = new BoardAutoScroller();
    s.attachHost(h);
    s.updateFromPointerX(10_000); // très à droite
    expect(h.scrollLeft).toBeGreaterThan(0);
    s.stop();
  });
});
