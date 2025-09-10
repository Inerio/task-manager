import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  inject,
} from "@angular/core";
import { TaskDndService } from "../data/task-dnd.service";

/**
 * Thin DOM glue for task drag & drop.
 * Delegates orchestration to TaskDndService.
 */
@Directive({
  selector: "[appTaskDnd]",
  standalone: true,
})
export class TaskDndDirective implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly dnd = inject(TaskDndService);

  @Input("appTaskDndTaskId") taskId: number | null | undefined = null;
  @Input("appTaskDndColumnId") columnId: number | null | undefined = null;
  @Input("appTaskDndDisabled") disabled: boolean | null | undefined = false;
  @Input("appTaskDndGhost") ghost: boolean | null | undefined = false;

  @Output() taskDraggingChange = new EventEmitter<boolean>();
  @Output() taskPreviewSize = new EventEmitter<{
    width: number;
    height: number;
  }>();

  // Keep native dragging in sync with "disabled"
  @HostBinding("attr.draggable")
  get draggableAttr(): string {
    return !!this.disabled ? "false" : "true";
  }

  ngOnChanges(_changes: SimpleChanges): void {
    // nothing else; HostBinding keeps draggable updated
  }

  @HostListener("dragstart", ["$event"])
  onDragStart(e: DragEvent): void {
    const hostEl = this.host.nativeElement;
    const target = e.target as Element | null;
    const lockedOnHost = hostEl.getAttribute("data-preview-lock") === "1";
    const lockedFromChild = target?.closest?.('[data-preview-lock="1"]');
    if (lockedOnHost || lockedFromChild) {
      e.preventDefault();
      return;
    }
    if (this.disabled || this.ghost) {
      e.preventDefault();
      return;
    }
    const id = this.taskId ?? null;
    const col = this.columnId ?? null;
    if (id == null || col == null) {
      e.preventDefault();
      return;
    }
    this.taskDraggingChange.emit(true);
    this.dnd.start(e, hostEl, id, col, (sz) => this.taskPreviewSize.emit(sz));
  }

  @HostListener("dragend")
  onDragEnd(): void {
    this.dnd.end();
    this.taskDraggingChange.emit(false);
  }
}
