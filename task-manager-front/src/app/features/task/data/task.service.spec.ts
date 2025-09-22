import { TestBed } from "@angular/core/testing";
import {
  HttpClientTestingModule,
  HttpTestingController,
} from "@angular/common/http/testing";
import { TaskService } from "./task.service";
import { TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../../core/services/alert.service";
import { LoadingService } from "../../../core/services/loading.service";
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
class LoadingServiceStub {
  wrap$<T>(src: import("rxjs").Observable<T>): import("rxjs").Observable<T> {
    return src;
  }
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
        { provide: LoadingService, useClass: LoadingServiceStub },
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
});
