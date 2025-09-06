export class ColumnAutoScroller {
  private host: HTMLElement | null = null;
  private frame: number | null = null;
  private dir: -1 | 0 | 1 = 0;
  private lastY = 0;

  /** Attach the scrollable host element. */
  attachHost(el: HTMLElement | null): void {
    this.host = el;
  }

  /** Update pointer Y and recompute autoscroll intent. */
  updateFromPointerY(y: number): void {
    this.lastY = y;
    this.updateDirection();
  }

  /** Stop any ongoing autoscroll loop. */
  stop(): void {
    if (this.frame != null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.dir = 0;
  }

  // ---- internal helpers ----

  private updateDirection(): void {
    const host = this.host;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    const threshold = 64; // px from top/bottom to trigger
    const y = this.lastY;

    let next: -1 | 0 | 1 = 0;
    const canUp = host.scrollTop > 0;
    const canDown = host.scrollTop + host.clientHeight < host.scrollHeight;

    if (y - rect.top < threshold && canUp) next = -1;
    else if (rect.bottom - y < threshold && canDown) next = 1;

    if (next !== this.dir) {
      this.dir = next;
      if (next === 0) this.stop();
      else this.startLoop();
    }
  }

  private startLoop(): void {
    if (this.frame != null) return;

    const step = () => {
      const host = this.host;
      if (!host || this.dir === 0) {
        this.stop();
        return;
      }

      const rect = host.getBoundingClientRect();
      const threshold = 64;
      const y = this.lastY;
      const edgeDist =
        this.dir < 0 ? Math.max(0, y - rect.top) : Math.max(0, rect.bottom - y);
      const ratio = Math.max(
        0,
        Math.min(1, (threshold - edgeDist) / threshold)
      );
      const delta = 4 + Math.round(ratio * 16); // 4..20 px per frame

      host.scrollTop += this.dir * delta;
      this.frame = requestAnimationFrame(step);
    };

    this.frame = requestAnimationFrame(step);
  }
}
