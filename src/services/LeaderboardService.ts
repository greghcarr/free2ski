import { createClient } from '@supabase/supabase-js';
import { GameMode } from '@/config/GameModes';

/** Minimum version whose runs appear in leaderboards and world records. */
const MIN_DISPLAY_VERSION = 'v0.4.0-pre-alpha';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL  as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export interface LeaderboardRow {
  rank:      number;
  username:  string;
  score:     number;
  seed:      number | null;
  playedAt:  string;  // ISO timestamp
}

/**
 * Records a completed run in the `runs` table.
 * Upserts the username into `users` first to satisfy any FK constraint.
 * score meaning varies by mode: distanceM (FreeSki), finishTimeMs (Slalom), score (Jump).
 * Fire-and-forget — caller should .catch(() => {}).
 */
export async function submitRun(
  username: string,
  mode: GameMode,
  score: number,
  seed: number,
  version: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await supabase
      .from('users')
      .upsert([{ username }], { onConflict: 'username', ignoreDuplicates: true })
      .abortSignal(controller.signal);
    await supabase
      .from('runs')
      .insert({ username, mode, score, seed, played_at: new Date().toISOString(), version })
      .abortSignal(controller.signal);
  } catch {
    // Network unavailable — silently ignore
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns the total number of runs ever recorded across all modes and players.
 * Throws on network error so the caller can fall back gracefully.
 */
export async function fetchTotalRuns(): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const { count, error } = await supabase
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .abortSignal(controller.signal);
    if (error) throw new Error(error.message);
    return count ?? 0;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch only the #1 score for a given mode.
 * Returns null if no runs exist or on network error.
 */
export async function fetchTopScore(mode: GameMode): Promise<number | null> {
  const ascending = mode === GameMode.Slalom;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const { data, error } = await supabase
      .from('runs')
      .select('score')
      .eq('mode', mode)
      .gte('version', MIN_DISPLAY_VERSION)
      .order('score', { ascending })
      .limit(1)
      .abortSignal(controller.signal);
    if (error || !data || data.length === 0) return null;
    return (data[0] as Record<string, unknown>)['score'] as number;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch the top 10 runs for a given mode, across all players.
 * If dailyOnly is true, only returns runs from today (UTC midnight onwards).
 * Returns an empty array on network error.
 */
export async function fetchTopScores(mode: GameMode, dailyOnly = false): Promise<LeaderboardRow[]> {
  const ascending = mode === GameMode.Slalom; // lower time = better
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    let query = supabase
      .from('runs')
      .select('username, score, seed, played_at')
      .eq('mode', mode)
      .gte('version', MIN_DISPLAY_VERSION);

    if (dailyOnly) {
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      query = query.gte('played_at', todayUTC.toISOString());
    }

    const { data, error } = await query
      .order('score', { ascending })
      .limit(10)
      .abortSignal(controller.signal);

    if (error || !data) throw new Error(error?.message ?? 'no data');

    return (data as unknown as Record<string, unknown>[]).map((row, i) => ({
      rank:     i + 1,
      username: row['username']  as string,
      score:    row['score']     as number,
      seed:     (row['seed']     as number | null) ?? null,
      playedAt: row['played_at'] as string,
    }));
  } finally {
    clearTimeout(timeout);
  }
}
