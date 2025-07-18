import { Component, inject } from "@angular/core";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
})
export class ConfirmDialogComponent {
  confirmDialog = inject(ConfirmDialogService);
  state = this.confirmDialog.state;

  confirm = () => this.confirmDialog.confirm();
  cancel = () => this.confirmDialog.cancel();
}
