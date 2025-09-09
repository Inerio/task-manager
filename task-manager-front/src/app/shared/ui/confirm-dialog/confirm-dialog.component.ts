import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  HostListener,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";
import { ConfirmDialogService } from "../../../core/services/dialog/confirm-dialog.service";

/** Simple confirm dialog wired to a reactive service state. */
@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class ConfirmDialogComponent {
  // ---- Injections ----
  private readonly confirmDialog = inject(ConfirmDialogService);

  // ---- Reactive state ----
  /** Service state (title/message/visibility). */
  readonly state = this.confirmDialog.state;
  /** Visibility computed for template `@if`. */
  readonly visible = computed(() => this.state().visible);

  // ---- Public actions ----
  /** Confirm action. */
  confirm(): void {
    this.confirmDialog.confirm();
  }

  /** Cancel action. */
  cancel(): void {
    this.confirmDialog.cancel();
  }

  // ---- Global keybindings ----
  /** Close with ESC anywhere. */
  @HostListener("document:keydown.escape")
  private onEsc(): void {
    if (this.visible()) this.cancel();
  }

  /** Confirm with ENTER when dialog is visible. */
  @HostListener("document:keydown.enter", ["$event"])
  private onEnter(e: KeyboardEvent): void {
    if (!this.visible()) return;
    e.preventDefault();
    this.confirm();
  }
}
