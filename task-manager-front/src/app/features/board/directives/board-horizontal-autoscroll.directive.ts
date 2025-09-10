import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  effect,
} from "@angular/core";
import { DragDropGlobalService } from "../../../core/services/dnd/drag-drop-global.service";
import { BoardAutoScroller } from "../utils/board-auto-scroll";

/**
 * Makes the columns viewport auto-scroll horizontally when the pointer is near
 * the left/right edges during a task or column drag.
 *
 * Note: we listen on both the host and the document to keep it responsive even
 * when child elements call preventDefault() on dragover.
 */
@Directive({
  selector: "[appBoardAutoScroll]",
  standalone: true,
})
export class BoardHorizontalAutoScrollDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly drag = inject(DragDropGlobalService);
  private readonly scroller = new BoardAutoScroller();

  constructor() {
    this.scroller.attachHost(this.host.nativeElement);
    effect(() => {
      if (!this.drag.isDragging()) this.scroller.stop();
    });
  }

  ngOnDestroy(): void {
    this.scroller.stop();
  }

  @HostListener("dragover", ["$event"])
  onHostDragOver(e: DragEvent): void {
    if (!this.drag.isTaskDrag() && !this.drag.isColumnDrag()) return;
    this.scroller.updateFromPointerX(e.clientX);
  }

  @HostListener("document:dragover", ["$event"])
  onDocDragOver(e: DragEvent): void {
    if (!this.drag.isTaskDrag() && !this.drag.isColumnDrag()) return;
    this.scroller.updateFromPointerX(e.clientX);
  }

  @HostListener("drop")
  @HostListener("dragleave")
  @HostListener("dragend")
  stop(): void {
    this.scroller.stop();
  }
}
