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
import { LoadingService } from "../../services/loading.service";

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

  private scopedSignal?: Signal<boolean>;

  ngOnChanges(_changes: SimpleChanges): void {
    this.scopedSignal = this.scope
      ? this.loading.isLoadingScope(this.scope)
      : undefined;
  }

  isLoading = () =>
    this.scopedSignal ? this.scopedSignal() : this.loading.isLoading();
}
