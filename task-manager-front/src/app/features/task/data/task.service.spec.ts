import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import {
  HttpClientTestingModule,
  HttpTestingController,
} from "@angular/common/http/testing";
import { TaskService } from "./task.service";
import { TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../../core/services/alert.service";
import { environment } from "../../../../environments/environment";
import type { Task } from "../models/task.model";

class TranslocoStub {
  translate(key: string): string {
    return key;
  }
}
class AlertServiceStub {
  show = jasmine.createSpy("show");
}

describe("TaskService", () => {
  let service: TaskService;
  let http: HttpTestingController;

  const API = `${environment.apiUrl}/tasks`;

  const sample: Task[] = [
    {
      id: 1,
      kanbanColumnId: 10,
      position: 0,
      title: "A",
      description: "",
      completed: false,
    },
    {
      id: 2,
      kanbanColumnId: 11,
      position: 0,
      title: "B",
      description: "",
      completed: false,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskService,
        { provide: TranslocoService, useClass: TranslocoStub },
        { provide: AlertService, useClass: AlertServiceStub },
      ],
    });

    service = TestBed.inject(TaskService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it("loadTasks() populates the signal and sets loaded=true", () => {
    service.loadTasks();

    const req = http.expectOne(API);
    expect(req.request.method).toBe("GET");
    req.flush(sample);

    expect(service.loaded()).toBeTrue();
    expect(service.tasks()).toEqual(sample);
  });

  it("loadTasks() does not refetch when already loaded, unless force=true", () => {
    service.loadTasks();
    http.expectOne(API).flush(sample);
    service.loadTasks();
    http.expectNone(API);
    const newer: Task[] = [
      {
        id: 3,
        kanbanColumnId: 10,
        position: 0,
        title: "C",
        description: "",
        completed: false,
      },
    ];
    service.loadTasks({ force: true });
    http.expectOne(API).flush(newer);

    expect(service.tasks()).toEqual(newer);
  });

  it("getTasksByKanbanColumnId() returns a reactive filtered signal", () => {
    service.loadTasks();
    http.expectOne(API).flush(sample);

    const only10 = service.getTasksByKanbanColumnId(10);
    expect(only10().map((t) => t.id)).toEqual([1]);
  });

  it("reorderTasks() updates signal immediately (optimistic)", fakeAsync(() => {
    service.loadTasks();
    http.expectOne(API).flush(sample);

    const reordered = [{ ...sample[0], position: 1 }, { ...sample[1], position: 0 }];
    service.reorderTasks(reordered);

    // Signal should be updated immediately (before microtask flush)
    const tasks = service.tasks();
    const task1 = tasks.find((t) => t.id === 1);
    expect(task1?.position).toBe(1);

    // Flush the promise microtask so the queued HTTP call fires
    tick();

    const req = http.expectOne(`${API}/reorder`);
    expect(req.request.method).toBe("PUT");
    req.flush(null);
    tick();
  }));

  it("loadTasks(force) is deferred while reorder is in-flight", fakeAsync(() => {
    service.loadTasks();
    http.expectOne(API).flush(sample);

    // Start a reorder (optimistic + queue HTTP)
    service.reorderTasks([{ ...sample[0], position: 1 }]);
    tick(); // flush microtask → HTTP PUT fires

    // SSE-triggered reload should be deferred (queue busy)
    service.loadTasks({ force: true });

    // Only the reorder PUT should be pending, no GET
    const reorderReq = http.expectOne(`${API}/reorder`);
    http.expectNone(API);

    // Complete the reorder
    reorderReq.flush(null);
    tick(); // flush .finally() → deferred reload fires

    // Now the deferred reload should have fired
    const reloadReq = http.expectOne(API);
    reloadReq.flush(sample);
  }));
});
