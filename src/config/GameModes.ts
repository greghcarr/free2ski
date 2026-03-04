export enum GameMode {
  FreeSki    = 'free_ski',
  Slalom     = 'slalom',
  TreeSlalom = 'tree_slalom',
  Jump       = 'jump',
}

export interface GateConfig {
  gateSpacing: number;        // px between gates
  timeLimitEnabled: boolean;
}

export interface JumpConfig {
  rampFrequency: number;      // ramps per chunk
  scoreMultiplier: number;
}

export interface SlalomCourseConfig {
  totalGates:        number;  // fixed gate count — run ends when reached
  gateMissPenaltyMs: number;  // ms added to finish time per missed gate
}

export interface GameModeConfig {
  mode: GameMode;
  displayName: string;
  description: string;
  yetiEnabled: boolean;
  yetiSpawnDistance: number;  // meters before yeti appears
  gateConfig?: GateConfig;
  jumpConfig?: JumpConfig;
  slalomCourse?: SlalomCourseConfig;
}

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  [GameMode.FreeSki]: {
    mode: GameMode.FreeSki,
    displayName: 'Free Ski',
    description: 'Go as far as you can. Watch out for the yeti.',
    yetiEnabled: true,
    yetiSpawnDistance: 1500,
  },
  [GameMode.Slalom]: {
    mode: GameMode.Slalom,
    displayName: 'Slalom',
    description: 'Race through 25 gates as fast as possible. Missing a gate adds +5s.',
    yetiEnabled: false,
    yetiSpawnDistance: 0,
    gateConfig: {
      gateSpacing: 400,
      timeLimitEnabled: false,
    },
    slalomCourse: {
      totalGates:        25,
      gateMissPenaltyMs: 5000,
    },
  },
  [GameMode.TreeSlalom]: {
    mode: GameMode.TreeSlalom,
    displayName: 'Tree Slalom',
    description: 'Weave through trees arranged in a slalom course.',
    yetiEnabled: false,
    yetiSpawnDistance: 0,
    gateConfig: {
      gateSpacing: 350,
      timeLimitEnabled: false,
    },
  },
  [GameMode.Jump]: {
    mode: GameMode.Jump,
    displayName: 'Jump',
    description: 'Hit ramps and score big air. Distance plus hang-time wins.',
    yetiEnabled: true,
    yetiSpawnDistance: 2000,
    jumpConfig: {
      rampFrequency: 3,
      scoreMultiplier: 2.0,
    },
  },
};
