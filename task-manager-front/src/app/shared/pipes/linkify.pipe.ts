import { Pipe, PipeTransform, inject, SecurityContext } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/**
 * LINKIFY
 * - Escape HTML first (prevent injection)
 * - Turn URLs (http/https + www.) into anchors
 * - Validate URLs with DomSanitizer before embedding
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

  /**
   * Validate a URL via Angular's DomSanitizer.
   * Returns the sanitized URL or null if the sanitizer flags it as unsafe.
   */
  private safeUrl(raw: string): string | null {
    const sanitized = this.sanitizer.sanitize(SecurityContext.URL, raw);
    // sanitize() returns null for unsafe schemes (javascript:, data:, etc.)
    if (!sanitized || sanitized === "unsafe:") return null;
    return sanitized;
  }

  transform(text: string | null | undefined): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml("");

    let html = this.escapeHtml(text);

    if (this.urlHint.test(html)) {
      html = html.replace(this.urlRegex, (_m, url: string, tail: string) => {
        // Decode HTML entities back to raw URL for validation
        const rawUrl = url
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        const href = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
        const safe = this.safeUrl(href);

        // If the URL is flagged as unsafe, render it as plain text
        if (!safe) return url + tail;

        // Re-escape the validated URL for use inside the href attribute
        const escapedHref = safe
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;");

        const a =
          `<a href="${escapedHref}" target="_blank" ` +
          `rel="noopener noreferrer ugc nofollow">${url}</a>`;
        return a + tail;
      });
    }

    html = html.replace(/\n/g, "<br>");
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
