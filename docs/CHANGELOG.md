# Changelog

All notable changes to free2ski are documented here.
Format: newest first, grouped by version/date.

---

## v0.3.9-pre-alpha — 2026-03-12

### Added
- Main menu sky adapts to real-world local time — distinct looks for sunrise, daytime, golden hour, sunset, and night
- Sun and moon are positioned correctly for the time of day and move smoothly across the sky in real time
- Sky gradient and star brightness rebuild every 5 minutes to handle period transitions (sunrise→day etc.)
- Campfire glow on the main menu scales up in size and brightness at night
- Tied personal best gets its own "★ tied personal best !!" pulsing badge on the game-over screen

### Changed
- Game-over personal best comparison now shows the exact delta: "X m more/less than personal best" and equivalent for time/score modes
- Leaderboard run dates displayed as "today", "yesterday", "2 days ago", "3 days ago" for recent entries
- Main menu keyboard navigation replaced with a 2D grid-aware system — all four arrow keys work correctly through the play / leaderboard+settings / patch notes layout

### Fixed
- Main menu arrow key navigation was linear (wrapping through all 4 buttons); now understands the 2D layout

---

## v0.3.8-pre-alpha — 2026-03-11

### Changed
- "Play again" button is automatically focused after confirming a username — keyboard users can immediately press Enter to replay

---

## v0.3.7-pre-alpha — 2026-03-11

### Changed
- Username is now player-chosen on the GameOver screen, replacing the auto-generated adjective-noun-0000 scheme
- Leaderboard submission deferred until the player confirms a valid name
- Name entry uses a DOM `<input>` overlay with profanity filtering (`bad-words`) and character sanitization
- Inline confirm button shows "saved!" (green) or "rejected" (red) with a 1.2s reset on rejection
- Input and confirm button lock after a successful save
- Red glow on the input field replaces text error messages for invalid names
- Bottom-left username label updates live as the player types
- `autocorrect`, `autocapitalize`, `spellcheck`, and `autocomplete` all disabled on the name input
- Debug features consolidated into `src/data/DebugConfig.ts` — single `ENABLED` boolean controls all

---

## v0.1.1-pre-alpha — 2026-03-07

### Added
- On-screen pause button (⏸) in game HUD — finger-friendly tap target for mobile
- `GameScene.triggerPause()` method shared by button and keyboard shortcuts (ESC / P)
- `DEVELOPMENT.md` — branching workflow, versioning rules, feature branch guide
- `CLAUDE.md` — project context file auto-loaded by Claude Code each session
- `docs/` folder with CHANGELOG, DECISIONS, DEVLOG
- Skier emoji (⛷️) favicon — canvas-based PNG data URI for Safari compatibility
- Named render depth layer system: `DEPTH` constant with TERRAIN, TRAIL, GROUND, PLAYER, OBSTACLES, YETI, PLAYER\_AIR, HUD\_BG, HUD, POPUP — replaces all raw `setDepth()` numbers
- Skier renders under trees/rocks normally; rises above them (and the yeti) while airborne
- Player can now jump over the yeti — collision detection skipped while `PlayerState.Jumping`
- Course announcement includes seed reset countdown: "Seed: XXXXXXXX (resets in X hr, Y min)"
- Light blue semi-transparent card backdrop behind the pause menu
- Full color extraction: all inline hex/CSS color literals across the codebase moved to named entries in `COLORS` in `constants.ts` (50+ named constants, covering entities, slope, HUD, popups, menus, UI text, and version label)

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
- Renamed project to **free2ski**
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
