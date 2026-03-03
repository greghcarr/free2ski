// Runs in Electron main process (Node.js) only.
// steamworks.js uses native bindings — never imported in the renderer.

let steamClient: Record<string, unknown> | null = null;
let steamAvailable = false;

export function initSteam(appId: number): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const steamworks = require('steamworks.js') as { init: (id: number) => Record<string, unknown> };
    steamClient = steamworks.init(appId);
    steamAvailable = true;
    console.log('[Steam] Initialized successfully');
    return true;
  } catch (e) {
    console.warn('[Steam] Init failed — running without Steam:', e);
    steamAvailable = false;
    return false;
  }
}

export function isSteamAvailable(): boolean {
  return steamAvailable;
}

export function getSteamClient(): Record<string, unknown> | null {
  return steamClient;
}

export function unlockAchievement(id: string): void {
  if (!steamClient) return;
  const achievement = steamClient['achievement'] as { activate?: (id: string) => void } | undefined;
  achievement?.activate?.(id);
}

export async function submitLeaderboardScore(
  boardName: string,
  score: number,
): Promise<void> {
  if (!steamClient) return;
  const lb = steamClient['leaderboard'] as
    | { findOrCreate?: (name: string, sortMethod: number, displayType: number) => Promise<{ setScore?: (score: number, method: number) => Promise<void> }> }
    | undefined;
  if (!lb?.findOrCreate) return;
  try {
    const board = await lb.findOrCreate(boardName, 0, 0);
    await board.setScore?.(score, 0);
  } catch (e) {
    console.warn('[Steam] submitLeaderboardScore failed:', e);
  }
}

export async function fetchLeaderboard(
  boardName: string,
  count: number,
): Promise<Array<{ rank: number; steamId: string; displayName: string; score: number; distance: number }>> {
  if (!steamClient) return [];
  const lb = steamClient['leaderboard'] as
    | { findOrCreate?: (name: string, sortMethod: number, displayType: number) => Promise<{ getScores?: (count: number) => Promise<Array<{ globalRank: number; steamId: { toString: () => string }; score: number }>> }> }
    | undefined;
  if (!lb?.findOrCreate) return [];
  try {
    const board = await lb.findOrCreate(boardName, 0, 0);
    const entries = (await board.getScores?.(count)) ?? [];
    return entries.map((e) => ({
      rank: e.globalRank,
      steamId: e.steamId.toString(),
      displayName: e.steamId.toString(),
      score: e.score,
      distance: 0,
    }));
  } catch (e) {
    console.warn('[Steam] fetchLeaderboard failed:', e);
    return [];
  }
}
