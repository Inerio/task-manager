import { Pipe, PipeTransform } from "@angular/core";

/* ==== LINKIFY PIPE ==== */

/** Regex for detecting URLs */
const urlRegex = /(https?:\/\/[^\s]+)/g;

@Pipe({
  name: "linkify",
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  /**
   * Transforms a plain text string by replacing URLs with clickable anchor tags.
   * @param text The input string to process.
   * @returns The HTML string with anchor tags for detected URLs.
   */
  transform(text: string | null | undefined): string {
    if (!text) return "";
    // Replace URLs with clickable links (HTML)
    return text.replace(
      urlRegex,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
  }
}
