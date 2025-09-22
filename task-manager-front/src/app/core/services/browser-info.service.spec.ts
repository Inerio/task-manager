import { TestBed } from "@angular/core/testing";
import { BrowserInfoService } from "./browser-info.service";

describe("BrowserInfoService (isBrave detection)", () => {
  let svc: BrowserInfoService;

  // Helpers to patch/restore navigator fields safely
  const saveDesc = <K extends keyof Navigator>(key: K) =>
    Object.getOwnPropertyDescriptor(Navigator.prototype, key);

  const setNavProp = (key: keyof Navigator, value: any) => {
    Object.defineProperty(Navigator.prototype, key, {
      configurable: true,
      value,
    });
  };

  let origBrave: PropertyDescriptor | undefined;
  let origUAD: PropertyDescriptor | undefined;
  let origUA: PropertyDescriptor | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(BrowserInfoService);

    origBrave = saveDesc("brave" as any);
    origUAD = saveDesc("userAgentData" as any);
    origUA = saveDesc("userAgent");
  });

  afterEach(() => {
    if (origBrave)
      Object.defineProperty(Navigator.prototype, "brave", origBrave);
    else delete (navigator as any).brave;

    if (origUAD)
      Object.defineProperty(Navigator.prototype, "userAgentData", origUAD);
    else delete (navigator as any).userAgentData;

    if (origUA) Object.defineProperty(Navigator.prototype, "userAgent", origUA);
  });

  it("returns true when navigator.brave.isBrave() resolves true and caches the result", async () => {
    let called = 0;
    setNavProp("brave" as any, {
      isBrave: () => {
        called++;
        return Promise.resolve(true);
      },
    });

    const first = await svc.isBrave();
    const second = await svc.isBrave(); // should use cache, not call again

    expect(first).toBeTrue();
    expect(second).toBeTrue();
    expect(called).toBe(1);
  });

  it("falls back to brands (userAgentData) when brave.isBrave is missing", async () => {
    setNavProp("brave" as any, undefined);
    setNavProp("userAgentData" as any, {
      brands: [{ brand: "Chromium" }, { brand: "Brave" }],
    });
    setNavProp(
      "userAgent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Brave/1.0"
    );

    const res = await svc.isBrave();
    expect(res).toBeTrue();
  });

  it("falls back to userAgent substring if brands unavailable", async () => {
    setNavProp("brave" as any, undefined);
    setNavProp("userAgentData" as any, undefined);
    setNavProp("userAgent", "Mozilla/5.0 brave like-string");

    const res = await svc.isBrave();
    expect(res).toBeTrue();
  });

  it("returns false on errors and caches false", async () => {
    // Make brave.isBrave throw to test catch path
    setNavProp("brave" as any, {
      isBrave: () => Promise.reject(new Error("nope")),
    });
    setNavProp("userAgentData" as any, undefined);
    setNavProp("userAgent", "Mozilla/5.0");

    const first = await svc.isBrave();
    expect(first).toBeFalse();

    // Change environment to something that would be true if re-run,
    // but result should be cached as false.
    setNavProp("userAgent", "Mozilla/5.0 Brave/1.0");
    const second = await svc.isBrave();
    expect(second).toBeFalse();
  });
});
