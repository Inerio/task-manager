import { insertAtCaret } from "./dom-text";

describe("insertAtCaret", () => {
  function mkTextarea(value = ""): HTMLTextAreaElement {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.height = "40px";
    ta.style.overflow = "auto";
    document.body.appendChild(ta);
    return ta;
  }

  afterEach(() => {
    document.querySelectorAll("textarea").forEach((el) => el.remove());
  });

  it("inserts at current selection and places caret after inserted text", () => {
    const ta = mkTextarea("hello world");
    ta.selectionStart = 6;
    ta.selectionEnd = 11;

    insertAtCaret(ta, "Julien");

    expect(ta.value).toBe("hello Julien");
    expect(ta.selectionStart).toBe(6 + "Julien".length);
    expect(ta.selectionEnd).toBe(ta.selectionStart);
  });

  it("preserves scroll position (force fallback path for determinism)", () => {
    const long = Array.from({ length: 200 }, () => "line").join("\n");
    const ta = mkTextarea(long);
    ta.scrollTop = 100;
    ta.selectionStart = ta.selectionEnd = ta.value.length;

    (ta as any).setRangeText = undefined;

    insertAtCaret(ta, "\nEND");

    expect(ta.scrollTop).toBe(100);
  });

  it("works without setRangeText fallback", () => {
    const ta = mkTextarea("abcXYZ");
    ta.selectionStart = 3;
    ta.selectionEnd = 6;

    (ta as any).setRangeText = undefined;

    insertAtCaret(ta, "123");

    expect(ta.value).toBe("abc123");
    expect(ta.selectionStart).toBe(3 + 3);
    expect(ta.selectionEnd).toBe(ta.selectionStart);
  });
});
