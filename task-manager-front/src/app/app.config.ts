import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
} from "@angular/core";
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from "@angular/common/http";
import { provideUploadConfig } from "./tokens/upload.config";

import { provideTransloco } from "@jsverse/transloco";
import { provideTranslocoPersistLang } from "@jsverse/transloco-persist-lang";
import { AppTranslocoLoader } from "./transloco.loader";

/**
 * Global application configuration:
 * - Centralizes HttpClient provider.
 * - Enables zone event/run coalescing for minor performance wins.
 * - Registers upload config token (defaults can be overridden).
 * - Provides Transloco i18n and persists the active language.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideUploadConfig(),

    provideTransloco({
      config: {
        availableLangs: ["en", "fr"],
        defaultLang: "en",
        fallbackLang: "en",
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: AppTranslocoLoader,
    }),

    // Persist the active language using localStorage
    provideTranslocoPersistLang({
      storage: { useFactory: () => localStorage },
      storageKey: "translocoLang",
    }),
  ],
};
