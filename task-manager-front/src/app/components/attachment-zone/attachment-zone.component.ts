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

  @Output() fileUploaded = new EventEmitter<File>();
  @Output() fileDeleted = new EventEmitter<string>();
  @Output() fileDownloaded = new EventEmitter<string>();

  isDragging = signal(false);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  triggerFileSelect() {
    this.fileInput?.nativeElement.click();
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      for (const file of Array.from(files)) {
        this.fileUploaded.emit(file);
      }
    }
    this.isDragging.set(false);
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
      Array.from(files).forEach((file) => this.fileUploaded.emit(file));
    }
  }

  onDeleteAttachment(filename: string) {
    this.fileDeleted.emit(filename);
  }

  onDownloadAttachment(filename: string) {
    this.fileDownloaded.emit(filename);
  }
}
