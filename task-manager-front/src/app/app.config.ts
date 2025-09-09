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
import { provideTransloco } from "@jsverse/transloco";
import { provideUploadConfig } from "./features/attachments/tokens/upload.config";
import { environment } from "../environments/environment";
import { AppTranslocoLoader } from "./core/i18n/transloco.loader";
import { anonIdInterceptor } from "./core/interceptors/anon-id.interceptor";

// Read saved language early to avoid initial flicker on bootstrap.
const savedLang =
  (localStorage.getItem("translocoLang") as "en" | "fr") || "en";

/** Build per-env upload overrides only when defined. */
const uploadOverrides = {
  ...(environment.uploadAcceptTypes
    ? { acceptTypes: environment.uploadAcceptTypes }
    : {}),
  ...(typeof environment.uploadMaxBytes === "number"
    ? { maxSize: environment.uploadMaxBytes }
    : {}),
};

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
    provideUploadConfig(uploadOverrides),

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
