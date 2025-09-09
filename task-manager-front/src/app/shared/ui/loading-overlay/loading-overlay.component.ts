import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";
import { LoadingService } from "../../../core/services/loading.service";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  templateUrl: "./loading-overlay.component.html",
  styleUrls: ["./loading-overlay.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class LoadingOverlayComponent {
  private readonly loading = inject(LoadingService);

  /** If provided, the overlay becomes "inline" and listens to that scope only. */
  readonly scope = input<string | null>(null);

  /** Resolve the scoped loading signal only when a scope is defined. */
  private readonly scoped = computed(() => {
    const s = this.scope();
    return s ? this.loading.isLoadingScope(s) : null;
  });

  /** Signal-friendly boolean used directly in the template. */
  readonly isLoading = computed(() => {
    const scoped = this.scoped();
    return scoped ? scoped() : this.loading.isLoading();
  });
}
