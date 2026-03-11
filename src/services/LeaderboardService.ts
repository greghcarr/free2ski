import { createClient } from '@supabase/supabase-js';
import { GameMode } from '@/config/GameModes';
import { HighScoreManager } from '@/data/HighScoreManager';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL  as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export interface LeaderboardRow {
  rank:     number;
  username: string;
  score:    number;   // raw: metres / ms / jump-score
  seed:     number | null;
}

/**
 * Push the current device's local best scores to Supabase.
 * Upserts on username — fire-and-forget, errors are swallowed.
 */
export async function pushScores(): Promise<void> {
  const username = HighScoreManager.getOrCreateUsername();
  const row: Record<string, unknown> = { username };

  const freesk = HighScoreManager.getBest(GameMode.FreeSki);
  if (freesk) {
    row.freesk_best = freesk.distance;
    row.freesk_seed = freesk.seed ?? null;
  }

  const slalom = HighScoreManager.getBest(GameMode.Slalom);
  if (slalom?.timeMs !== undefined) {
    row.slalom_best = slalom.timeMs;
    row.slalom_seed = slalom.seed ?? null;
  }

  const jump = HighScoreManager.getBest(GameMode.Jump);
  if (jump) {
    row.jump_best = jump.score;
    row.jump_seed = jump.seed ?? null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await supabase.from('users').upsert(row, { onConflict: 'username' }).abortSignal(controller.signal);
  } catch {
    // Network unavailable — silently ignore
  } finally {
    clearTimeout(timeout);
  }
}

type ModeColumns = {
  best:      string;
  seed:      string;
  ascending: boolean;
};

const MODE_COLUMNS: Record<GameMode, ModeColumns> = {
  [GameMode.FreeSki]: { best: 'freesk_best', seed: 'freesk_seed', ascending: false },
  [GameMode.Slalom]:  { best: 'slalom_best', seed: 'slalom_seed', ascending: true  },
  [GameMode.Jump]:    { best: 'jump_best',   seed: 'jump_seed',   ascending: false },
};

/**
 * Fetch the top 10 scores for a given mode.
 * Returns an empty array on network error.
 */
export async function fetchTopScores(mode: GameMode): Promise<LeaderboardRow[]> {
  const { best, seed, ascending } = MODE_COLUMNS[mode];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const { data, error } = await supabase
      .from('users')
      .select(`username, ${best}, ${seed}`)
      .not(best, 'is', null)
      .order(best, { ascending })
      .limit(10)
      .abortSignal(controller.signal);

    if (error || !data) throw new Error(error?.message ?? 'no data');

    return (data as unknown as Record<string, unknown>[]).map((row, i) => ({
      rank:     i + 1,
      username: row['username'] as string,
      score:    row[best]       as number,
      seed:     (row[seed]      as number | null) ?? null,
    }));
  } finally {
    clearTimeout(timeout);
  }
}
