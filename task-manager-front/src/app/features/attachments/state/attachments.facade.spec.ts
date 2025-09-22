import { TestBed } from "@angular/core/testing";
import { TaskAttachmentsFacade } from "./attachments.facade";
import { AttachmentService } from "../data/attachment.service";
import { TaskService } from "../../task/data/task.service";
import type { Task } from "../../task/models/task.model";

describe("TaskAttachmentsFacade (signals + helpers, no HTTP)", () => {
  const attachmentStub = {
    uploadAttachment: jasmine.createSpy("uploadAttachment"),
    deleteAttachment: jasmine.createSpy("deleteAttachment"),
    downloadAttachment: jasmine.createSpy("downloadAttachment"),
  };

  const taskStub = {
    fetchTaskById: jasmine.createSpy("fetchTaskById"),
    updateTaskFromApi: jasmine.createSpy("updateTaskFromApi"),
  };

  let facade: TaskAttachmentsFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TaskAttachmentsFacade,
        { provide: AttachmentService, useValue: attachmentStub },
        { provide: TaskService, useValue: taskStub },
      ],
    });
    facade = TestBed.inject(TaskAttachmentsFacade);

    attachmentStub.uploadAttachment.calls.reset();
    attachmentStub.deleteAttachment.calls.reset();
    attachmentStub.downloadAttachment.calls.reset();
    taskStub.fetchTaskById.calls.reset();
    taskStub.updateTaskFromApi.calls.reset();
  });

  function mkFile(name: string, size = 1, type = "text/plain"): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  it("pendingFiles: starts empty and is readonly", () => {
    const sig = facade.pendingFiles();
    expect(sig()).toEqual([]);
  });

  it("buffer: appends uniques by file name and keeps order", () => {
    const sig = facade.pendingFiles();
    facade.buffer([mkFile("a.txt"), mkFile("b.txt")]);
    facade.buffer([mkFile("b.txt"), mkFile("c.txt")]);

    expect(sig().map((f) => f.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("removeFromBuffer & flushBuffer", () => {
    const sig = facade.pendingFiles();
    facade.buffer([mkFile("a.txt"), mkFile("b.txt")]);

    facade.removeFromBuffer("a.txt");
    expect(sig().map((f) => f.name)).toEqual(["b.txt"]);

    facade.flushBuffer();
    expect(sig()).toEqual([]);
  });

  it("uploadForTask: uploads all files then refetches + syncs store, returns fresh task", async () => {
    const files = [mkFile("a.txt"), mkFile("b.txt")];

    attachmentStub.uploadAttachment.and.resolveTo(null);
    const fresh: Task = {
      id: 1,
      kanbanColumnId: 10,
      title: "T",
      description: "",
      completed: false,
      attachments: ["a.txt", "b.txt"],
    };
    taskStub.fetchTaskById.and.resolveTo(fresh);

    const out = await facade.uploadForTask(1, files);

    expect(attachmentStub.uploadAttachment).toHaveBeenCalledTimes(2);
    expect(attachmentStub.uploadAttachment.calls.allArgs()).toEqual([
      [1, files[0]],
      [1, files[1]],
    ]);

    expect(taskStub.fetchTaskById).toHaveBeenCalledOnceWith(1);
    expect(taskStub.updateTaskFromApi).toHaveBeenCalledOnceWith(fresh);
    expect(out).toEqual(fresh);
  });

  it("uploadForTask: early-returns null when taskId or files missing", async () => {
    const f = mkFile("x.txt");
    expect(await facade.uploadForTask(0 as any, [f])).toBeNull();
    expect(await facade.uploadForTask(1, [])).toBeNull();

    expect(attachmentStub.uploadAttachment).not.toHaveBeenCalled();
    expect(taskStub.fetchTaskById).not.toHaveBeenCalled();
    expect(taskStub.updateTaskFromApi).not.toHaveBeenCalled();
  });

  it("delete: deletes attachment then syncs store and returns updated task", async () => {
    const updated: Task = {
      id: 2,
      kanbanColumnId: 9,
      title: "U",
      description: "",
      completed: false,
      attachments: [],
    };
    attachmentStub.deleteAttachment.and.resolveTo(updated);

    const out = await facade.delete(2, "img.png");

    expect(attachmentStub.deleteAttachment).toHaveBeenCalledOnceWith(
      2,
      "img.png"
    );
    expect(taskStub.updateTaskFromApi).toHaveBeenCalledOnceWith(updated);
    expect(out).toEqual(updated);
  });

  it("delete: early-returns null on invalid args", async () => {
    expect(await facade.delete(0 as any, "a")).toBeNull();
    expect(await facade.delete(1, "")).toBeNull();
    expect(attachmentStub.deleteAttachment).not.toHaveBeenCalled();
    expect(taskStub.updateTaskFromApi).not.toHaveBeenCalled();
  });

  it("download: delegates to service", () => {
    facade.download(3, "doc.pdf");
    expect(attachmentStub.downloadAttachment).toHaveBeenCalledOnceWith(
      3,
      "doc.pdf"
    );
  });
});
