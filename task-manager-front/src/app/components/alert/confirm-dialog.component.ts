import { Component, inject, computed } from "@angular/core";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

/* ==== CONFIRM DIALOG COMPONENT ==== */
@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
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
}
