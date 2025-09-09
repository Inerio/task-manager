import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { toSignal } from "@angular/core/rxjs-interop";

/**
 * Displays a localized due badge + formatted date.
 * Renders nothing if the provided due date is absent or invalid.
 */
@Component({
  selector: "app-task-due-badge",
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: "./task-due-badge.component.html",
  styleUrls: ["./task-due-badge.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDueBadgeComponent implements OnChanges {
  @Input() dueDate: string | null | undefined = null;

  private readonly i18n = inject(TranslocoService);
  /** Recompute derived values when the active language changes. */
  private readonly lang = toSignal(this.i18n.langChanges$, {
    initialValue: this.i18n.getActiveLang(),
  });

  /** Local input mirror as a signal to drive computed values. */
  private readonly _due = signal<string | null | undefined>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["dueDate"]) this._due.set(this.dueDate);
  }

  /** Parse `YYYY-MM-DD` as a *local* date to avoid TZ shifts. */
  private parseLocalISO(iso: string): Date | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  /** Compute (due - today) in days, or null if unavailable. */
  private computeDiffDays(): number | null {
    const raw = this._due();
    if (!raw) return null;

    const due = this.parseLocalISO(raw);
    if (!due) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  }

  /** Localized badge text (late/today/1d/ndays) — null when no badge. */
  readonly badgeText = computed<string | null>(() => {
    // Re-evaluate when language changes
    this.lang();

    const diff = this.computeDiffDays();
    if (diff == null) return null;

    if (diff < 0) return this.i18n.translate("task.due.late");
    if (diff === 0) return this.i18n.translate("task.due.today");
    if (diff === 1) return this.i18n.translate("task.due.oneDay");
    return this.i18n.translate("task.due.nDays", { count: diff });
  });

  /** True if due date is in the past. */
  readonly isLate = computed<boolean>(() => {
    const diff = this.computeDiffDays();
    return diff != null && diff < 0;
  });

  /** Localized formatted date (short month). */
  readonly formattedDate = computed<string | null>(() => {
    const lang = (this.lang() as string) || "en";
    const raw = this._due();
    if (!raw) return null;

    const date = this.parseLocalISO(raw);
    if (!date) return null;

    const locale = lang.startsWith("fr") ? "fr-FR" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  });
}
