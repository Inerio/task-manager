import { Component, Input, ChangeDetectionStrategy } from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";

@Component({
  selector: "app-footer",
  standalone: true,
  templateUrl: "./footer.component.html",
  styleUrls: ["./footer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class FooterComponent {
  /** Brand shown before the legal text. Override via [brand] if needed. */
  @Input() brand = "Tasukeru";

  /** Static year (no need to recompute). */
  readonly year = new Date().getFullYear();
}
