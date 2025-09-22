import { TestBed } from "@angular/core/testing";
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  provideHttpClientTesting,
  HttpTestingController,
} from "@angular/common/http/testing";
import { BoardService } from "./board.service";
import { environment } from "../../../../environments/environment";
import { TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../../core/services/alert.service";
import { Board } from "../models/board.model";

describe("BoardService (HTTP + signals)", () => {
  const translocoStub = { translate: (k: string) => k };
  const alertStub = { show: jasmine.createSpy("show") };

  let service: BoardService;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BoardService,
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        { provide: TranslocoService, useValue: translocoStub },
        { provide: AlertService, useValue: alertStub },
      ],
    });
    service = TestBed.inject(BoardService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    alertStub.show.calls.reset();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("loadBoards: sets boards on success", () => {
    const expected: Board[] = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];

    service.loadBoards();

    const req = httpMock.expectOne(`${environment.apiUrl}/boards`);
    expect(req.request.method).toBe("GET");
    req.flush(expected);

    expect(service.boards()).toEqual(expected);
  });

  it("loadBoards: clears state and alerts on error", () => {
    service.loadBoards();

    const req = httpMock.expectOne(`${environment.apiUrl}/boards`);
    req.flush("boom", { status: 500, statusText: "Server Error" });

    expect(service.boards()).toEqual([]);
    expect(alertStub.show).toHaveBeenCalledWith(
      "error",
      "errors.loadingBoards"
    );
  });

  it("createBoard: POST then appends to state", () => {
    service.createBoard("New").subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/boards`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ name: "New" });

    const created: Board = { id: 3, name: "New" };
    req.flush(created);

    expect(service.boards()).toEqual([created]);
  });

  it("deleteBoard: DELETE then removes from state", () => {
    // prime local state
    service.reorderBoardsLocal([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);

    service.deleteBoard(1).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/boards/1`);
    expect(req.request.method).toBe("DELETE");
    req.flush(null);

    // Check subset to keep types strict (Board has no 'position')
    expect(service.boards()).toEqual([
      jasmine.objectContaining<Partial<Board>>({ id: 2, name: "B" }),
    ]);
    expect((service.boards()[0] as any).position).toBe(1);
  });

  it("updateBoard: PUT then replaces in state", () => {
    service.reorderBoardsLocal([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);

    service.updateBoard(2, "BB").subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/boards/2`);
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toEqual({ name: "BB" });

    req.flush({ id: 2, name: "BB" });

    // Use partial match for the first item (Board doesn't define 'position')
    expect(service.boards()[0]).toEqual(
      jasmine.objectContaining<Partial<Board>>({ id: 1, name: "A" })
    );
    expect((service.boards()[0] as any).position).toBe(0);
    expect(service.boards()[1]).toEqual({ id: 2, name: "BB" });
  });

  it("reorderBoardsLocal: normalizes positions", () => {
    service.reorderBoardsLocal([
      { id: 5, name: "X" },
      { id: 9, name: "Y" },
      { id: 2, name: "Z" },
    ]);
    const positions = service.boards().map((b) => (b as any).position);
    expect(positions).toEqual([0, 1, 2]);
  });

  it("reorderBoards (persist): PUT payload and error alert", (done) => {
    const payload = [
      { id: 10, position: 0 },
      { id: 11, position: 1 },
    ];

    service.reorderBoards(payload).subscribe({
      next: () => fail("should error"),
      error: () => {
        expect(alertStub.show).toHaveBeenCalledWith(
          "error",
          "errors.reorderingBoards"
        );
        done();
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/boards/reorder`);
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toEqual(payload);
    req.flush("fail", { status: 500, statusText: "Server Error" });
  });
});
