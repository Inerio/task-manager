import { Pipe, PipeTransform, inject } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/**
 * LINKIFY
 * - Escape HTML first (prevent injection)
 * - Turn URLs (http/https + www.) into anchors
 * - Keep trailing punctuation outside the link
 * - Convert \n to <br>
 */
@Pipe({
  name: "linkify",
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  /** Quick hint to skip heavy regex when no URL is present. */
  private readonly urlHint = /https?:\/\/|www\./i;

  /**
   * Rough URL matcher:
   * - http(s)://... or www....
   * - Excludes whitespace and '<'
   * - Captures any trailing punctuation block + following whitespace/EOL
   */
  private readonly urlRegex =
    /\b((?:https?:\/\/|www\.)[^\s<]+?)([)\]\}.,!?;:'"]*(?:\s|$))/gi;

  /** Single-pass HTML escaping. */
  private escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  transform(text: string | null | undefined): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml("");

    let html = this.escapeHtml(text);

    if (this.urlHint.test(html)) {
      html = html.replace(this.urlRegex, (_m, url: string, tail: string) => {
        const href = url.startsWith("www.") ? `https://${url}` : url;
        const a =
          `<a href="${href}" target="_blank" ` +
          `rel="noopener noreferrer ugc nofollow">${url}</a>`;
        return a + tail; // preserve trailing punctuation / whitespace
      });
    }

    html = html.replace(/\n/g, "<br>");
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
