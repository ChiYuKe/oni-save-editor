/** Count completed map draw submissions, rather than timer callbacks. */
export class OniRenderStats {
  private started = 0
  private frames = 0
  private cost = 0
  private value = { fps: 0, renderMs: 0, sampledAt: 0 }
  record(milliseconds: number) { this.frames++; this.cost += milliseconds }
  sample(now: number) {
    if (!this.started) { this.started = now; this.frames = 0; this.cost = 0 }
    const elapsed = now - this.started
    if (elapsed >= 1000) {
      // Background tabs have no useful foreground rate sample.
      this.value = { fps: elapsed > 2500 ? 0 : this.frames * 1000 / elapsed,
        renderMs: this.frames ? this.cost / this.frames : 0, sampledAt: now }
      this.started = now; this.frames = 0; this.cost = 0
    }
    return this.value
  }
}
