import { Pipe, PipeTransform } from "@angular/core";

// Regex for detecting URLs
const urlRegex = /(https?:\/\/[^\s]+)/g;

@Pipe({
  name: "linkify",
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
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
