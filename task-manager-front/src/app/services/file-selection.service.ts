import { Injectable } from "@angular/core";

/**
 * Centralizes file selection rules:
 *  - accept filtering (extensions/MIME and wildcards)
 *  - size filtering
 *  - cross-dedupe against existing filenames
 */
@Injectable({ providedIn: "root" })
export class FileSelectionService {
  /** Accept filter supporting ".png,.pdf,image/*,application/pdf". */
  matchesAccept(file: File, accept: string): boolean {
    const trimmed = (accept || "").trim();
    if (!trimmed) return true;

    const rules = trimmed
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const name = file.name.toLowerCase();
    const type = (file.type || "").toLowerCase();

    return rules.some((rule) => {
      if (rule.startsWith(".")) return name.endsWith(rule);
      if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
  }

  filterBySize(
    files: File[],
    maxSize: number
  ): { accepted: File[]; rejectedCount: number } {
    let rejectedCount = 0;
    const accepted = files.filter((f) => {
      const ok = f.size <= maxSize;
      if (!ok) rejectedCount++;
      return ok;
    });
    return { accepted, rejectedCount };
  }

  /**
   * Dedupe against an existing filename list (preserves input order).
   * Note: Does not dedupe within `files` themselves, mirroring the prior behavior.
   */
  dedupe(
    files: File[],
    existing: string[]
  ): { uniques: File[]; duplicates: number } {
    const already = new Set(existing);
    let duplicates = 0;
    const uniques: File[] = [];
    for (const f of files) {
      if (already.has(f.name)) {
        duplicates++;
      } else {
        uniques.push(f);
      }
    }
    return { uniques, duplicates };
  }

  /**
   * Full pipeline: accept → size → dedupe.
   * Returns accepted list and counters for each rejection reason.
   */
  select(
    files: File[],
    opts: { accept: string; maxSize: number; existing: string[] }
  ): {
    accepted: File[];
    rejected: { tooLarge: number; notAccepted: number; duplicated: number };
  } {
    // Step 1: accept filter
    let notAccepted = 0;
    const byAccept = files.filter((f) => {
      const ok = this.matchesAccept(f, opts.accept);
      if (!ok) notAccepted++;
      return ok;
    });

    // Step 2: size filter
    const { accepted: bySize, rejectedCount: tooLarge } = this.filterBySize(
      byAccept,
      opts.maxSize
    );

    // Step 3: dedupe against existing
    const { uniques, duplicates } = this.dedupe(bySize, opts.existing);

    return {
      accepted: uniques,
      rejected: {
        tooLarge,
        notAccepted,
        duplicated: duplicates,
      },
    };
  }
}
