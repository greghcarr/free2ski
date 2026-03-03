import type { IPlatformService, LeaderboardEntry } from './IPlatformService';

// Calls the contextBridge API exposed by electron/preload.ts
// This module is only loaded in Electron builds via PlatformServiceFactory.
declare global {
  interface Window {
    platform: {
      isAvailable: () => boolean;
      unlockAchievement: (id: string) => Promise<void>;
      getAchievementUnlocked: (id: string) => Promise<boolean>;
      submitScore: (board: string, score: number) => Promise<void>;
      fetchLeaderboard: (board: string, count: number) => Promise<LeaderboardEntry[]>;
      cloudSave: (key: string, data: string) => Promise<void>;
      cloudLoad: (key: string) => Promise<string | null>;
      openOverlay: (page?: string) => void;
    };
  }
}

export class SteamPlatformService implements IPlatformService {
  isAvailable(): boolean {
    return typeof window.platform !== 'undefined' && window.platform.isAvailable();
  }

  async unlockAchievement(achievementId: string): Promise<void> {
    return window.platform.unlockAchievement(achievementId);
  }

  async getAchievementUnlocked(achievementId: string): Promise<boolean> {
    return window.platform.getAchievementUnlocked(achievementId);
  }

  async submitScore(leaderboardName: string, score: number): Promise<void> {
    return window.platform.submitScore(leaderboardName, score);
  }

  async fetchLeaderboard(leaderboardName: string, count: number): Promise<LeaderboardEntry[]> {
    return window.platform.fetchLeaderboard(leaderboardName, count);
  }

  async cloudSave(key: string, data: string): Promise<void> {
    return window.platform.cloudSave(key, data);
  }

  async cloudLoad(key: string): Promise<string | null> {
    return window.platform.cloudLoad(key);
  }

  openOverlay(page?: string): void {
    window.platform.openOverlay(page);
  }
}
