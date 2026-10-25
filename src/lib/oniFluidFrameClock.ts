export const ONI_FLUID_TARGET_FPS = 114

/** Preserve cadence across display refreshes instead of rounding 114 down to 60. */
export class OniFluidFrameClock {
  private deadline = Number.NEGATIVE_INFINITY
  private averageCost = 0

  shouldRender(now: number): boolean {
    if (!Number.isFinite(now)) return false
    const interval = Math.max(1000 / ONI_FLUID_TARGET_FPS, this.averageCost * 1.2)
    if (now + .1 < this.deadline) return false
    // Resume after a background tab or a long build without catch-up frames.
    if (now - this.deadline > interval * 4) this.deadline = now
    this.deadline += interval
    return true
  }

  recordCost(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return
    this.averageCost = this.averageCost * .8 + Math.min(milliseconds, 100) * .2
  }
}
