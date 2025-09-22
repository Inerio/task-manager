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
import { KanbanColumnService } from "./kanban-column.service";
import { TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../../core/services/alert.service";
import { LoadingService } from "../../../core/services/loading.service";
import { environment } from "../../../../environments/environment";
import { KanbanColumn } from "../models/kanban-column.model";

describe("KanbanColumnService (HTTP + signals)", () => {
  const translocoStub = { translate: (k: string) => k };
  const alertStub = { show: jasmine.createSpy("show") };
  const loadingStub = {
    wrap$: <T>(obs: any, _scope?: string) => obs,
  };

  let service: KanbanColumnService;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        KanbanColumnService,
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        { provide: TranslocoService, useValue: translocoStub },
        { provide: AlertService, useValue: alertStub },
        { provide: LoadingService, useValue: loadingStub },
      ],
    });
    service = TestBed.inject(KanbanColumnService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    alertStub.show.calls.reset();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("loadKanbanColumns: sets loading, fills state, clears loading", () => {
    expect(service.loading()).toBeFalse();

    service.loadKanbanColumns(42);
    expect(service.loading()).toBeTrue();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/boards/42/kanbanColumns`
    );
    expect(req.request.method).toBe("GET");
    const cols: KanbanColumn[] = [
      { id: 1, boardId: 42, name: "Todo", position: 0 },
      { id: 2, boardId: 42, name: "Doing", position: 1 },
    ];
    req.flush(cols);

    expect(service.kanbanColumns()).toEqual(cols);
    expect(service.loading()).toBeFalse();
  });

  it("loadKanbanColumns: on error -> empty state + alert", () => {
    service.loadKanbanColumns(42);
    const req = httpMock.expectOne(
      `${environment.apiUrl}/boards/42/kanbanColumns`
    );
    req.flush("boom", { status: 500, statusText: "Server Error" });
    expect(service.kanbanColumns()).toEqual([]);
    expect(alertStub.show).toHaveBeenCalledWith(
      "error",
      "errors.loadingColumns"
    );
    expect(service.loading()).toBeFalse();
  });

  it("createKanbanColumn: POST then append", async () => {
    const promise = service.createKanbanColumn("Backlog", 1);
    const req = httpMock.expectOne(
      `${environment.apiUrl}/boards/1/kanbanColumns`
    );
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ name: "Backlog" });

    const created: KanbanColumn = {
      id: 7,
      boardId: 1,
      name: "Backlog",
      position: 0,
    };
    req.flush(created);

    const out = await promise;
    expect(out).toEqual(created);
    expect(service.kanbanColumns()).toEqual([created]);
  });

  it("updateKanbanColumn: rejects when id or boardId missing", async () => {
    await expectAsync(
      service.updateKanbanColumn({ boardId: 1, name: "X" } as any)
    ).toBeRejectedWithError("KanbanColumn ID required");

    await expectAsync(
      service.updateKanbanColumn({ id: 1, name: "X" } as any)
    ).toBeRejectedWithError("KanbanColumn boardId required");
  });

  it("updateKanbanColumn: PUT then replace in state", async () => {
    service.reorderKanbanColumns([
      { id: 1, boardId: 2, name: "Old", position: 0 },
    ]);

    const promise = service.updateKanbanColumn({
      id: 1,
      boardId: 2,
      name: "New",
      position: 0,
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/boards/2/kanbanColumns/1`
    );
    expect(req.request.method).toBe("PUT");
    req.flush({ id: 1, boardId: 2, name: "New", position: 0 });

    const updated = await promise;
    expect(updated.name).toBe("New");
    expect(service.kanbanColumns()).toEqual([
      { id: 1, boardId: 2, name: "New", position: 0 },
    ]);
  });

  it("deleteKanbanColumn: DELETE then remove from state", async () => {
    service.reorderKanbanColumns([
      { id: 3, boardId: 9, name: "Col", position: 0 },
    ]);

    const promise = service.deleteKanbanColumn(3, 9);

    const req = httpMock.expectOne(
      `${environment.apiUrl}/boards/9/kanbanColumns/3`
    );
    expect(req.request.method).toBe("DELETE");
    req.flush(null);

    await promise;
    expect(service.kanbanColumns()).toEqual([]);
  });

  it("moveKanbanColumn: PUT /move with 1-based position", async () => {
    const promise = service.moveKanbanColumn(5, 10, 2);
    const req = httpMock.expectOne(
      `${environment.apiUrl}/boards/5/kanbanColumns/move`
    );
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toEqual({ kanbanColumnId: 10, targetPosition: 3 });
    req.flush(null);
    await promise;
  });

  it("draft helpers: insertDraftColumn / replaceRef / removeColumnRef", () => {
    const draft = service.insertDraftColumn(1);
    expect(draft.id).toBeUndefined();
    expect(draft.boardId).toBe(1);
    expect(service.kanbanColumns().length).toBe(1);

    const real: KanbanColumn = { id: 99, boardId: 1, name: "X", position: 0 };
    service.replaceRef(draft, real);
    expect(service.kanbanColumns()).toEqual([real]);

    service.removeColumnRef(real);
    expect(service.kanbanColumns()).toEqual([]);
  });
});
