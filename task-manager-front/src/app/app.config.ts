import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
} from "@angular/core";
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from "@angular/common/http";
import { provideUploadConfig } from "./tokens/upload.config";

import { provideTransloco } from "@jsverse/transloco";
import { AppTranslocoLoader } from "./transloco.loader";
import { anonIdInterceptor } from "./core/interceptors/anon-id.interceptor";

// Read saved language early to avoid initial flicker on bootstrap.
const savedLang =
  (localStorage.getItem("translocoLang") as "en" | "fr") || "en";

/**
 * Global application configuration:
 * - Centralizes HttpClient provider.
 * - Enables zone event/run coalescing for minor performance wins.
 * - Registers upload config token (defaults can be overridden).
 * - Provides Transloco i18n:
 *    • defaultLang comes from localStorage (persistence handled by LanguageSwitcher)
 *    • missingHandler silences "Missing translation for ..." console logs
 *
 * Note: We intentionally DO NOT use provideTranslocoPersistLang here,
 * since LanguageSwitcher already persists the active language in localStorage.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([anonIdInterceptor]),
      withInterceptorsFromDi()
    ),
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideUploadConfig(),

    provideTransloco({
      config: {
        availableLangs: ["en", "fr"],
        defaultLang: savedLang,
        fallbackLang: "en",
        reRenderOnLangChange: true,
        missingHandler: {
          logMissingKey: false,
          useFallbackTranslation: true,
        },
        prodMode: !isDevMode(),
      },
      loader: AppTranslocoLoader,
    }),
  ],
};
