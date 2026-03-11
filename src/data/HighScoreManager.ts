import { GameMode } from '@/config/GameModes';
import { EMPTY_SAVE, type RunRecord, type SaveData } from './SaveData';
import { getDailySeed } from '@/utils/MathUtils';
import { generateUsername } from '@/utils/UsernameGenerator';

const STORAGE_KEY = 'skifree_save_v1';

export interface SubmitResult {
  isNewBest: boolean;
  prevBest:  RunRecord | null;
  current:   RunRecord;
}

/**
 * All methods are static — there is a single save slot per browser/device.
 * Reads and writes are synchronous localStorage operations.
 */
export class HighScoreManager {
  private static cache: SaveData | null = null;

  // ---------------------------------------------------------------------------
  // Load / save
  // ---------------------------------------------------------------------------

  static load(): SaveData {
    if (this.cache) return this.cache;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed.version === 1) {
          this.cache = parsed;
          return parsed;
        }
      }
    } catch {
      // Corrupt data or storage unavailable — start fresh
    }

    this.cache = { ...EMPTY_SAVE, highScores: {} };
    return this.cache;
  }

  private static persist(data: SaveData): void {
    this.cache = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable (e.g. private browsing quota)
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  static getBest(mode: GameMode): RunRecord | null {
    return this.load().highScores[mode] ?? null;
  }

  static getTotalRuns(): number {
    return this.load().totalRuns;
  }

  static getOrCreateUsername(): string {
    const data = this.load();
    if (data.username) return data.username;
    const name = generateUsername();
    data.username = name;
    this.persist(data);
    return name;
  }

  /**
   * Ensures the stored username is uniquely reserved in Supabase.
   * Loops generating new candidates if the current one is already taken.
   * If the network is unavailable the username is saved locally as unclaimed
   * and this method will retry on the next call.
   *
   * Pass `claimFn` from LeaderboardService to avoid a circular import.
   */
  static async initUsername(
    claimFn: (username: string) => Promise<boolean>,
  ): Promise<void> {
    const data = this.load();
    if (data.usernameClaimed) return;

    let candidate = data.username ?? generateUsername();

    for (let attempt = 0; attempt < 20; attempt++) {
      let claimed: boolean;
      try {
        claimed = await claimFn(candidate);
      } catch {
        // Network unavailable — save the candidate locally and retry next session
        data.username = candidate;
        data.usernameClaimed = false;
        this.persist(data);
        return;
      }

      if (claimed) {
        data.username = candidate;
        data.usernameClaimed = true;
        this.persist(data);
        return;
      }

      // Username taken — generate a fresh candidate and retry
      candidate = generateUsername();
    }
  }

  static getDailyBest(mode: GameMode): RunRecord | null {
    const daily = this.load().dailyBests?.[mode];
    if (!daily || daily.seed !== getDailySeed()) return null;
    return daily.record;
  }

  // ---------------------------------------------------------------------------
  // Submit a completed run
  // ---------------------------------------------------------------------------

  /**
   * Records the run, updates the personal best if beaten, and returns a
   * comparison result so the GameOver screen can give feedback.
   */
  static submitRun(mode: GameMode, distance: number, score: number, timeMs?: number): SubmitResult {
    const data     = this.load();
    const prevBest = data.highScores[mode] ?? null;
    const current: RunRecord = {
      distance, score, timestamp: Date.now(), seed: getDailySeed(),
      ...(timeMs !== undefined && { timeMs }),
    };

    // Time-trial: lower time is better.
    // Jump mode: higher score (ramp count) is better.
    // All other modes: greater distance is better.
    const isNewBest = timeMs !== undefined
      ? prevBest === null || timeMs < (prevBest.timeMs ?? Infinity)
      : mode === GameMode.Jump
        ? prevBest === null || score > (prevBest.score ?? 0)
        : prevBest === null || distance > prevBest.distance;

    data.totalRuns += 1;
    if (isNewBest) {
      data.highScores[mode] = current;
    }

    // Track daily best (same comparison logic, scoped to today's seed)
    const todaySeed  = getDailySeed();
    const prevDaily  = data.dailyBests?.[mode];
    const isNewDaily = !prevDaily || prevDaily.seed !== todaySeed
      || (timeMs !== undefined
        ? timeMs < (prevDaily.record.timeMs ?? Infinity)
        : mode === GameMode.Jump
          ? current.score > (prevDaily.record.score ?? 0)
          : current.distance > prevDaily.record.distance);
    if (!data.dailyBests) data.dailyBests = {};
    if (isNewDaily) {
      data.dailyBests[mode] = { seed: todaySeed, record: current };
    }

    this.persist(data);
    return { isNewBest, prevBest, current };
  }

  // ---------------------------------------------------------------------------
  // Dev / testing helpers
  // ---------------------------------------------------------------------------

  /** Clears all saved data — useful for testing. Preserves username. */
  static reset(): void {
    const username = this.getOrCreateUsername();
    this.cache = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    const fresh = this.load();
    fresh.username = username;
    this.persist(fresh);
  }
}
