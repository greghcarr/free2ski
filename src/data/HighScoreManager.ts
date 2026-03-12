import { GameMode } from '@/config/GameModes';
import { EMPTY_SAVE, type RunRecord, type SaveData } from './SaveData';
import { getDailySeed } from '@/utils/MathUtils';

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

  static getDisplayName(): string | null {
    return this.load().username ?? null;
  }

  static setDisplayName(name: string): void {
    const data = this.load();
    data.username = name;
    this.persist(data);
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
  // Legacy score backfill
  // ---------------------------------------------------------------------------

  /**
   * One-time migration: submits any local personal bests that existed before
   * the online leaderboard was introduced. Safe to call on every load — it
   * no-ops after the first successful run.
   *
   * Defensively coerces old record fields; skips any mode whose metric is
   * missing, null, non-numeric, or non-positive.
   *
   * Pass `submitFn` from LeaderboardService to avoid a circular import.
   */
  static async submitLegacyScores(
    submitFn: (username: string, mode: GameMode, score: number, seed: number) => Promise<void>,
  ): Promise<void> {
    const data = this.load();
    if (data.legacyScoresSubmitted) return;
    if (!data.usernameClaimed || !data.username) return;

    const username = data.username;

    // Safely coerce an unknown value to a positive finite number, or null.
    const safePositive = (val: unknown): number | null => {
      const n = Number(val);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const submissions: Promise<void>[] = [];

    for (const modeKey of Object.keys(data.highScores) as GameMode[]) {
      const record = data.highScores[modeKey];
      if (!record) continue;

      const seed = safePositive(record.seed) ?? 0;

      // Each mode uses a different field as its leaderboard score metric.
      let score: number | null;
      if (modeKey === GameMode.Slalom) {
        score = safePositive(record.timeMs);   // lower = better; skip if missing
      } else if (modeKey === GameMode.Jump) {
        score = safePositive(record.score);
      } else {
        score = safePositive(record.distance); // FreeSki and any future distance modes
      }

      if (score === null) continue;

      submissions.push(submitFn(username, modeKey, score, seed));
    }

    await Promise.allSettled(submissions);

    data.legacyScoresSubmitted = true;
    this.persist(data);
  }

  // ---------------------------------------------------------------------------
  // Dev / testing helpers
  // ---------------------------------------------------------------------------

  /** Clears all saved data — useful for testing. Preserves username. */
  static reset(): void {
    const username = this.getDisplayName();
    this.cache = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    const fresh = this.load();
    if (username) fresh.username = username;
    this.persist(fresh);
  }
}
