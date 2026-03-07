# Changelog

All notable changes to Free2Ski are documented here.
Format: newest first, grouped by version/date.

---

## v0.1.1-pre-alpha — 2026-03-07

### Added
- On-screen pause button (⏸) in game HUD — finger-friendly tap target for mobile
- `GameScene.triggerPause()` method shared by button and keyboard shortcuts (ESC / P)
- `DEVELOPMENT.md` — branching workflow, versioning rules, feature branch guide
- `CLAUDE.md` — project context file auto-loaded by Claude Code each session
- `docs/` folder with CHANGELOG, DECISIONS, DEVLOG

### Changed
- Mobile browser compatibility overhaul (`index.html`):
  - `viewport-fit=cover` + `user-scalable=no` — prevents pinch-zoom and extends into notch areas
  - PWA / Apple meta tags — fullscreen when added to Home Screen
  - `theme-color` — colours Android Chrome address bar
  - `position: fixed` + `100dvh` — prevents URL bar from shifting the layout
  - `touch-action: none` on canvas — stops browser intercepting touch as scroll/zoom
  - `user-select: none` — suppresses long-press menus mid-game
  - Portrait-mode overlay prompting rotation on phones
- `.gitignore` expanded: `dist/`, `release/`, `.DS_Store`, `*.log`, `.env*`
- Version bumped in both `package.json` and `src/ui/versionLabel.ts`

---

## v0.1.0-pre-alpha — 2026-03-04 to 2026-03-06

### Added
- GitHub Pages deployment via GitHub Actions (`deploy.yml`) — builds `dist/web` on push to `main`
- Mouse / pointer steering — tap/click either side of the skier's trajectory to steer
- Ski trails rendered behind the player
- Forest border lines and course boundary / danger zone lines
- Keyboard navigation across all menu scenes (`MenuNav`)
- "P" key opens pause menu (in addition to ESC)
- "Restart" option in pause menu
- Gate number display on each slalom pole

### Changed
- Renamed project to **Free2Ski**
- Removed Tree Slalom mode (out of scope for now)
- Slalom overhauled to 25-gate time trial — missed gate = +5s penalty, best score = fastest time
- HUD layout: distance/timer centred top, mode label top-left, best score below distance
- Timer display gold in slalom; gates counter moved to right side then removed in favour of pole numbers
- Skier render order: under trees/rocks, above slalom gate lines, above gate pole lines
- Finish line and announcement text render under skier
- Announcement text alpha raised to 0.7
- Yeti "caught" message colour adjusted
- Ramp spawns adjusted to stay inside hazard lines
- Horizontal snow lines and danger zone lines tuned

### Fixed
- Slalom pause menu timing bug
- Menu mouse hover bug
- Leaderboard scene ESC key bug
- `tsconfig.web.json` noEmit conflict
- Gate positioning in slalom

---

## Phases 1–6 — 2026-03-02 to 2026-03-03

### Phase 1 — Skeleton
- Phaser 3 project with Vite + TypeScript strict
- Scrolling slope, full scene chain (Boot → Preload → Menu → ModeSelect → Game → GameOver)
- Electron wrapper and dual Vite configs (web + Electron renderer)
- Steam stub pattern (`NullPlatformService` / `SteamPlatformService`)

### Phase 2 — Player
- Player entity (Container with Rectangle/Ellipse/Arc children)
- `InputSystem` with keyboard controls (arrow keys + WASD)
- Custom velocity model: angle-based lateral movement, speed modifier from lean
- Crash animation (tumble tween) and yeti-caught animation (shrink tween)

### Phase 3 — World
- `SeededRandom` (mulberry32 PRNG) — deterministic obstacle placement
- Tree and Rock entities (vector Graphics)
- `ObstacleSpawner` with sigmoid density curve
- `ChunkManager` — 5-chunk pool, manual AABB + circle collision (no Arcade Physics)

### Phase 4 — Persistence
- `SaveData` + `HighScoreManager` (localStorage, versioned schema)
- `GameOverScene` rebuilt with personal best comparison and pulsing "NEW PERSONAL BEST" badge
- Run counter

### Phase 5 — Yeti
- `Yeti` entity and `YetiSystem` — screen-space chase, wave spawning with increasing speed
- Yeti warning banner animation

### Phase 6 — Modes & Scoring
- `SlalomGate` + `Ramp` entities
- Per-mode `ObstacleSpawner` configuration
- `CollisionResult` from `ChunkManager` (crashed / gatePassed / gateMissed / rampHit)
- Jump physics in `Player` (arc tween, shadow scaling)
- Gate pass/miss detection and bonus scoring
