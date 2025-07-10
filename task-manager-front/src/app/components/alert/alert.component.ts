import { Component, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertService } from "../../services/alert.service";

@Component({
  selector: "app-alert",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./alert.component.html",
  styleUrls: ["./alert.component.scss"],
})
export class AlertComponent {
  private alertService = inject(AlertService);

  alert = computed(() => this.alertService.alert());
}
