import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { TemplatePickerService } from "../../services/template-picker.service";
import {
  BOARD_TEMPLATES,
  type BoardTemplateId,
} from "../../utils/board-templates";

@Component({
  selector: "app-template-picker",
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: "./template-picker.component.html",
  styleUrls: ["./template-picker.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePickerComponent {
  private readonly svc = inject(TemplatePickerService);
  private readonly i18n = inject(TranslocoService);

  readonly visible = computed(() => this.svc.state().visible);

  /** Translate columns for preview on-the-fly when language changes. */
  readonly templates = computed(() =>
    BOARD_TEMPLATES.map((t) => {
      const cols = t.columns.map((key) =>
        this.i18n.translate(`boards.columns.${key}`)
      );
      const title =
        t.columns.length === 1
          ? this.i18n.translate("boards.templates.oneColumn")
          : this.i18n.translate("boards.templates.nColumns", {
              count: t.columns.length,
            });
      const desc = t.descKey ? this.i18n.translate(t.descKey) : "";
      return { id: t.id, title, cols, desc };
    })
  );

  choose(id: BoardTemplateId) {
    this.svc.choose(id);
  }
  skip() {
    this.svc.skip();
  }

  // Close with ESC
  @HostListener("document:keydown.escape")
  onEsc(): void {
    if (this.visible()) this.skip();
  }
}
