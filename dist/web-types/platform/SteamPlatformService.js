export class SteamPlatformService {
    isAvailable() {
        return typeof window.platform !== 'undefined' && window.platform.isAvailable();
    }
    async unlockAchievement(achievementId) {
        return window.platform.unlockAchievement(achievementId);
    }
    async getAchievementUnlocked(achievementId) {
        return window.platform.getAchievementUnlocked(achievementId);
    }
    async submitScore(leaderboardName, score) {
        return window.platform.submitScore(leaderboardName, score);
    }
    async fetchLeaderboard(leaderboardName, count) {
        return window.platform.fetchLeaderboard(leaderboardName, count);
    }
    async cloudSave(key, data) {
        return window.platform.cloudSave(key, data);
    }
    async cloudLoad(key) {
        return window.platform.cloudLoad(key);
    }
    openOverlay(page) {
        window.platform.openOverlay(page);
    }
}
