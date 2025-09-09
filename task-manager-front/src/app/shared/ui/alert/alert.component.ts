import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { NgClass } from "@angular/common";
import {
  AlertService,
  type AlertMessage,
} from "../../../core/services/alert.service";

@Component({
  selector: "app-alert",
  standalone: true,
  imports: [NgClass],
  templateUrl: "./alert.component.html",
  styleUrls: ["./alert.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertComponent {
  private readonly alertService = inject(AlertService);

  /** Direct alias to the service signal (no extra computed wrapper). */
  readonly alerts = this.alertService.alerts;

  /** Stable trackBy for @for (prevents DOM churn). */
  trackById(_index: number, a: Pick<AlertMessage, "id">): number {
    return a.id;
  }

  /** Dismiss a toast by id. */
  dismiss(id: number): void {
    this.alertService.dismiss(id);
  }
}
