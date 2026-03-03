import { EMPTY_SAVE } from './SaveData';
const STORAGE_KEY = 'skifree_save_v1';
/**
 * All methods are static — there is a single save slot per browser/device.
 * Reads and writes are synchronous localStorage operations.
 */
export class HighScoreManager {
    // ---------------------------------------------------------------------------
    // Load / save
    // ---------------------------------------------------------------------------
    static load() {
        if (this.cache)
            return this.cache;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.version === 1) {
                    this.cache = parsed;
                    return parsed;
                }
            }
        }
        catch {
            // Corrupt data or storage unavailable — start fresh
        }
        this.cache = { ...EMPTY_SAVE, highScores: {} };
        return this.cache;
    }
    static persist(data) {
        this.cache = data;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        catch {
            // localStorage full or unavailable (e.g. private browsing quota)
        }
    }
    // ---------------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------------
    static getBest(mode) {
        return this.load().highScores[mode] ?? null;
    }
    static getTotalRuns() {
        return this.load().totalRuns;
    }
    // ---------------------------------------------------------------------------
    // Submit a completed run
    // ---------------------------------------------------------------------------
    /**
     * Records the run, updates the personal best if beaten, and returns a
     * comparison result so the GameOver screen can give feedback.
     */
    static submitRun(mode, distance, score) {
        const data = this.load();
        const prevBest = data.highScores[mode] ?? null;
        const current = { distance, score, timestamp: Date.now() };
        const isNewBest = prevBest === null || distance > prevBest.distance;
        data.totalRuns += 1;
        if (isNewBest) {
            data.highScores[mode] = current;
        }
        this.persist(data);
        return { isNewBest, prevBest, current };
    }
    // ---------------------------------------------------------------------------
    // Dev / testing helpers
    // ---------------------------------------------------------------------------
    /** Clears all saved data — useful for testing. */
    static reset() {
        this.cache = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
        }
        catch { /* ignore */ }
    }
}
HighScoreManager.cache = null;
