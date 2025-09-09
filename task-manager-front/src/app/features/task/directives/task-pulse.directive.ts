import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
} from "@angular/core";
import { DragDropGlobalService } from "../../../core/services/dnd/drag-drop-global.service";

/**
 * Per-card pulse (drop/create/save).
 * Uses signal inputs so effects react to @Input changes (e.g. dragging()).
 */
@Directive({
  selector: "[appTaskPulse]",
  standalone: true,
})
export class TaskPulseDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly drag = inject(DragDropGlobalService);

  /** The task id represented by the host card. */
  readonly taskId = input<number | null>(null, { alias: "appTaskPulseTaskId" });

  /** If true, no pulse is emitted (used for ghost placeholders). */
  readonly ghost = input<boolean>(false, { alias: "appTaskPulseGhost" });

  /** When true, "drop" pulse is deferred (e.g. while dragging). */
  readonly deferWhile = input<boolean>(false, {
    alias: "appTaskPulseDeferWhile",
  });

  private last = { drop: 0, created: 0, saved: 0 };
  private pendingDropToken: number | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Drop pulse (defer while the host is the drag source).
    effect(() => {
      const id = this.taskId();
      if (id == null || this.ghost()) return;

      const d = this.drag.lastDroppedTask();
      if (d && d.id === id && d.token !== this.last.drop) {
        if (this.deferWhile()) {
          this.pendingDropToken = d.token;
        } else {
          this.triggerPulse();
          this.last.drop = d.token;
        }
      }
    });

    // Release deferred drop pulse as soon as deferWhile becomes false.
    effect(() => {
      const id = this.taskId();
      if (id == null || this.ghost()) return;

      const canRelease = !this.deferWhile() && this.pendingDropToken;
      if (canRelease) {
        this.triggerPulse();
        this.last.drop = this.pendingDropToken!;
        this.pendingDropToken = null;
      }
    });

    // Created / saved pulses (not tied to dragging).
    effect(() => {
      const id = this.taskId();
      if (id == null || this.ghost()) return;

      const c = this.drag.lastCreatedTask();
      if (c && c.id === id && c.token !== this.last.created) {
        this.triggerPulse();
        this.last.created = c.token;
      }

      const s = this.drag.lastSavedTask();
      if (s && s.id === id && s.token !== this.last.saved) {
        this.triggerPulse();
        this.last.saved = s.token;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pulseTimer) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  /** Restart the CSS animation by toggling the class with a forced reflow. */
  private triggerPulse(): void {
    const el = this.host.nativeElement;
    if (this.pulseTimer) clearTimeout(this.pulseTimer);

    el.classList.remove("dropped-pulse");
    void el.offsetWidth; // reflow to flush removal

    requestAnimationFrame(() => {
      el.classList.add("dropped-pulse");
      this.pulseTimer = setTimeout(() => {
        el.classList.remove("dropped-pulse");
      }, 950);
    });
  }
}
