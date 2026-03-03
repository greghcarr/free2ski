// Used in web builds — all methods are safe no-ops.
export class NullPlatformService {
    isAvailable() {
        return false;
    }
    async unlockAchievement(_achievementId) { }
    async getAchievementUnlocked(_achievementId) {
        return false;
    }
    async submitScore(_leaderboardName, _score) { }
    async fetchLeaderboard(_leaderboardName, _count) {
        return [];
    }
    async cloudSave(_key, _data) { }
    async cloudLoad(_key) {
        return null;
    }
    openOverlay(_page) { }
}
