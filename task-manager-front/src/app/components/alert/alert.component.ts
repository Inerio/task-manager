import {
  Component,
  computed,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";
import { NgClass } from "@angular/common";
import { AlertService } from "../../services/alert.service";

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

  /** All current alerts (reactive signal). */
  readonly alerts = computed(() => this.alertService.alerts());

  /** Track function for @for. */
  readonly trackById = (_: number, a: { id: number }) => a.id;

  dismiss(id: number): void {
    this.alertService.dismiss(id);
  }
}
