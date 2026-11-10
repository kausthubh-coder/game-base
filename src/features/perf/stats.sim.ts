// Frame-time numbers for the meter: the average frame rate and the worst 1 percent.
// It keeps the last few hundred frames in a ring and allocates nothing after it is made.

export class FrameStats {
  private readonly times: Float32Array;
  private readonly sorted: Float32Array;
  private next = 0;
  private count = 0;

  /** `capacity` is how many frames it remembers. 600 is ten seconds at 60 frames a second. */
  constructor(capacity = 600) {
    this.times = new Float32Array(capacity);
    this.sorted = new Float32Array(capacity);
  }

  /** Adds one frame, by how long it took in milliseconds. */
  push(ms: number): void {
    this.times[this.next] = ms;
    this.next = (this.next + 1) % this.times.length;
    if (this.count < this.times.length) this.count++;
  }

  clear(): void {
    this.next = 0;
    this.count = 0;
  }

  get frames(): number {
    return this.count;
  }

  /** The mean frame time in milliseconds over the last `frames` frames (all of them by default). */
  meanMs(frames = this.count): number {
    const n = Math.min(frames, this.count);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 1; i <= n; i++) sum += this.times[(this.next - i + this.times.length) % this.times.length];
    return sum / n;
  }

  /** Frames per second over the last `frames` frames. */
  fps(frames = this.count): number {
    const ms = this.meanMs(frames);
    return ms > 0 ? 1000 / ms : 0;
  }

  /** The frame rate of the slowest 1 percent of frames: what a stutter feels like. */
  low1Fps(): number {
    const ms = this.worstMs(0.01);
    return ms > 0 ? 1000 / ms : 0;
  }

  /** The mean time of the slowest `share` of frames, in milliseconds. */
  worstMs(share: number): number {
    const n = this.count;
    if (n === 0) return 0;
    const sorted = this.sorted.subarray(0, n);
    sorted.set(this.count < this.times.length ? this.times.subarray(0, n) : this.times);
    sorted.sort();
    const take = Math.max(1, Math.round(n * share));
    let sum = 0;
    for (let i = n - take; i < n; i++) sum += sorted[i];
    return sum / take;
  }
}
