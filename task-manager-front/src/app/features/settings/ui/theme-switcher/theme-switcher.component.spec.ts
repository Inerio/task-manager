import { TestBed } from "@angular/core/testing";
import { ThemeSwitcherComponent } from "./theme-switcher.component";
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
}

function mockMatchMedia(matches: boolean) {
  spyOn(window, "matchMedia").and.callFake(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as any)
  );
}

describe("ThemeSwitcherComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ThemeSwitcherComponent],
      providers: [
        { provide: TranslocoService, useClass: TranslocoServiceStub },
      ],
    });

    spyOn(localStorage, "getItem").and.returnValue(null);
    spyOn(localStorage, "setItem").and.callThrough();

    mockMatchMedia(false);
    document.documentElement.removeAttribute("data-theme");
  });

  it("initializes theme (light by default) and toggles on click", () => {
    const f = TestBed.createComponent(ThemeSwitcherComponent);
    f.detectChanges();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    const wrapper: HTMLElement = f.nativeElement.querySelector(".theme-toggle");
    wrapper.click();
    f.detectChanges();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.setItem).toHaveBeenCalledWith("appTheme", "dark");
  });

  it("reacts to the storage event (multi-tab sync)", () => {
    const f = TestBed.createComponent(ThemeSwitcherComponent);
    f.detectChanges();

    const ev = new StorageEvent("storage", {
      key: "appTheme",
      newValue: "light",
    });
    window.dispatchEvent(ev);
    f.detectChanges();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
