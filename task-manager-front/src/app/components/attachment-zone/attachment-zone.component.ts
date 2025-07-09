import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  signal,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-attachment-zone',
  standalone: true,
  styleUrls: ['./attachment-zone.component.scss'],
  templateUrl: './attachment-zone.component.html',
})
export class AttachmentZoneComponent {
  /* Liste des fichiers déjà attachés */
  @Input({ required: true }) attachments!: string[];
  /* Types de fichiers autorisés */
  @Input() acceptTypes = 'image/*,.pdf,.doc,.docx,.txt';
  /* Taille max */
  @Input() maxSize = 5 * 1024 * 1024;

  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();

  isDragging = signal(false);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  triggerFileSelect() {
    this.fileInput?.nativeElement.click();
  }

  trackByFilename(index: number, filename: string): string {
    return filename;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      // Filtre côté front (ne retient que les nouveaux fichiers à uploader)
      const newFiles = Array.from(files).filter(
        (file) => !this.attachments.includes(file.name),
      );
      if (newFiles.length < files.length) {
        alert('Certains fichiers étaient déjà attachés et ont été ignorés.');
      }
      if (newFiles.length) this.filesUploaded.emit(newFiles); // on émet la liste !
    }
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      const newFiles = Array.from(files).filter(
        (file) => !this.attachments.includes(file.name),
      );
      if (newFiles.length < files.length) {
        alert('Certains fichiers étaient déjà attachés et ont été ignorés.');
      }
      if (newFiles.length) this.filesUploaded.emit(newFiles);
    }
    this.isDragging.set(false);
  }

  onDeleteAttachment(filename: string) {
    this.fileDeleted.emit(filename);
  }

  onDownloadAttachment(filename: string) {
    this.fileDownloaded.emit(filename);
  }
}
