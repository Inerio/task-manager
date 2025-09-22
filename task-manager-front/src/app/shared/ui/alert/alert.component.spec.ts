import { TestBed } from "@angular/core/testing";
import { AlertComponent } from "./alert.component";
import {
  AlertService,
  type AlertMessage,
} from "../../../core/services/alert.service";

class AlertServiceStub {
  private _alerts: AlertMessage[] = [];
  alerts = () => this._alerts;
  dismiss = jasmine.createSpy("dismiss");
  set(list: AlertMessage[]) {
    this._alerts = list;
  }
}

describe("AlertComponent", () => {
  let svc: AlertServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlertComponent],
      providers: [{ provide: AlertService, useClass: AlertServiceStub }],
    });
    svc = TestBed.inject(AlertService) as any;
  });

  it("renders the alert stack and calls dismiss on × click", () => {
    svc.set([
      { id: 1, type: "success", message: "Saved" },
      { id: 2, type: "error", message: "Oops" },
    ]);
    const f = TestBed.createComponent(AlertComponent);
    f.detectChanges();

    const boxes = f.nativeElement.querySelectorAll(".alert-box");
    expect(boxes.length).toBe(2);
    expect(boxes[0].classList.contains("success")).toBeTrue();
    expect(boxes[1].classList.contains("error")).toBeTrue();

    const closeBtn: HTMLButtonElement =
      boxes[0].querySelector(".alert-close-btn");
    closeBtn.click();
    expect(svc.dismiss).toHaveBeenCalledOnceWith(1);
  });
});
