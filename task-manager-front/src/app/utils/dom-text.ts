/**
 * Insert text at the current caret position of a textarea.
 * - Preserves scroll position
 * - Works with and without setRangeText support
 * - Places the caret at the end of the inserted text
 */
export function insertAtCaret(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  textarea.focus();

  const prevScroll = textarea.scrollTop;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;

  if (typeof textarea.setRangeText === "function") {
    textarea.setRangeText(text, start, end, "end");
  } else {
    const v = textarea.value;
    textarea.value = v.slice(0, start) + text + v.slice(end);
    const caret = start + text.length;
    try {
      textarea.setSelectionRange(caret, caret);
    } catch {
      /* noop - older browsers */
    }
  }

  textarea.scrollTop = prevScroll;
}
