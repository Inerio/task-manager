import { InjectionToken, type Provider } from "@angular/core";

export interface UploadConfig {
  /** Accepted MIME types / extensions string, e.g. "image/*,.pdf". */
  acceptTypes: string;
  /** Maximum file size in bytes. */
  maxSize: number;
}

export const DEFAULT_UPLOAD_CONFIG = {
  acceptTypes: "image/*,.pdf,.doc,.docx,.txt",
  maxSize: 5 * 1024 * 1024,
} as const;

export const UPLOAD_CONFIG = new InjectionToken<UploadConfig>("UPLOAD_CONFIG");

/** Root provider helper. Use in app config to override defaults per environment. */
export function provideUploadConfig(cfg: Partial<UploadConfig> = {}): Provider {
  // Spread into a plain object so Angular DI gets a mutable value.
  return {
    provide: UPLOAD_CONFIG,
    useValue: { ...DEFAULT_UPLOAD_CONFIG, ...cfg },
  };
}
