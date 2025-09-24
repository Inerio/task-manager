import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import {
  AccountIdService,
  NamedIdEntry,
} from "../../../core/services/account-id.service";

@Component({
  selector: "app-account-id-dialog",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule],
  templateUrl: "./account-id-dialog.component.html",
  styleUrls: ["./account-id-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountIdDialogComponent {
  // Controlled by parent
  open = input<boolean>(false);

  // Outputs
  close = output<void>();
  /** Emits the new UID after successful apply. */
  switched = output<string>();

  // Services
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly account = inject(AccountIdService);

  // State
  readonly currentCode = signal<string>(this.account.getShortCode());
  readonly copied = signal<boolean>(false);
  readonly applying = signal<boolean>(false);
  readonly codeError = signal<string>("");
  readonly nameError = signal<string>("");
  readonly namedHistory = signal<NamedIdEntry[]>(
    this.account.getNamedHistory()
  );

  // Form
  readonly uidCtrl = this.fb.control<string>("", {
    validators: [Validators.required],
  });
  readonly nameCtrl = this.fb.control<string>("", {
    validators: [Validators.required, Validators.maxLength(80)],
  });

  // Reset when opened
  private _onOpen = effect(() => {
    if (this.open()) {
      this.currentCode.set(this.account.getShortCode());
      this.namedHistory.set(this.account.getNamedHistory());
      this.uidCtrl.setValue("", { emitEvent: false });
      this.nameCtrl.setValue("", { emitEvent: false });
      this.codeError.set("");
      this.nameError.set("");
      this.copied.set(false);
    }
  });

  // Actions
  async copyCode(): Promise<void> {
    const ok = await this.account.copyToClipboard(this.currentCode());
    this.copied.set(ok);
    setTimeout(() => this.copied.set(false), 1200);
  }

  apply(): void {
    const raw = (this.uidCtrl.value ?? "").trim();
    const name = (this.nameCtrl.value ?? "").trim();

    // Basic validation feedback
    if (!this.account.isValid(raw)) {
      this.codeError.set(this.i18n.translate("identity.invalidCode"));
      return;
    }
    if (!name) {
      this.nameError.set(this.i18n.translate("identity.nameRequired"));
      return;
    }

    this.codeError.set("");
    this.nameError.set("");
    this.applying.set(true);
    try {
      // Persist named entry (normalizes to UUID internally)
      const { uid } = this.account.saveNamedEntry(name, raw);

      // Switch active ID to this uid
      this.account.setUid(uid);

      // Refresh UI state
      this.currentCode.set(this.account.getShortCode());
      this.namedHistory.set(this.account.getNamedHistory());
      this.switched.emit(uid);
    } finally {
      this.applying.set(false);
    }
  }

  /** Prefills form from a named history entry. */
  fillFromHistory(e: NamedIdEntry): void {
    this.nameCtrl.setValue(e.label);
    this.uidCtrl.setValue(e.code); // display short code; service accepts both
    this.codeError.set("");
    this.nameError.set("");
  }

  onBackdropClick(e: Event): void {
    if ((e.target as HTMLElement)?.classList.contains("backdrop")) {
      this.close.emit();
    }
  }

  onCloseClick(): void {
    this.close.emit();
  }
}
