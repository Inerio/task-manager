import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TranslocoLoader } from "@jsverse/transloco";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment"; // cache-busting version

@Injectable({ providedIn: "root" })
export class AppTranslocoLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {}

  // JSONs in /public/i18n/{lang}.json -> served at /i18n/{lang}.json
  // Add ?v= to invalidate stale CDN/browser caches on new deploys.
  getTranslation(lang: string): Observable<Record<string, unknown>> {
    const v = environment.assetsVersion ?? "dev";
    return this.http.get<Record<string, unknown>>(`/i18n/${lang}.json?v=${v}`);
  }
}
