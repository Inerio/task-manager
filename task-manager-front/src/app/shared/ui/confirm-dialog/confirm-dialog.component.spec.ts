import { TestBed } from "@angular/core/testing";
import { ConfirmDialogComponent } from "./confirm-dialog.component";
import { ConfirmDialogService } from "../../../core/services/dialog/confirm-dialog.service";
import { TranslocoService } from "@jsverse/transloco";
import { Subject } from "rxjs";

class TranslocoServiceStub {
  config = { reRenderOnLangChange: false };
  private _lang$ = new Subject<string>();
  langChanges$ = this._lang$.asObservable();

  getActiveLang() {
    return "en";
  }
  translate(key: string) {
    return key;
  }

  setActiveLang(l: string) {
    this._lang$.next(l);
  }
}

describe("ConfirmDialogComponent", () => {
  let svc: ConfirmDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        ConfirmDialogService,
        { provide: TranslocoService, useClass: TranslocoServiceStub },
      ],
    });
    svc = TestBed.inject(ConfirmDialogService);
  });

  it("affiche/masque le dialog et déclenche confirm/cancel via click", async () => {
    const f = TestBed.createComponent(ConfirmDialogComponent);
    f.detectChanges();

    const p = svc.open("Title", "Message", { allowEnterConfirm: true });
    f.detectChanges();

    expect(f.nativeElement.querySelector(".confirm-dialog")).not.toBeNull();

    const yesBtn: HTMLButtonElement =
      f.nativeElement.querySelector(".btn.btn-success");
    yesBtn.click();
    f.detectChanges();

    expect(await p).toBeTrue();
    expect(f.nativeElement.querySelector(".confirm-dialog")).toBeNull();
  });

  it("ESC annule, ENTER confirme si autorisé", async () => {
    const f = TestBed.createComponent(ConfirmDialogComponent);
    f.detectChanges();

    const p = svc.open("T", "M", { allowEnterConfirm: true });
    f.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    f.detectChanges();
    expect(await p).toBeTrue();

    const p2 = svc.open("T", "M", { allowEnterConfirm: false });
    f.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    f.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    f.detectChanges();
    expect(await p2).toBeFalse();
  });
});
