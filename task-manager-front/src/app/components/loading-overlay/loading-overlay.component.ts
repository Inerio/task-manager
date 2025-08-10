import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { LoadingService } from "../../services/loading.service";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  templateUrl: "./loading-overlay.component.html",
  styleUrls: ["./loading-overlay.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  readonly isLoading = inject(LoadingService).isLoading;
}
