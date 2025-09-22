import { TestBed } from "@angular/core/testing";
import {
  HttpClient,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  provideHttpClientTesting,
  HttpTestingController,
} from "@angular/common/http/testing";
import { anonIdInterceptor } from "./anon-id.interceptor";

describe("anonIdInterceptor", () => {
  const HEADER = "X-Client-Id";
  const LS_KEY = "tasukeru_uid";

  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Ensure a clean state (module-level cache may still hold a UID, which is fine).
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([anonIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("adds header for relative (same-origin) requests and persists value", () => {
    let h1: string | null = null;
    let h2: string | null = null;

    http.get("/api/one").subscribe();
    const r1 = httpMock.expectOne("/api/one");
    h1 = r1.request.headers.get(HEADER);
    expect(h1).toBeTruthy();
    r1.flush({ ok: true });

    http.get("/api/two").subscribe();
    const r2 = httpMock.expectOne("/api/two");
    h2 = r2.request.headers.get(HEADER);
    expect(h2).toBeTruthy();
    expect(h2).toBe(h1); // same UID across requests
    r2.flush({ ok: true });
  });

  it("adds header for absolute same-origin URLs", () => {
    const sameOriginUrl = `${window.location.origin}/abs`;
    http.get(sameOriginUrl).subscribe();
    const req = httpMock.expectOne(sameOriginUrl);
    const headerVal = req.request.headers.get(HEADER);
    expect(headerVal).toBeTruthy();
    req.flush({});
  });

  it("does not override existing header", () => {
    const custom = "pre-set";
    http
      .get("/api/custom", { headers: new HttpHeaders({ [HEADER]: custom }) })
      .subscribe();
    const req = httpMock.expectOne("/api/custom");
    expect(req.request.headers.get(HEADER)).toBe(custom);
    req.flush({});
  });

  it("skips cross-origin requests", () => {
    const cross = "https://example.com/api";
    http.get(cross).subscribe();
    const req = httpMock.expectOne(cross);
    expect(req.request.headers.has(HEADER)).toBeFalse();
    req.flush({});
  });

  it("still adds header when localStorage is blocked (do not assert spy calls)", () => {
    // We simulate storage failures but only assert that a header is present.
    spyOn(window.localStorage, "getItem").and.throwError("blocked");
    spyOn(window.localStorage, "setItem").and.throwError("blocked");

    http.get("/api/no-ls").subscribe();
    const req = httpMock.expectOne("/api/no-ls");
    const headerVal = req.request.headers.get(HEADER);

    expect(typeof headerVal).toBe("string");
    expect((headerVal || "").length).toBeGreaterThan(10);
    req.flush({});
  });
});
