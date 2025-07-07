import { Pipe, PipeTransform } from "@angular/core";

// Expression régulière pour détecter les URLs
const urlRegex = /(https?:\/\/[^\s]+)/g;

@Pipe({
  name: "linkify",
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    if (!text) return "";
    // Remplace les URLs par des liens cliquables (HTML)
    return text.replace(
      urlRegex,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
  }
}
