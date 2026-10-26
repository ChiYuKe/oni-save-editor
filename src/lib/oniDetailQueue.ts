/** Start nearby, small detail requests before distant artwork; bound network concurrency. */
export class OniDetailQueue {
  private active = 0
  private scheduled = false
  private tasks: Array<{ priority: number; run: () => void }> = []
  private readonly concurrency: number
  constructor(concurrency = 4) { this.concurrency = concurrency }
  enqueue<T>(load: () => Promise<T>, priority: number): Promise<T> {
    return new Promise((resolve, reject) => {
      this.tasks.push({ priority, run: () => { this.active++; Promise.resolve().then(load).then(resolve, reject).finally(() => { this.active--; this.drain() }) } })
      if (!this.scheduled) { this.scheduled = true; queueMicrotask(() => { this.scheduled = false; this.drain() }) }
    })
  }
  private drain() {
    this.tasks.sort((a, b) => a.priority - b.priority)
    while (this.active < this.concurrency && this.tasks.length) this.tasks.shift()!.run()
  }
}
