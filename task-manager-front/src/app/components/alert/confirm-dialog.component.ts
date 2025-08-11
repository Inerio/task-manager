import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  HostListener,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class ConfirmDialogComponent {
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly state = this.confirmDialog.state;
  readonly visible = computed(() => this.state().visible);

  confirm(): void {
    this.confirmDialog.confirm();
  }
  cancel(): void {
    this.confirmDialog.cancel();
  }

  // Close with ESC anywhere
  @HostListener("document:keydown.escape")
  onEsc(): void {
    if (this.visible()) this.cancel();
  }
}
