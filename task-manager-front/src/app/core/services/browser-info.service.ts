import { Injectable } from "@angular/core";

/**
 * BrowserInfoService
 * - Centralized browser capability/user-agent helpers.
 * - Currently exposes Brave detection used to hide the attachment zone.
 */
@Injectable({ providedIn: "root" })
export class BrowserInfoService {
  private _isBraveCache: boolean | null = null;

  /** Detect Brave browser with best-effort fallbacks. Result is cached. */
  async isBrave(): Promise<boolean> {
    if (this._isBraveCache !== null) return this._isBraveCache;

    try {
      const nav = navigator as unknown as {
        brave?: { isBrave?: () => Promise<boolean> };
        userAgentData?: { brands?: { brand: string }[] };
        userAgent?: string;
      };

      // Primary detection when available.
      const res = await nav.brave?.isBrave?.();
      if (typeof res === "boolean") {
        this._isBraveCache = res;
        return res;
      }

      // Fallback based on brands / userAgent heuristics.
      const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
      const hay = `${brands.join(" ")} ${(nav.userAgent || "").toLowerCase()}`;
      const guess = hay.includes("brave");
      this._isBraveCache = guess;
      return guess;
    } catch {
      this._isBraveCache = false;
      return false;
    }
  }
}
