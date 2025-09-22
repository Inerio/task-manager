import { TestBed } from "@angular/core/testing";
import { AttachmentPickerService } from "./attachment-picker.service";

describe("AttachmentPickerService", () => {
  let service: AttachmentPickerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AttachmentPickerService],
    });
    service = TestBed.inject(AttachmentPickerService);
  });

  afterEach(() => {
    delete (window as any).showOpenFilePicker;
  });

  function mkFile(name: string, type = "text/plain"): File {
    return new File(["x"], name, { type });
  }

  it("prefers File System Access API when available", async () => {
    const f1 = mkFile("a.txt");
    const f2 = mkFile("b.txt");

    const handle = (f: File) => ({ getFile: () => Promise.resolve(f) });
    (window as any).showOpenFilePicker = jasmine
      .createSpy("showOpenFilePicker")
      .and.resolveTo([handle(f1), handle(f2)]);

    const before = jasmine.createSpy("beforeOpen");
    const after = jasmine.createSpy("afterClose");

    const out = await service.pick({ beforeOpen: before, afterClose: after });

    expect((window as any).showOpenFilePicker).toHaveBeenCalledOnceWith({
      multiple: true,
      excludeAcceptAllOption: false,
    });
    expect(out.map((f) => f.name)).toEqual(["a.txt", "b.txt"]);
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("falls back to caller-provided hidden input when FS API is not available", async () => {
    delete (window as any).showOpenFilePicker;
    const before = jasmine.createSpy("beforeOpen");
    const after = jasmine.createSpy("afterClose");

    const out = await service.pick({
      beforeOpen: before,
      afterClose: after,
      openWithInput: async () => [mkFile("c.png", "image/png")],
    });

    expect(out.map((f) => f.name)).toEqual(["c.png"]);
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("returns [] if no API available and no fallback provided", async () => {
    delete (window as any).showOpenFilePicker;
    const out = await service.pick({});
    expect(out).toEqual([]);
  });
});
