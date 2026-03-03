// World / chunk sizing
export const WORLD_WIDTH       = 1280;  // px
export const GAME_HEIGHT       = 720;   // px
export const CHUNK_HEIGHT      = 1200;  // px — ~1.5 screen heights
export const CHUNKS_AHEAD      = 3;     // chunks to keep loaded ahead of player
export const CHUNKS_BEHIND     = 2;     // chunks to keep loaded behind player

// Speed
export const BASE_SCROLL_SPEED = 200;   // px/s at game start
export const MAX_SCROLL_SPEED  = 600;   // px/s hard cap
export const SPEED_ACCEL_RATE  = 10;    // px/s² passive acceleration
export const PLAYER_TURN_SPEED = 120;   // degrees per second

// Yeti
export const YETI_SPAWN_DISTANCE = 1500;  // meters (Free Ski default; per-mode values are in GameModes.ts)
export const YETI_CHASE_SPEED    = 1.15;  // multiplier over player speed

// Scoring
export const PX_PER_METER     = 5;    // 5 px = 1 meter of in-game distance
export const GATE_PASS_BONUS  = 50;   // score points per clean slalom gate
export const AIR_TIME_DIVISOR = 15;   // totalAirTimeMs / this = bonus score

// Slalom gate geometry
export const GATE_GAP_WIDTH   = 220;  // px gap between the two poles
export const GATE_POLE_RADIUS = 8;    // collision radius for each pole

// Jump / ramp
export const JUMP_DURATION      = 1400; // ms the player stays airborne
export const JUMP_VISUAL_HEIGHT = 50;   // px the container rises at apex

// Achievement IDs (must match Steamworks portal exactly)
export const ACHIEVEMENTS = {
  FIRST_RUN:       'ACH_FIRST_RUN',
  DIST_500:        'ACH_DIST_500M',
  DIST_1000:       'ACH_DIST_1KM',
  DIST_5000:       'ACH_DIST_5KM',
  SURVIVED_YETI:   'ACH_SURVIVED_YETI',
  CAUGHT_BY_YETI:  'ACH_CAUGHT_BY_YETI',
  SLALOM_CLEAN_10: 'ACH_SLALOM_10_GATES',
  JUMP_AIRTIME:    'ACH_JUMP_3S',
  ALL_MODES:       'ACH_ALL_MODES_PLAYED',
} as const;

// Leaderboard names (must match Steamworks portal exactly)
export const LEADERBOARDS = {
  FREE_SKI_DISTANCE:  'FreeSki_Distance',
  SLALOM_SCORE:       'Slalom_Score',
  TREE_SLALOM_SCORE:  'TreeSlalom_Score',
  JUMP_SCORE:         'Jump_Score',
} as const;

// Colors (flat 2D palette)
export const COLORS = {
  SNOW_LIGHT:  0xf0f4f8,
  SNOW_SHADOW: 0xc8d8e8,
  SLOPE_TRACK: 0xdde8f4,
  TREE_DARK:   0x2d5a27,
  TREE_MID:    0x3a7a32,
  TREE_SNOW:   0xe8f0f8,
  ROCK:        0x7a7a8a,
  ROCK_SHADOW: 0x5a5a6a,
  MOGUL:       0xd0dcea,
  RAMP:        0xc8d4e0,
  PLAYER:      0xe63030,
  PLAYER_SUIT: 0x1a3a8a,
  YETI:        0xd8e8f8,
  YETI_SHADOW: 0xa8c0d8,
  HUD_BG:      0x001020,
  HUD_TEXT:    0xffffff,
  GATE_LEFT:   0xe63030,
  GATE_RIGHT:  0x3060e6,
} as const;
