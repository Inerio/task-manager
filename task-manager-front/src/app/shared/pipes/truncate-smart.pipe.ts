import { Pipe, PipeTransform } from "@angular/core";

/**
 * Truncates plain text with an ellipsis when `expanded` is false.
 * Use BEFORE any HTML/linkification pipe in the template.
 */
@Pipe({
  name: "truncateSmart",
  standalone: true,
  pure: true,
})
export class TruncateSmartPipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    expanded: boolean,
    maxLen: number
  ): string {
    const v = value ?? "";
    if (expanded) return v;
    if (!maxLen || v.length <= maxLen) return v;
    return v.slice(0, maxLen) + "…";
  }
}
