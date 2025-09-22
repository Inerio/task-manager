import { TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { BoardColumnsEditService } from "./board-columns-edit.service";
import { KanbanColumnService } from "./kanban-column.service";
import { TaskService } from "../../task/data/task.service";
import { ConfirmDialogService } from "../../../core/services/dialog/confirm-dialog.service";
import { AlertService } from "../../../core/services/alert.service";
import { TranslocoService } from "@jsverse/transloco";
import type { KanbanColumn } from "../models/kanban-column.model";

describe("BoardColumnsEditService (state logic, no HTTP)", () => {
  let svc: BoardColumnsEditService;

  const translocoStub = { translate: (k: string) => k };
  const alertStub = { show: jasmine.createSpy("show") };
  const colsSig = signal<KanbanColumn[]>([]);
  const columnsStub = {
    kanbanColumns: colsSig,
    createKanbanColumn: jasmine
      .createSpy("createKanbanColumn")
      .and.callFake(async (name: string, boardId: number) => {
        const created: KanbanColumn = {
          id: Math.floor(Math.random() * 10000) + 1,
          boardId,
          name,
          position: colsSig().length,
        };
        colsSig.set([...colsSig(), created]);
        return created;
      }),
    updateKanbanColumn: jasmine
      .createSpy("updateKanbanColumn")
      .and.callFake(async (col: KanbanColumn) => {
        colsSig.set(colsSig().map((c) => (c.id === col.id ? col : c)));
        return col;
      }),
    deleteKanbanColumn: jasmine
      .createSpy("deleteKanbanColumn")
      .and.callFake(async (id: number, _boardId: number) => {
        colsSig.set(colsSig().filter((c) => c.id !== id));
      }),
    removeColumnRef: jasmine
      .createSpy("removeColumnRef")
      .and.callFake((ref: KanbanColumn) => {
        colsSig.set(colsSig().filter((c) => c !== ref));
      }),
    reorderKanbanColumns: jasmine
      .createSpy("reorderKanbanColumns")
      .and.callFake((arr: KanbanColumn[]) => colsSig.set(arr)),
  } as unknown as KanbanColumnService;

  const tasksStub = {
    deleteTasksByKanbanColumnId: jasmine
      .createSpy("deleteTasksByKanbanColumnId")
      .and.callFake(async () => {}),
  } as unknown as TaskService;

  const confirmStub = {
    open: jasmine.createSpy("open").and.callFake(async () => true),
  } as unknown as ConfirmDialogService;

  beforeEach(() => {
    colsSig.set([]);
    (columnsStub.createKanbanColumn as jasmine.Spy).calls.reset?.();
    (columnsStub.updateKanbanColumn as jasmine.Spy).calls.reset?.();
    (columnsStub.deleteKanbanColumn as jasmine.Spy).calls.reset?.();
    (columnsStub.removeColumnRef as jasmine.Spy).calls.reset?.();
    (columnsStub.reorderKanbanColumns as jasmine.Spy).calls.reset?.();
    (tasksStub.deleteTasksByKanbanColumnId as jasmine.Spy).calls.reset?.();
    (confirmStub.open as jasmine.Spy).calls.reset?.();
    alertStub.show.calls.reset();

    TestBed.configureTestingModule({
      providers: [
        BoardColumnsEditService,
        { provide: KanbanColumnService, useValue: columnsStub },
        { provide: TaskService, useValue: tasksStub },
        { provide: ConfirmDialogService, useValue: confirmStub },
        { provide: AlertService, useValue: alertStub },
        { provide: TranslocoService, useValue: translocoStub },
      ],
    });

    svc = TestBed.inject(BoardColumnsEditService);
  });

  it("addKanbanColumnAndEdit: creates an empty column and enters edit mode", async () => {
    await svc.addKanbanColumnAndEdit(1);

    expect(
      columnsStub.createKanbanColumn as jasmine.Spy
    ).toHaveBeenCalledOnceWith("", 1);
    const created = colsSig()[colsSig().length - 1];
    expect(svc.editingColumn()).toEqual(created);
    expect(svc.editingTitleValue()).toBe(created.name);
  });

  it("deleteKanbanColumn: confirms then deletes (ignores if an edit is in progress)", async () => {
    const draft: KanbanColumn = { boardId: 9, name: "" };
    (svc as any).editingColumn.set(draft);
    await svc.deleteKanbanColumn(10, "X", 9);
    expect(
      columnsStub.deleteKanbanColumn as jasmine.Spy
    ).not.toHaveBeenCalled();
    (svc as any).editingColumn.set(null);
    (confirmStub.open as jasmine.Spy).and.resolveTo(true);

    await svc.deleteKanbanColumn(10, "X", 9);
    expect(confirmStub.open).toHaveBeenCalled();
    expect(
      columnsStub.deleteKanbanColumn as jasmine.Spy
    ).toHaveBeenCalledOnceWith(10, 9);
  });

  it("deleteAllInColumn: confirms then deletes tasks; on error -> toast", async () => {
    (confirmStub.open as jasmine.Spy).and.resolveTo(true);
    (tasksStub.deleteTasksByKanbanColumnId as jasmine.Spy).and.resolveTo();

    await svc.deleteAllInColumn(5, "Todo");
    expect(
      tasksStub.deleteTasksByKanbanColumnId as jasmine.Spy
    ).toHaveBeenCalledOnceWith(5);
    (tasksStub.deleteTasksByKanbanColumnId as jasmine.Spy).and.callFake(
      async () => {
        throw new Error("fail");
      }
    );
    await svc.deleteAllInColumn(6, "Doing");
    expect(alertStub.show).toHaveBeenCalledWith(
      "error",
      "errors.deletingTasksInColumn"
    );
  });

  it("startEditTitle: initializes signals (rows=2 if host spans multiple lines)", () => {
    const col: KanbanColumn = { id: 1, boardId: 1, name: "Hello" };
    const host = document.createElement("div");
    Object.defineProperty(host, "clientHeight", { value: 50 });
    spyOn(window, "getComputedStyle").and.returnValue({
      lineHeight: "20px",
      paddingTop: "0px",
      paddingBottom: "0px",
    } as any);

    svc.startEditTitle(col, host);

    expect(svc.editingColumn()).toEqual(col);
    expect(svc.editingTitleValue()).toBe("Hello");
    expect(svc.editingRows()).toBe(2);
  });

  it("saveTitleEdit (draft): creates, removes draft ref and preserves position via reorder", async () => {
    const boardId = 1;
    const draft: KanbanColumn = { boardId, name: "" };
    colsSig.set([
      draft,
      { id: 2, boardId, name: "B" },
      { id: 3, boardId, name: "C" },
    ]);
    (svc as any).editingColumn.set(draft);
    (svc as any).editingTitleValue.set("New");
    await svc.saveTitleEdit(draft, boardId);
    expect(
      columnsStub.createKanbanColumn as jasmine.Spy
    ).toHaveBeenCalledOnceWith("New", boardId);
    expect(columnsStub.removeColumnRef as jasmine.Spy).toHaveBeenCalledWith(
      draft
    );
    const ids = colsSig().map((c) => c.id ?? -1);
    expect(ids[0]).toBeGreaterThan(0);
  });

  it("saveTitleEdit (persisted): updates the name then clears the editing state", async () => {
    const boardId = 2;
    const col: KanbanColumn = { id: 10, boardId, name: "Old" };
    colsSig.set([col]);

    (svc as any).editingColumn.set(col);
    (svc as any).editingTitleValue.set("NewName");

    await svc.saveTitleEdit(col, boardId);

    expect(columnsStub.updateKanbanColumn as jasmine.Spy).toHaveBeenCalled();
    expect(svc.editingColumn()).toBeNull();
    expect(svc.editingTitleValue()).toBe("");
    expect(svc.editingRows()).toBe(1);
  });

  it("cancelTitleEdit: delegates to saveTitleEdit with the current column", async () => {
    const col: KanbanColumn = { id: 1, boardId: 1, name: "X" };
    (svc as any).editingColumn.set(col);
    const spy = spyOn<any>(svc as any, "saveTitleEdit").and.resolveTo();

    svc.cancelTitleEdit();
    expect(spy).toHaveBeenCalled();
  });

  it("effect: if the draft disappears from the list -> automatic commit", async () => {
    const boardId = 3;
    const draft: KanbanColumn = { boardId, name: "" };
    colsSig.set([draft]);
    (svc as any).editingColumn.set(draft);
    (svc as any).editingTitleValue.set("AutoCommit");
    colsSig.set([]);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();

    expect(columnsStub.createKanbanColumn as jasmine.Spy).toHaveBeenCalledWith(
      "AutoCommit",
      boardId
    );
    expect(svc.editingColumn()).toBeNull();
    expect(svc.editingTitleValue()).toBe("");
  });
});
