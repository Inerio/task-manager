import { InjectionToken } from "@angular/core";

export interface UploadConfig {
  acceptTypes: string;
  maxSize: number; // bytes
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  acceptTypes: "image/*,.pdf,.doc,.docx,.txt",
  maxSize: 5 * 1024 * 1024,
};

export const UPLOAD_CONFIG = new InjectionToken<UploadConfig>("UPLOAD_CONFIG");

/** Root provider helper (tu peux override via param). */
export function provideUploadConfig(cfg: Partial<UploadConfig> = {}) {
  return {
    provide: UPLOAD_CONFIG,
    useValue: { ...DEFAULT_UPLOAD_CONFIG, ...cfg },
  };
}
