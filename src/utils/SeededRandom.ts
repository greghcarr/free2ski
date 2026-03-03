/**
 * Deterministic pseudo-random number generator using mulberry32.
 * Given the same seed, produces an identical sequence every time —
 * used for reproducible chunk generation and future daily challenges.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Ensure unsigned 32-bit integer
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] (inclusive both ends) */
  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns true with the given probability (0–1) */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Picks a uniformly random element from a non-empty array */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
}
