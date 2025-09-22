import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ReactiveFormsModule,
  NonNullableFormBuilder,
  Validators,
} from "@angular/forms";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { AccountIdService } from "../../../core/services/account-id.service";

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
  readonly currentUid = signal<string>(this.account.getUid());
  readonly currentShort = signal<string>(this.account.getShortCode());
  readonly copied = signal<boolean>(false);
  readonly applying = signal<boolean>(false);
  readonly errorMsg = signal<string>("");

  // Form
  readonly uidCtrl = this.fb.control<string>("", {
    validators: [Validators.required],
  });

  // Reset when opened.
  private _onOpen = effect(() => {
    if (this.open()) {
      this.currentUid.set(this.account.getUid());
      this.currentShort.set(this.account.getShortCode());
      this.uidCtrl.setValue("", { emitEvent: false });
      this.errorMsg.set("");
      this.copied.set(false);
    }
  });

  // Actions
  async copyLong(): Promise<void> {
    const ok = await this.account.copyToClipboard(this.currentUid());
    this.copied.set(ok);
    setTimeout(() => this.copied.set(false), 1200);
  }

  async copyShort(): Promise<void> {
    const ok = await this.account.copyToClipboard(this.currentShort());
    this.copied.set(ok);
    setTimeout(() => this.copied.set(false), 1200);
  }

  apply(): void {
    const raw = this.uidCtrl.value.trim();
    if (!this.account.isValid(raw)) {
      this.errorMsg.set(this.i18n.translate("identity.invalid"));
      return;
    }
    this.errorMsg.set("");
    this.applying.set(true);
    try {
      this.account.setUid(raw);
      const canonical = this.account.getUid();
      this.currentUid.set(canonical);
      this.currentShort.set(this.account.getShortCode());
      this.switched.emit(canonical);
    } finally {
      this.applying.set(false);
    }
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
