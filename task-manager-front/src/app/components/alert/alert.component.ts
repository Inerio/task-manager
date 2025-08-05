import { Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertService } from "../../services/alert.service";

/**
 * Displays a stack of alerts (toast notifications), one per active alert.
 * (This component is still called AlertComponent for compatibility)
 */
@Component({
  selector: "app-alert",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./alert.component.html",
  styleUrls: ["./alert.component.scss"],
})
export class AlertComponent {
  private readonly alertService = inject(AlertService);

  /** All current alerts (reactive signal) */
  readonly alerts = computed(() => this.alertService.alerts());

  dismiss(id: number) {
    this.alertService.dismiss(id);
  }
}
