import { TestBed } from "@angular/core/testing";
import { ConfirmDialogService } from "./confirm-dialog.service";

describe("ConfirmDialogService (headless)", () => {
  let svc: ConfirmDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ConfirmDialogService);
  });

  it("open → confirm resolves true and closes", async () => {
    const p = svc.open("boards.column.delete", "boards.column.deleteTasks*");
    expect(svc.state().visible).toBeTrue();
    expect(svc.state().title).toBe("boards.column.delete");
    expect(svc.state().message).toBe("boards.column.deleteTasks*");

    svc.confirm();
    await expectAsync(p).toBeResolvedTo(true);
    expect(svc.state().visible).toBeFalse();
    expect(svc.state().resolve).toBeUndefined();
  });

  it("open → cancel resolves false and closes", async () => {
    const p = svc.open("t", "m");
    svc.cancel();
    await expectAsync(p).toBeResolvedTo(false);
    expect(svc.state().visible).toBeFalse();
  });

  it("reentrancy: opening another dialog cancels the previous (resolves false)", async () => {
    const p1 = svc.open("first", "m1");
    const p2 = svc.open("second", "m2", {
      confirmText: "Yes",
      cancelText: "No",
      allowEnterConfirm: false,
    });

    await expectAsync(p1).toBeResolvedTo(false);
    expect(svc.state().visible).toBeTrue();
    expect(svc.state().title).toBe("second");
    expect(svc.state().message).toBe("m2");
    expect(svc.state().confirmText).toBe("Yes");
    expect(svc.state().cancelText).toBe("No");
    expect(svc.state().allowEnterConfirm).toBeFalse();

    svc.cancel();
    await expectAsync(p2).toBeResolvedTo(false);
    expect(svc.state().visible).toBeFalse();
    // options reset on close
    expect(svc.state().confirmText).toBeUndefined();
    expect(svc.state().cancelText).toBeUndefined();
    expect(svc.state().allowEnterConfirm).toBeTrue();
  });

  it("confirm() when not visible is a no-op", async () => {
    // Nothing open; confirm shouldn't throw or change state
    svc.confirm();
    expect(svc.state().visible).toBeFalse();
  });

  it("cancel() when not visible is a no-op", async () => {
    svc.cancel();
    expect(svc.state().visible).toBeFalse();
  });
});
