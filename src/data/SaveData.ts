import type { GameMode } from '@/config/GameModes';

export interface RunRecord {
  distance:  number;  // metres (integer)
  score:     number;
  timestamp: number;  // unix ms
  timeMs?:   number;  // finish time in ms (slalom time-trial only; lower = better)
  seed?:     number;  // getDailySeed() value at time of run
}

export interface DailyRecord {
  seed:   number;    // getDailySeed() value when the run was played
  record: RunRecord;
}

export interface SaveData {
  version:         1;
  highScores:      Partial<Record<GameMode, RunRecord>>;
  dailyBests:      Partial<Record<GameMode, DailyRecord>>;
  totalRuns:       number;
  username?:       string;
  usernameClaimed?: boolean;  // true once the username has been reserved in Supabase
}

export const EMPTY_SAVE: SaveData = {
  version:    1,
  highScores: {},
  dailyBests: {},
  totalRuns:  0,
};
