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
import { AttachmentService } from "./attachment.service";
import { environment } from "../../../../environments/environment";
import { TranslocoService } from "@jsverse/transloco";
import { AlertService } from "../../../core/services/alert.service";
import { Task } from "../../task/models/task.model";

describe("AttachmentService (HTTP + blob utilities)", () => {
  const translocoStub = { translate: (k: string) => k };
  const alertStub = { show: jasmine.createSpy("show") };

  let service: AttachmentService;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AttachmentService,
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        { provide: TranslocoService, useValue: translocoStub },
        { provide: AlertService, useValue: alertStub },
      ],
    });
    service = TestBed.inject(AttachmentService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    alertStub.show.calls.reset();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("buildAttachmentUrl: composes correct URL", () => {
    const url = service.buildAttachmentUrl(12, "file name.png");
    expect(url).toBe(
      `${environment.apiUrl}/tasks/12/attachments/file%20name.png`
    );
  });

  it("getPreviewObjectUrl: returns object URL and respects server type", async () => {
    const createSpy = spyOn(URL, "createObjectURL").and.returnValue("blob:42");

    const p = service.getPreviewObjectUrl(5, "pic.png");
    const req = httpMock.expectOne(
      `${environment.apiUrl}/tasks/5/attachments/pic.png`
    );
    expect(req.request.responseType).toBe("blob");

    const serverBlob = new Blob(["abc"], { type: "image/png" });
    req.flush(serverBlob);

    const url = await p;
    expect(url).toBe("blob:42");
    expect(createSpy).toHaveBeenCalled();
  });

  it("getPreviewObjectUrl: infers type when missing", async () => {
    spyOn(URL, "createObjectURL").and.callFake((b: Blob) => {
      expect(b.type).toBe("image/png");
      return "blob:x";
    });

    const p = service.getPreviewObjectUrl(1, "x.png");
    const req = httpMock.expectOne(
      `${environment.apiUrl}/tasks/1/attachments/x.png`
    );

    const serverBlob = new Blob(["x"], { type: "" });
    req.flush(serverBlob);

    const url = await p;
    expect(url).toBe("blob:x");
  });

  it("uploadAttachment: POST FormData and return updated Task", async () => {
    const file = new File([new Uint8Array([1, 2])], "a.txt", {
      type: "text/plain",
    });
    const promise = service.uploadAttachment(7, file);

    const req = httpMock.expectOne(`${environment.apiUrl}/tasks/7/attachments`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body instanceof FormData).toBeTrue();

    const updated: Task = {
      id: 5,
      kanbanColumnId: 1,
      title: "t",
      description: "",
      completed: false,
      attachments: ["a.txt"],
    };
    req.flush(updated);

    const out = await promise;
    expect(out).toEqual(updated);
  });

  it("uploadAttachment: on error -> alert and return null", async () => {
    const file = new File([new Uint8Array([1])], "b.txt");
    const promise = service.uploadAttachment(9, file);

    const req = httpMock.expectOne(`${environment.apiUrl}/tasks/9/attachments`);
    req.flush("boom", { status: 500, statusText: "Server Error" });

    const out = await promise;
    expect(out).toBeNull();
    expect(alertStub.show).toHaveBeenCalledWith(
      "error",
      "attachments.errors.upload"
    );
  });

  it("downloadAttachment: triggers a browser download and revokes URL", () => {
    const revokeSpy = spyOn(URL, "revokeObjectURL").and.stub();
    const createSpy = spyOn(URL, "createObjectURL").and.returnValue("blob:dl");
    const anchor = document.createElement("a");
    const clickSpy = spyOn(anchor, "click").and.stub();
    const createElSpy = spyOn(document, "createElement")
      .withArgs("a")
      .and.returnValue(anchor);

    service.downloadAttachment(3, "doc.pdf");

    const req = httpMock.expectOne(
      `${environment.apiUrl}/tasks/3/attachments/doc.pdf`
    );
    req.flush(new Blob(["data"], { type: "application/pdf" }));

    expect(createElSpy).toHaveBeenCalledWith("a");
    expect(createSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith("blob:dl");
  });

  it("downloadAttachment: on error -> alert", () => {
    service.downloadAttachment(4, "x.pdf");
    const req = httpMock.expectOne(
      `${environment.apiUrl}/tasks/4/attachments/x.pdf`
    );

    req.error(new ProgressEvent("error"), {
      status: 404,
      statusText: "Not Found",
    });
    expect(alertStub.show).toHaveBeenCalledWith(
      "error",
      "attachments.errors.download"
    );
  });

  it("deleteAttachment: DELETE returns updated Task", async () => {
    const promise = service.deleteAttachment(1, "x.png");
    const req = httpMock.expectOne(
      `${environment.apiUrl}/tasks/1/attachments/x.png`
    );
    expect(req.request.method).toBe("DELETE");

    const updated: Task = {
      id: 1,
      kanbanColumnId: 2,
      title: "t",
      description: "",
      completed: false,
      attachments: [],
    };
    req.flush(updated);

    const out = await promise;
    expect(out).toEqual(updated);
  });

  it("deleteAttachment: on error -> alert and null", async () => {
    const promise = service.deleteAttachment(2, "y.png");
    const req = httpMock.expectOne(
      `${environment.apiUrl}/tasks/2/attachments/y.png`
    );
    req.flush("boom", { status: 500, statusText: "Server Error" });

    const out = await promise;
    expect(out).toBeNull();
    expect(alertStub.show).toHaveBeenCalledWith(
      "error",
      "attachments.errors.delete"
    );
  });
});
