import { TruncateSmartPipe } from "./truncate-smart.pipe";

describe("TruncateSmartPipe", () => {
  let pipe: TruncateSmartPipe;

  beforeEach(() => {
    pipe = new TruncateSmartPipe();
  });

  it("returns empty string for null/undefined when not expanded", () => {
    expect(pipe.transform(null as any, false, 10)).toBe("");
    expect(pipe.transform(undefined as any, false, 10)).toBe("");
  });

  it("returns original value when expanded", () => {
    expect(pipe.transform("hello world", true, 5)).toBe("hello world");
  });

  it("returns original value when maxLen is zero or large enough", () => {
    expect(pipe.transform("abc", false, 0)).toBe("abc");
    expect(pipe.transform("abc", false, 3)).toBe("abc");
  });

  it("truncates and appends ellipsis when needed", () => {
    expect(pipe.transform("abcdef", false, 4)).toBe("abcd…");
  });

  it("handles multi-byte characters correctly", () => {
    const s = "ééééé";
    expect(pipe.transform(s, false, 3)).toBe("ééé…");
  });
});
