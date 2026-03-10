export enum GameMode {
  FreeSki = 'free_ski',
  Slalom  = 'slalom',
  Jump    = 'jump',
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
    displayName: 'free ski',
    description: 'go as far as you can. watch out for the yeti!',
    yetiEnabled: true,
    yetiSpawnDistance: 1500,
  },
  [GameMode.Slalom]: {
    mode: GameMode.Slalom,
    displayName: 'slalom',
    description: 'race through 25 gates. missing a gate adds 5s.',
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
  [GameMode.Jump]: {
    mode: GameMode.Jump,
    displayName: 'jump',
    description: 'hit ramps and score big air.',
    yetiEnabled: false,
    yetiSpawnDistance: 0,
    jumpConfig: {
      rampFrequency: 3,
      scoreMultiplier: 2.0,
    },
  },
};
