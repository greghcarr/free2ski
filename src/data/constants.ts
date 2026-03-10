// Main menu badge text (golden rotating label above the title)
export const MAIN_MENU_BADGE_TEXT = 'New UI wow!!';

// Debug: set to a GameMode string to skip straight to GameOverScene on startup.

import { GAME_MODE_CONFIGS } from "@/config/GameModes";

// Set to null to run the game normally.
export const DEBUG_GAME_OVER_MODE: string | null 
  = null;
  // = GAME_MODE_CONFIGS.slalom.displayName;
  // = GAME_MODE_CONFIGS.free_ski.displayName;
  // = GAME_MODE_CONFIGS.jump.displayName;

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
// Yeti wave system (FreeSki)
export const YETI_WAVE_INTERVAL_M    = 2000;  // meters between waves
export const YETI_INITIAL_WAVE_SPEED = 85;    // chase px/s for wave 1       (tunable)
export const YETI_SPEED_PER_WAVE     = 15;    // extra px/s per wave          (tunable)
export const YETI_INITIAL_SPEED_CAP  = 220;   // max initial wave speed px/s  (tunable)

// Scoring
export const PX_PER_METER     = 5;    // 5 px = 1 meter of in-game distance
export const GATE_PASS_BONUS  = 50;   // score points per clean slalom gate
export const AIR_TIME_DIVISOR = 15;   // totalAirTimeMs / this = bonus score

// Slalom gate geometry
export const GATE_GAP_WIDTH     = 220;   // px gap between the two poles
export const GATE_POLE_RADIUS   = 8;     // collision radius for each pole

// Jump / ramp
export const JUMP_DURATION          = 1400; // ms the player stays airborne
export const JUMP_VISUAL_HEIGHT     = 50;   // px the container rises at apex
export const JUMP_COURSE_DISTANCE_M = 5000; // metres to the finish line
export const FINISH_LINE_H          = 64;   // px height of the checkered band

// Course boundary (distance from each side edge where the forest begins)
// These drive both the forest-tree spawner and the on-slope boundary lines.
export const COURSE_EDGE_WIDE   = 280;  // FreeSki, Jump
export const COURSE_EDGE_NARROW = 220;  // Slalom

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
  FREE_SKI_DISTANCE: 'FreeSki_Distance',
  SLALOM_SCORE:      'Slalom_Score',
  JUMP_SCORE:        'Jump_Score',
} as const;

// Render depth layers — higher = drawn on top
export const DEPTH = {
  TERRAIN:     10,  // slope graphics, edge shadows
  TRAIL:       20,  // ski grooves behind the player
  GROUND:      30,  // ramps, gate banners, finish line, announcement text
  PLAYER:      40,  // player during normal skiing (under trees/rocks)
  OBSTACLES:   50,  // trees, rocks, slalom gate poles
  YETI:        70,  // yeti chasing player
  PLAYER_AIR:  80,  // player while airborne (over trees/rocks and yeti)
  HUD_BG:     100,  // semi-transparent HUD panel
  HUD:        110,  // HUD text elements and buttons
  POPUP:      120,  // score pop-up text
} as const;

// Colors (flat 2D palette)
// Hex numbers (0x...) are for the Phaser Graphics API.
// CSS strings ('#...') are for Phaser Text style objects.
export const COLORS = {
  // --- Snow / slope ---
  SNOW_LIGHT:  0xf0f4f8,
  SNOW_SHADOW: 0xc8d8e8,
  SLOPE_TRACK: 0xdde8f4,  // reserved / unused
  TRAIL:       0x7aaabf,  // ski groove tracks
  BOUNDARY:    0xffdd00,  // dashed course boundary lines
  HAZARD:      0xff2200,  // danger-zone edge lines (inside forest)

  // --- Trees ---
  TREE_TRUNK:  0x5c3a1e,  // pine trunk
  TREE_DARK:   0x2d5a27,  // base canopy layer (widest, darkest)
  TREE_MID:    0x3a7a32,  // mid canopy layer
  TREE_TOP:    0x4c9040,  // top canopy layer (lightest green)
  TREE_SNOW:   0xe8f0f8,  // snow cap

  // --- Rocks ---
  ROCK:           0x7a7a8a,
  ROCK_SHADOW:    0x5a5a6a,
  ROCK_HIGHLIGHT: 0xb0b0c8,  // catchlight on rock face

  // --- Ramp ---
  RAMP_SURFACE:   0xd0dce8,  // packed-snow platform
  RAMP_HIGHLIGHT: 0xeaf4ff,  // upper entry highlight
  RAMP_LIP:       0x6888a8,  // front launch lip
  RAMP_ARROW:     0xffee00,  // direction arrow fill
  RAMP_OUTLINE:   0x8aaccc,  // platform edge stroke

  // --- Player ---
  PLAYER:      0xe63030,  // helmet / crash red (matches GATE_LEFT)
  PLAYER_SUIT: 0x1a3a8a,  // jacket (matches UI_TITLE hex)
  SKI:         0x111111,  // ski planks
  SKI_POLE:    0x888899,  // pole shafts

  // --- Yeti ---
  YETI:        0xd8e8f8,
  YETI_SHADOW: 0xa8c0d8,
  YETI_EYE:    0x0a1828,  // eyes, brows, and mouth

  // --- Mogul (reserved) ---
  MOGUL:       0xd0dcea,

  // --- Slalom gates ---
  GATE_LEFT:   0xe63030,  // red gate (same hue as PLAYER)
  GATE_RIGHT:  0x3060e6,

  // --- HUD (Graphics API) ---
  HUD_BG:      0x001020,
  HUD_TEXT:    0xffffff,

  // --- UI backgrounds & overlays ---
  OVERLAY:          0x000020,  // pause dim overlay
  PAUSE_CARD:       0xa8d8f0,  // light-blue pause menu card
  GAME_OVER_BG_TOP: 0x0a1520,  // game-over gradient top
  GAME_OVER_BG_BOT: 0x162535,  // game-over gradient bottom
  UI_DIVIDER:       0x223344,  // horizontal divider lines

  // --- Buttons & cards ---
  BTN:        0x2a5ab8,  // button / card-border default fill
  BTN_HOVER:  0x3a6ae8,  // button hover (brighter)
  CARD:       0xe8f0f8,  // mode-select card default
  CARD_HOVER: 0xd0dcec,  // mode-select card hovered

  // --- HUD text (CSS strings) ---
  HUD_LABEL:    '#aaaacc',  // secondary labels (mode name, best, pause btn)
  HUD_VALUE:    '#ffcc00',  // primary values (distance, timer, score, same-score)
  YETI_WARNING: '#c8ddf0',  // "⚠ THE YETI IS COMING"

  // --- Popup floaters (CSS strings) ---
  POPUP_GOLD:    '#ffd700',  // FINISH / NEW BEST
  POPUP_BONUS:   '#ffdd44',  // gate / jump bonus floaters
  POPUP_PENALTY: '#ff4444',  // time-penalty floater

  // --- Score comparison (CSS strings) ---
  SCORE_BETTER: '#78bb78',  // this run beats personal best
  SCORE_WORSE:  '#cc7777',  // this run is below personal best
  // SCORE_SAME → use HUD_VALUE ('#ffcc00')

  // --- Danger / destructive actions ---
  DANGER:          '#e63030',  // "WIPEOUT" / "THE YETI GOT YOU" headline (CSS)
  DESTRUCT_BTN:     0x663333,  // destructive button default (e.g. reset stats)
  DESTRUCT_HOVER:   0x884444,  // destructive button hovered
  DESTRUCT_CONFIRM: 0xff2222,  // destructive button in confirm state
  DESTRUCT_TEXT:   '#ffcccc',  // destructive button label text (CSS)

  // --- Menu / UI text (CSS strings) ---
  UI_TITLE:    '#1a3a8a',  // titles and headings (same hex as PLAYER_SUIT)
  UI_SUBTITLE: '#3a5a9a',  // subtitles and taglines
  UI_SECONDARY:'#6688aa',  // secondary info text
  UI_DETAIL:   '#88aacc',  // sub-detail text
  UI_MUTED:    '#445566',  // very muted text (e.g. mode label in game over)
  UI_COUNT:    '#5577aa',  // run counter

  // --- Announcement text (CSS string) ---
  ANNOUNCEMENT: '#222222',  // on-slope course announcement

  // --- Version label (CSS strings) ---
  VERSION_DEFAULT:  '#6a8ab8',  // main menu / mode select (light bg)
  VERSION_GAME:     '#8aaabb',  // game / pause (snow bg)
  VERSION_GAMEOVER: '#4a6a8a',  // game over (dark bg)
} as const;
