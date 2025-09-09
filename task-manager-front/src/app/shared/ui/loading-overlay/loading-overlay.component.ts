import {
  Component,
  ChangeDetectionStrategy,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
  type Signal,
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
export class LoadingOverlayComponent implements OnChanges {
  private readonly loading = inject(LoadingService);

  /** If provided, the overlay becomes "inline" and listens to that scope only. */
  @Input() scope?: string;

  /** Scoped loading signal when `scope` is set. */
  private scopedSignal?: Signal<boolean>;

  ngOnChanges(_changes: SimpleChanges): void {
    this.scopedSignal = this.scope
      ? this.loading.isLoadingScope(this.scope)
      : undefined;
  }

  /** Read current loading state (scoped or global). */
  isLoading(): boolean {
    return this.scopedSignal ? this.scopedSignal() : this.loading.isLoading();
  }
}
