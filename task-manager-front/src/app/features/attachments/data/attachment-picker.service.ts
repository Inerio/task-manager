import { Injectable } from "@angular/core";

export type AttachmentPickerOptions = {
  accept?: string;
  multiple?: boolean;
  beforeOpen?: () => void; // e.g., dialogOpen.emit(true)
  afterClose?: () => void; // e.g., dialogOpen.emit(false)
  openWithInput?: () => Promise<File[]>; // fallback using a hidden <input type="file">
};

/**
 * Unifies File System Access API and <input type="file"> fallback behind a single method.
 * Filtering by accept/size/dedupe is intentionally left to FileSelectionService.
 */
@Injectable({ providedIn: "root" })
export class AttachmentPickerService {
  private canUseFSAccess(): boolean {
    return (
      typeof window !== "undefined" &&
      "showOpenFilePicker" in window &&
      isSecureContext === true
    );
  }

  async pick(options: AttachmentPickerOptions): Promise<File[]> {
    const { beforeOpen, afterClose, multiple = true } = options ?? {};
    beforeOpen?.();
    try {
      // Prefer File System Access API when available.
      if (this.canUseFSAccess()) {
        const picker = (
          window as unknown as {
            showOpenFilePicker: (opts: {
              multiple?: boolean;
              excludeAcceptAllOption?: boolean;
              // We purposely omit "types" mapping because filtering is done later.
            }) => Promise<Array<{ getFile(): Promise<File> }>>;
          }
        ).showOpenFilePicker;

        if (picker) {
          const handles = await picker({
            multiple,
            excludeAcceptAllOption: false,
          });
          const files = await Promise.all(handles.map((h) => h.getFile()));
          return files;
        }
      }

      // Fallback to hidden input provided by the caller.
      if (options.openWithInput) {
        const files = await options.openWithInput();
        return files ?? [];
      }

      return [];
    } finally {
      afterClose?.();
    }
  }
}
