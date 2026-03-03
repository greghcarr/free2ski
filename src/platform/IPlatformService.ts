export interface LeaderboardEntry {
  rank: number;
  steamId: string;
  displayName: string;
  score: number;
  distance: number;
}

export interface IPlatformService {
  isAvailable(): boolean;

  // Achievements
  unlockAchievement(achievementId: string): Promise<void>;
  getAchievementUnlocked(achievementId: string): Promise<boolean>;

  // Leaderboards
  submitScore(leaderboardName: string, score: number): Promise<void>;
  fetchLeaderboard(leaderboardName: string, count: number): Promise<LeaderboardEntry[]>;

  // Cloud saves
  cloudSave(key: string, data: string): Promise<void>;
  cloudLoad(key: string): Promise<string | null>;

  // Steam overlay
  openOverlay(page?: string): void;
}
