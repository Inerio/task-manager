import { TemplatePickerService } from "./template-picker.service";

describe("TemplatePickerService (signals only)", () => {
  let svc: TemplatePickerService;

  beforeEach(() => {
    svc = new TemplatePickerService();
  });

  it("open(): sets visible and returns a promise", async () => {
    const p = svc.open();
    expect(svc.state().visible).toBeTrue();

    // Close by skipping
    svc.skip();
    const result = await p;
    expect(result).toBeNull();
    expect(svc.state().visible).toBeFalse();
  });

  it("choose(): resolves promise with selected id", async () => {
    const p = svc.open();
    expect(svc.state().visible).toBeTrue();

    svc.choose("any-template" as any);

    const result = await p;
    expect(result).toBe("any-template" as any);
    expect(svc.state().visible).toBeFalse();
  });

  it("open() twice: first promise resolves to null", async () => {
    const p1 = svc.open();
    const p2 = svc.open();

    const r1 = await p1;
    expect(r1).toBeNull();
    expect(svc.state().visible).toBeTrue();

    svc.skip();
    const r2 = await p2;
    expect(r2).toBeNull();
    expect(svc.state().visible).toBeFalse();
  });

  it("skip() when not visible: no throw and no state change", () => {
    expect(svc.state().visible).toBeFalse();
    expect(() => svc.skip()).not.toThrow();
    expect(svc.state().visible).toBeFalse();
  });
});
