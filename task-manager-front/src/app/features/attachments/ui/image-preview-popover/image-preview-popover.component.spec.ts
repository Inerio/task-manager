import { TestBed } from "@angular/core/testing";
import { ImagePreviewPopoverComponent } from "./image-preview-popover.component";

describe("ImagePreviewPopoverComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImagePreviewPopoverComponent],
    });
  });

  it("renders the image when visible=true and url is set", () => {
    const f = TestBed.createComponent(ImagePreviewPopoverComponent);
    Object.assign(f.componentInstance, {
      url: "blob://x",
      x: 10,
      y: 20,
      visible: true,
      alt: "p",
    });
    f.detectChanges();

    const img = f.nativeElement.querySelector("img") as HTMLImageElement;
    const pop = f.nativeElement.querySelector(".popover") as HTMLElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toContain("blob://x");
    expect(pop.style.top).toContain("20px");
    expect(pop.style.left).toContain("10px");
  });

  it("renders nothing when invisible", () => {
    const f = TestBed.createComponent(ImagePreviewPopoverComponent);
    Object.assign(f.componentInstance, {
      url: "u",
      x: 0,
      y: 0,
      visible: false,
    });
    f.detectChanges();
    expect(f.nativeElement.querySelector("img")).toBeNull();
  });
});
