import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  signal,
  computed,
  type Signal,
  type WritableSignal,
} from "@angular/core";
import { LoadingOverlayComponent } from "./loading-overlay.component";
import { LoadingService } from "../../../core/services/loading.service";
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

class LoadingServiceStub {
  private _global = signal<number>(0);
  isLoading = computed(() => this._global() > 0);

  private _scopes = new Map<string, WritableSignal<number>>();
  private scopeCounter(scope: string): WritableSignal<number> {
    let s = this._scopes.get(scope);
    if (!s) {
      s = signal<number>(0);
      this._scopes.set(scope, s);
    }
    return s;
  }
  isLoadingScope(scope: string): Signal<boolean> {
    const s = this.scopeCounter(scope);
    return computed(() => s() > 0);
  }

  incGlobal() {
    this._global.update((n) => n + 1);
  }
  decGlobal() {
    this._global.update((n) => Math.max(0, n - 1));
  }
  inc(scope: string) {
    this.scopeCounter(scope).update((n) => n + 1);
  }
  dec(scope: string) {
    this.scopeCounter(scope).update((n) => Math.max(0, n - 1));
  }
}

@Component({
  standalone: true,
  imports: [LoadingOverlayComponent],
  template: `<app-loading-overlay [scope]="scope"></app-loading-overlay>`,
})
class HostCmp {
  scope: string | null = null;
}

describe("LoadingOverlayComponent", () => {
  let svc: LoadingServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostCmp],
      providers: [
        { provide: LoadingService, useClass: LoadingServiceStub },
        { provide: TranslocoService, useClass: TranslocoServiceStub },
      ],
    });
    svc = TestBed.inject(LoadingService) as any;
  });

  it("affiche l’overlay global quand isLoading=true", () => {
    const f = TestBed.createComponent(HostCmp);
    f.detectChanges();
    expect(f.nativeElement.querySelector(".loading-overlay")).toBeNull();

    svc.incGlobal();
    f.detectChanges();

    const el: HTMLElement | null =
      f.nativeElement.querySelector(".loading-overlay");
    expect(el).withContext("overlay visible en global").not.toBeNull();
    expect(el!.getAttribute("role")).toBe("status");

    svc.decGlobal();
    f.detectChanges();
    expect(f.nativeElement.querySelector(".loading-overlay")).toBeNull();
  });

  it("écoute un scope si fourni (inline), ignore le global", () => {
    const f = TestBed.createComponent(HostCmp);
    f.componentInstance.scope = "board";
    f.detectChanges();

    svc.incGlobal();
    f.detectChanges();
    expect(f.nativeElement.querySelector(".loading-overlay")).toBeNull();

    svc.inc("board");
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector(".loading-overlay")!;
    expect(el).not.toBeNull();
    expect(el.classList.contains("inline")).toBeTrue();

    svc.dec("board");
    f.detectChanges();
    expect(f.nativeElement.querySelector(".loading-overlay")).toBeNull();
  });
});
