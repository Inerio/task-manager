import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/* ==== LINKIFY PIPE (SAFE) ==== */

/** Matches URLs starting by http(s):// (simple demo, not exhaustive) */
const urlRegex = /(https?:\/\/[^\s]+)/g;

@Pipe({
  name: "linkify",
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Transforms plain text by replacing URLs with clickable anchor tags,
   * sanitizing the output for safe innerHTML.
   * Also converts line breaks to <br>.
   * @param text The input string.
   * @returns SafeHtml string with links and line breaks.
   */
  transform(text: string | null | undefined): SafeHtml {
    if (!text) return "";
    let html = text.replace(
      urlRegex,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
    html = html.replace(/\n/g, "<br>");
    // Always sanitize HTML to prevent XSS
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
