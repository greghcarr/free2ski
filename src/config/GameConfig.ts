import type { GameMode } from './GameModes';

export interface GameSettings {
  masterVolume: number;  // 0–1
  sfxVolume: number;     // 0–1
  musicVolume: number;   // 0–1
  fullscreen: boolean;
  showFPS: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 1.0,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  fullscreen: false,
  showFPS: false,
};

export interface SessionConfig {
  mode: GameMode;
  seed?: number;  // for deterministic generation / future daily challenges
}

export interface HighScore {
  mode: GameMode;
  distance: number;  // meters
  score: number;
  timestamp: number; // unix ms
  steamId?: string;
}
