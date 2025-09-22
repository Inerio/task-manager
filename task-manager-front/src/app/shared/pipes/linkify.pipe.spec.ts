import { TestBed } from "@angular/core/testing";
import { SecurityContext } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { LinkifyPipe } from "./linkify.pipe";

function render(pipe: LinkifyPipe, sanitizer: DomSanitizer, text: string) {
  const safe = pipe.transform(text);
  const html = sanitizer.sanitize(SecurityContext.HTML, safe) ?? "";
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("LinkifyPipe", () => {
  let pipe: LinkifyPipe;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    sanitizer = TestBed.inject(DomSanitizer);
    pipe = TestBed.runInInjectionContext(() => new LinkifyPipe());
  });

  it("converts http/https URLs to anchors and keeps trailing punctuation out", () => {
    const host = render(pipe, sanitizer, "see http://example.com, ok?");
    const a = host.querySelector("a")!;
    expect(a).withContext("anchor not found").toBeTruthy();
    expect(a.getAttribute("href")).toBe("http://example.com");
    expect(host.innerHTML).toContain("</a>, ok?");
  });

  it("prepends https:// for www.* and opens in new tab", () => {
    const host = render(pipe, sanitizer, "visit www.example.org");
    const a = host.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://www.example.org");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("escapes HTML and replaces \\n with <br>", () => {
    const host = render(pipe, sanitizer, "<b>bold</b>\nhttp://x.tld");
    expect(host.querySelector("b")).toBeNull();
    expect(host.innerHTML).toContain("<br>");
    expect(host.querySelector("a")!.getAttribute("href")).toBe("http://x.tld");
  });
});
