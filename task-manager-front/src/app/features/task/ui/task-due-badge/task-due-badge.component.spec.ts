import { TestBed } from "@angular/core/testing";
import { TaskDueBadgeComponent } from "./task-due-badge.component";
import { TranslocoService } from "@jsverse/transloco";
import { Subject } from "rxjs";

class TranslocoServiceStub {
  private _lang = "en";
  config = { reRenderOnLangChange: false };
  langChanges$ = new Subject<string>();
  getActiveLang() {
    return this._lang;
  }
  setActiveLang(l: string) {
    this._lang = l;
    this.langChanges$.next(l);
  }
  translate(key: string, params?: any) {
    if (key === "task.due.nDays") return `${params?.count}d-${this._lang}`;
    const map: Record<string, string> = {
      "task.due.late": `late-${this._lang}`,
      "task.due.today": `today-${this._lang}`,
      "task.due.oneDay": `1d-${this._lang}`,
    };
    return map[key] ?? key;
  }
}

describe("TaskDueBadgeComponent", () => {
  let i18n: TranslocoServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskDueBadgeComponent],
      providers: [
        { provide: TranslocoService, useClass: TranslocoServiceStub },
      ],
    });
    i18n = TestBed.inject(TranslocoService) as any;
  });

  function setDue(f: any, due: string | null) {
    // Use setInput to trigger ngOnChanges
    f.componentRef.setInput("dueDate", due);
    f.detectChanges();
  }

  it("renders nothing when dueDate is missing/invalid", () => {
    const f = TestBed.createComponent(TaskDueBadgeComponent);
    setDue(f, null);
    expect(f.nativeElement.querySelector(".due-row")).toBeNull();

    setDue(f, "invalid");
    expect(f.nativeElement.querySelector(".due-row")).toBeNull();
  });

  it("renders correct labels (late / today / 1d / nd)", () => {
    const f = TestBed.createComponent(TaskDueBadgeComponent);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
    setDue(f, iso);
    expect(f.nativeElement.textContent).toContain("today-en");

    const d1 = new Date(today);
    d1.setDate(today.getDate() + 1);
    const iso1 = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d1.getDate()).padStart(2, "0")}`;
    setDue(f, iso1);
    expect(f.nativeElement.textContent).toContain("1d-en");

    const d3 = new Date(today);
    d3.setDate(today.getDate() + 3);
    const iso3 = `${d3.getFullYear()}-${String(d3.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d3.getDate()).padStart(2, "0")}`;
    setDue(f, iso3);
    expect(f.nativeElement.textContent).toContain("3d-en");

    const dm1 = new Date(today);
    dm1.setDate(today.getDate() - 1);
    const isom1 = `${dm1.getFullYear()}-${String(dm1.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(dm1.getDate()).padStart(2, "0")}`;
    setDue(f, isom1);
    expect(f.nativeElement.textContent).toContain("late-en");
  });

  it("recomputes labels when language changes", () => {
    const f = TestBed.createComponent(TaskDueBadgeComponent);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
    setDue(f, iso);
    expect(f.nativeElement.textContent).toContain("today-en");

    i18n.setActiveLang("es");
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("today-es");
  });
});
