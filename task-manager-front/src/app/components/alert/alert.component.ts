import { Component, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertService } from "../../services/alert.service";

/* ==== ALERT COMPONENT ==== */
/**
 * Displays global alerts from the AlertService.
 * Reactive to alert state changes.
 */
@Component({
  selector: "app-alert",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./alert.component.html",
  styleUrls: ["./alert.component.scss"],
})
export class AlertComponent {
  private alertService = inject(AlertService);

  /** Reactive computed alert (null or {type, message}) */
  alert = computed(() => this.alertService.alert());
}
