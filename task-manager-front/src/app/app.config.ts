import { ApplicationConfig, provideZoneChangeDetection } from "@angular/core";
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from "@angular/common/http";
import { provideUploadConfig } from "./tokens/upload.config";

/**
 * Global application configuration:
 * - Centralizes HttpClient provider.
 * - Enables zone event/run coalescing for minor performance wins.
 * - Registers upload config token (defaults can be overridden).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideUploadConfig(),
  ],
};
