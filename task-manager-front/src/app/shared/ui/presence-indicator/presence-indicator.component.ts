import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { PresenceService } from "../../../core/services/presence/presence.service";

@Component({
  selector: "app-presence-indicator",
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: "./presence-indicator.component.html",
  styleUrls: ["./presence-indicator.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenceIndicatorComponent {
  private readonly presence = inject(PresenceService);
  private readonly i18n = inject(TranslocoService);

  readonly onlineUsers = this.presence.onlineUsers;
  readonly myName = this.presence.displayName;
  readonly mySessionId = this.presence.sessionId;

  /** Others = online users that are NOT this session. */
  readonly others = computed(() =>
    this.onlineUsers().filter((u) => u.sessionId !== this.mySessionId)
  );

  readonly othersCount = computed(() => this.others().length);

  /** Show the name prompt dialog. */
  readonly showNamePrompt = signal(false);

  /** Expanded dropdown showing online users. */
  readonly dropdownOpen = signal(false);

  /** Editing own name inline. */
  readonly editingName = signal(false);
  readonly editValue = signal("");

  @ViewChild("nameInput") private nameInput?: ElementRef<HTMLInputElement>;

  /** Get initials from a display name (max 2 chars). */
  getInitials(name: string): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  /** Generate a stable color from a session ID. */
  getColor(sessionId: string): string {
    const colors = [
      "#1976d2", "#e53935", "#43a047", "#fb8c00",
      "#8e24aa", "#00897b", "#d81b60", "#3949ab",
    ];
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  /** Prompt for name if not set. */
  promptName(): void {
    this.editValue.set(this.myName());
    this.showNamePrompt.set(true);
    requestAnimationFrame(() => this.nameInput?.nativeElement?.focus());
  }

  startEditName(): void {
    this.editValue.set(this.myName());
    this.editingName.set(true);
    requestAnimationFrame(() => this.nameInput?.nativeElement?.focus());
  }

  saveName(): void {
    const v = this.editValue().trim();
    if (v) {
      this.presence.setDisplayName(v);
    }
    this.editingName.set(false);
    this.showNamePrompt.set(false);
  }

  cancelEdit(): void {
    this.editingName.set(false);
    this.showNamePrompt.set(false);
  }

  onNameInput(event: Event): void {
    this.editValue.set((event.target as HTMLInputElement).value);
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      this.saveName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.cancelEdit();
    }
  }
}
