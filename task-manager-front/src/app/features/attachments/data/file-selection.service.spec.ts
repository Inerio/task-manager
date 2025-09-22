import { FileSelectionService } from "./file-selection.service";

describe("FileSelectionService (accept + size + dedupe)", () => {
  const svc = new FileSelectionService();

  function mkFile(name: string, type: string, size = 1): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  // ---- matchesAccept --------------------------------------------------------
  it("matchesAccept: supports extensions, wildcards and exact MIME", () => {
    const png = mkFile("a.png", "image/png");
    const jpg = mkFile("b.jpg", "image/jpeg");
    const pdf = mkFile("c.pdf", "application/pdf");

    expect(svc.matchesAccept(png, "image/*")).toBeTrue();
    expect(svc.matchesAccept(jpg, ".jpg,.png")).toBeTrue();
    expect(svc.matchesAccept(pdf, "application/pdf,image/*")).toBeTrue();
    expect(svc.matchesAccept(pdf, "image/*")).toBeFalse();
    expect(svc.matchesAccept(png, ".pdf")).toBeFalse();
  });

  // ---- filterBySize ---------------------------------------------------------
  it("filterBySize: keeps files <= max and counts rejected", () => {
    const small = mkFile("s.txt", "text/plain", 3);
    const big = mkFile("b.txt", "text/plain", 10);

    const { accepted, rejectedCount } = svc.filterBySize([small, big], 5);
    expect(accepted.map((f) => f.name)).toEqual(["s.txt"]);
    expect(rejectedCount).toBe(1);
  });

  // ---- dedupe ---------------------------------------------------------------
  it("dedupe: removes files that already exist (by name) and preserves order", () => {
    const res = svc.dedupe(
      [mkFile("x.png", "image/png"), mkFile("y.png", "image/png")],
      ["x.png"]
    );
    expect(res.uniques.map((f) => f.name)).toEqual(["y.png"]);
    expect(res.duplicates).toBe(1);
  });

  // ---- select (pipeline) ----------------------------------------------------
  it("select: accept → size → dedupe with counters", () => {
    const files = [
      mkFile("ok.png", "image/png", 3), // accept + small + unique
      mkFile("large.jpg", "image/jpeg", 10), // too large
      mkFile("dup.pdf", "application/pdf", 5), // duplicate name
      mkFile("nope.txt", "text/plain", 1), // not accepted
    ];

    const { accepted, rejected } = svc.select(files, {
      accept: "image/*,application/pdf",
      maxSize: 5,
      existing: ["dup.pdf"],
    });

    expect(accepted.map((f) => f.name)).toEqual(["ok.png"]);
    expect(rejected).toEqual({ tooLarge: 1, notAccepted: 1, duplicated: 1 });
  });
});
