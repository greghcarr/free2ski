export interface PatchEntry {
  version: string;
  date:    string;
  notes:   string[];
}

export const PATCH_NOTES: PatchEntry[] = [
  {
    version: 'v0.3.5-pre-alpha',
    date:    'Mar 11, 2026',
    notes: [
      'iPhone home screen icon now shows the skier emoji on a dark background',
      'game no longer serves a stale cached version after updates — a "tap to update" banner appears when a new version is available',
      'username dot indicator (bottom-left) shows green when your scores are syncing to the leaderboard, gray when offline',
      'pre-leaderboard personal bests are now automatically submitted to the global leaderboard on next login',
      'runs are no longer submitted to the leaderboard until your username is fully claimed — prevents ghost entries',
      'a star now glows on the tallest tree in the main menu',
    ],
  },
  {
    version: 'v0.3.4-pre-alpha',
    date:    'Mar 11, 2026',
    notes: [
      'main menu now has a proper mountain scene — sky, peaks, trees, and falling snow',
      'skier character sits on a log by a campfire with crossed skis planted in the snow',
      'campfire flames animate with a flickering effect',
      'title slides in from above and gently floats',
      'menu buttons now fade and slide in with staggered timing',
    ],
  },
  {
    version: 'v0.3.2-pre-alpha',
    date:    'Mar 11, 2026',
    notes: [
      'leaderboard highlights your own runs with "← this is you"',
      'main menu run counter now picks from a rotating set of ridiculous phrases',
      'course announcement text now fully scrolls off before disappearing',
      'fixed leaderboard keyboard nav (left/right tabs, up/down for back button)',
    ],
  },
  {
    version: 'v0.3.1-pre-alpha',
    date:    'Mar 8, 2026',
    notes: [
      'removed auto-fullscreen — game no longer hijacks your screen on click',
      'fixed: browser tab now correctly shows "free2ski" on the deployed site',
      'your username is now permanently reserved — no two players share the same name',
    ],
  },
  {
    version: 'v0.3.0-pre-alpha',
    date:    'Mar 7, 2026',
    notes: [
      'online leaderboard — top 10 runs per mode, all players, all time',
      'scores submitted to a global database after each run',
      'main menu badge shows the total number of runs ever completed',
      'username displayed in the bottom-left corner of every screen',
    ],
  },
  {
    version: 'v0.1.1-pre-alpha',
    date:    'Mar 7, 2026',
    notes: [
      'on-screen pause button (⏸) — tap to pause on phones',
      'jumping over the yeti now works — you\'re invincible mid-air',
      'course announcement shows seed reset countdown',
      'mobile browser compatibility: no pinch-zoom, no URL bar shift',
      'skier now correctly appears above/below the right objects',
    ],
  },
  {
    version: 'v0.1.0-pre-alpha',
    date:    'Mar 4, 2026',
    notes: [
      'deployed to the web',
      'mouse and touch steering',
      'ski trails in the snow',
      'keyboard navigation across all menus',
      'pause menu with restart option',
      'slalom: 25-gate time trial, missed gate +5s penalty',
      'gate numbers on slalom poles',
    ],
  },
  {
    version: 'pre-release (phases 1–6)',
    date:    'Mar 2–3, 2026',
    notes: [
      'core game: Phaser 3 + TypeScript + Vite',
      'player entity with angle-based velocity and crash animation',
      'procedurally generated obstacles — same seed = same course',
      'chunk-based world recycled as you ski',
      'the yeti — chases you and gets faster every wave',
      'slalom gates and jump ramps',
      'personal best tracking saved to your browser',
    ],
  },
];
