import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { toSignal } from "@angular/core/rxjs-interop";
import { TemplatePickerService } from "../../services/template-picker.service";
import {
  BOARD_TEMPLATES,
  type BoardTemplateId,
} from "../../utils/board-templates";

@Component({
  selector: "app-template-picker",
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: "./template-picker.component.html",
  styleUrls: ["./template-picker.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePickerComponent {
  private readonly svc = inject(TemplatePickerService);
  private readonly i18n = inject(TranslocoService);

  readonly visible = computed(() => this.svc.state().visible);

  // Make language changes a reactive dependency so the template cards re-translate
  private readonly currentLang = toSignal(this.i18n.langChanges$, {
    initialValue: this.i18n.getActiveLang(),
  });

  /** Translate columns for preview on-the-fly when language changes. */
  readonly templates = computed(() => {
    this.currentLang();
    return BOARD_TEMPLATES.map((t) => {
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
    });
  });

  choose(id: BoardTemplateId): void {
    this.svc.choose(id);
  }
  skip(): void {
    this.svc.skip();
  }

  // Close with ESC
  @HostListener("document:keydown.escape")
  onEsc(): void {
    if (this.visible()) this.skip();
  }
}
