import type { GameMode } from '@/config/GameModes';

export interface RunRecord {
  distance:  number;  // metres (integer)
  score:     number;
  timestamp: number;  // unix ms
}

export interface SaveData {
  version:    1;
  highScores: Partial<Record<GameMode, RunRecord>>;
  totalRuns:  number;
}

export const EMPTY_SAVE: SaveData = {
  version:    1,
  highScores: {},
  totalRuns:  0,
};
