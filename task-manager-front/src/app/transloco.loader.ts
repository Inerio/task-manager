import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TranslocoLoader } from "@jsverse/transloco";
import { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class AppTranslocoLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {}

  // JSONs in /public/i18n/{lang}.json -> served at /i18n/{lang}.json
  getTranslation(lang: string): Observable<Record<string, any>> {
    return this.http.get<Record<string, any>>(`/i18n/${lang}.json`);
  }
}
