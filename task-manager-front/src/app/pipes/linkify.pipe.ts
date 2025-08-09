import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/**
 * LINKIFY:
 * - Escapes HTML first to avoid injection
 * - Converts URLs (http/https + www.) to anchors
 * - Preserves trailing punctuation outside the link
 * - Converts \n into <br>
 */
@Pipe({
  name: "linkify",
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Rough URL matcher:
   * - http(s)://... or www....
   * - Exclut l'espace
   * - Laisse de côté une éventuelle ponctuation finale
   */
  private readonly urlRegex =
    /\b((?:https?:\/\/|www\.)[^\s<]+?)([),.!?;:'"]?(?:\s|$))/gi;

  transform(text: string | null | undefined): SafeHtml {
    if (!text) return "";
    let html = this.escapeHtml(text);
    html = html.replace(this.urlRegex, (match, url: string, tail: string) => {
      const href = url.startsWith("www.") ? `https://${url}` : url;
      const a =
        `<a href="${href}" target="_blank" ` +
        `rel="noopener noreferrer ugc nofollow">${url}</a>`;
      return a + tail; // preserve trailing punctuation / whitespace
    });
    html = html.replace(/\n/g, "<br>");
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
