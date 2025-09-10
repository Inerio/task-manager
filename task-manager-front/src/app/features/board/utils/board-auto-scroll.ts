// Lightweight horizontal autoscroller for the board area.
// Same spirit as ColumnAutoScroller (rAF loop + edge-based speed).

export class BoardAutoScroller {
  private host: HTMLElement | null = null;
  private rafId: number | null = null;

  // Tuning: dynamic edge based on viewport width (works better on mobile).
  // Edge = clamp(96px, 18% of width, 240px)
  private edgePx = 120;
  private readonly MIN_PX = 4; // per frame at ~60fps
  private readonly MAX_PX = 28; // per frame at ~60fps

  attachHost(el: HTMLElement | null): void {
    this.host = el;
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Called on any dragover with current pointer X (clientX). */
  updateFromPointerX(clientX: number): void {
    const host = this.host;
    if (!host) return;

    const rect = host.getBoundingClientRect();

    // Recompute edge adaptively (responsive feel).
    const width = rect.width || host.clientWidth || window.innerWidth;
    this.edgePx = Math.max(96, Math.min(240, Math.round(width * 0.18)));

    const leftDist = clientX - rect.left;
    const rightDist = rect.right - clientX;

    let dir = 0;
    let ratio = 0;

    if (leftDist < this.edgePx) {
      dir = -1;
      ratio = (this.edgePx - Math.max(0, leftDist)) / this.edgePx;
    } else if (rightDist < this.edgePx) {
      dir = 1;
      ratio = (this.edgePx - Math.max(0, rightDist)) / this.edgePx;
    }

    if (dir === 0 || ratio <= 0) {
      this.stop();
      return;
    }

    // Ease-in curve: feel more aggressive near the edge.
    const eased = Math.min(1, Math.pow(ratio, 0.75));
    const speed = this.MIN_PX + (this.MAX_PX - this.MIN_PX) * eased;

    // If a loop is running, let it reuse the new `speed` via closure.
    if (this.rafId !== null) return;

    const step = () => {
      if (!this.host) {
        this.stop();
        return;
      }

      const maxScroll = host.scrollWidth - host.clientWidth;
      if (maxScroll <= 0) {
        this.stop();
        return;
      }

      const next = host.scrollLeft + dir * speed;
      const clamped = Math.max(0, Math.min(next, maxScroll));
      host.scrollLeft = clamped;

      this.rafId = requestAnimationFrame(step);
    };

    this.rafId = requestAnimationFrame(step);
  }
}
