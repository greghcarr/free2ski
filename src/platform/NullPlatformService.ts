import type { IPlatformService, LeaderboardEntry } from './IPlatformService';

// Used in web builds — all methods are safe no-ops.
export class NullPlatformService implements IPlatformService {
  isAvailable(): boolean {
    return false;
  }

  async unlockAchievement(_achievementId: string): Promise<void> {}

  async getAchievementUnlocked(_achievementId: string): Promise<boolean> {
    return false;
  }

  async submitScore(_leaderboardName: string, _score: number): Promise<void> {}

  async fetchLeaderboard(_leaderboardName: string, _count: number): Promise<LeaderboardEntry[]> {
    return [];
  }

  async cloudSave(_key: string, _data: string): Promise<void> {}

  async cloudLoad(_key: string): Promise<string | null> {
    return null;
  }

  openOverlay(_page?: string): void {}
}
