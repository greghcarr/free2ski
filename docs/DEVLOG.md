# Development Log

An informal diary of sessions, ideas, and progress.
Newest entries at the top.

---

## 2026-03-07

### Session: Mobile polish, tooling, and documentation

Started the day noticing the game wasn't great on phone browsers — the URL bar was covering content, touch inputs were fighting the browser, and there was no way to pause without a keyboard.

Fixed the mobile issues entirely in `index.html` — no game code needed. The key insight was that `position: fixed` on `<body>` stops the layout from shifting when the URL bar animates in/out. Added `100dvh` for proper viewport height, `touch-action: none` to stop the browser intercepting swipes, PWA meta tags so the game goes fullscreen when added to Home Screen, and a CSS-only portrait-mode overlay.

Added an on-screen pause button (⏸) to the HUD. Refactored the keyboard pause logic into `GameScene.triggerPause()` so the button and ESC/P all share the same code path.

Bumped to **v0.1.1-pre-alpha**.

Spent the rest of the session on tooling and long-term maintainability:
- Set up a two-branch git workflow (`main` = production deploys, `dev` = daily work)
- Created `DEVELOPMENT.md` with branching rules, versioning guidelines, and feature branch guide
- Did a full codebase scan and wrote detailed project memory for Claude, including render depth layers, entity patterns, input architecture, and coding conventions
- Created `CLAUDE.md` (project-level, auto-loaded by Claude Code) and `~/.claude/CLAUDE.md` (global conventions that carry over to future projects)
- Set up `docs/` folder with CHANGELOG, DECISIONS, and this DEVLOG

The infrastructure work today should pay off in every future session.

---

## 2026-03-04 to 2026-03-06

### Session: Polish, HUD, steering, and GitHub Pages launch

A dense few days of polish work after the core gameplay phases were complete.

**Steering:** Added mouse/pointer steering. The implementation uses a dot-product of the pointer-relative vector against the trajectory's right-normal — if the pointer is to the right of where you're heading, you steer right. Feels natural on both mouse and touch without needing any UI chrome.

**HUD:** Iterated on layout several times — mode label top-left, distance/timer centred and gold, best score below. Removed the gates counter from the slalom HUD in favour of numbers displayed directly on each pole, which is much more readable mid-run.

**Render order:** Went through several iterations to get layering right. Final order: terrain → obstacles → ski trail → player → yeti → finish line → HUD. The skier being under trees and rocks (rather than on top) looks more natural — like the trees are actually in front of you.

**Slalom finish:** Added announcement text and a finish line graphic. Tweaked alpha and z-ordering so they feel integrated rather than overlaid.

**GitHub Pages:** Wired up GitHub Actions to build `dist/web` and deploy on push to `main`. The game is now live on the web.

**Keyboard navigation:** Added `MenuNav` for full keyboard control across all menu scenes. All menus support arrow keys + enter.

**Pause fixes:** Fixed a timing bug where the slalom timer kept running after pausing. Added "Restart" to the pause menu. Added "P" as a secondary pause key.

---

## 2026-03-03

### Session: Yeti, slalom gates, ramps, world polish

Completed phases 5 and 6 in one session.

**Yeti (Phase 5):** `YetiSystem` spawns from below the screen and chases the player using screen-space coordinates. Catch detection is a simple circle overlap. The wave system (escalating speed every 2000m) was designed to keep FreeSki interesting across long runs without adding new mechanics.

**Slalom + Jump (Phase 6):** `SlalomGate` and `Ramp` are both `ObstacleBase` subclasses. Gate pass/miss detection fires when the gate's world Y scrolls behind the player — checked once per gate using `isPassed` flag. Ramp collision triggers `Player.hitRamp()` which launches the jump arc (sin curve over 1400ms).

**World polish:** Added ski trails (sampled every 8 world-px, rendered as two grooves), forest border lines, and course boundary / danger zone lines. The visual difference between the skiable slope and the forest edges makes the course feel defined without being a hard wall.

**Slalom overhaul:** Changed from endless gates to a fixed 25-gate time trial. Each missed gate adds 5s to finish time. Personal best is fastest time. This change made slalom feel like a proper mode rather than a variant of FreeSki.

---

## 2026-03-02

### Session: Phases 1–4 — skeleton through persistence

Built the entire foundation in two days.

**Phase 1:** Phaser 3 + Vite + TypeScript strict. Scrolling slope, full scene chain, Electron wrapper, Steam stub pattern. The dual Vite config approach (web vs Electron renderer) worked cleanly — no monorepo needed.

**Phase 2:** Player entity as a plain class with a Phaser Container for visuals. Custom velocity model: lean angle drives lateral movement, `cos²(angle)` gives the speed modifier (turning slows you down). Crash and caught-by-yeti animations are pure tweens.

**Phase 3:** Seeded world using mulberry32 PRNG. `ChunkManager` pools 5 chunks (3 ahead, 2 behind). All collision is manual AABB pre-check + circle distance — no Arcade Physics bodies anywhere. Obstacle density follows a sigmoid curve so the slope gets harder the further you go.

**Phase 4:** `HighScoreManager` is fully static with a single localStorage slot. The `GameOverScene` shows a personal best comparison with a pulsing "NEW PERSONAL BEST" badge on first beats.

---

## Ideas & Future Work

Things that came up during development but weren't implemented yet.

- **Audio:** No sound yet. Priority for Phase 7. Wind/speed ambience, tree crash SFX, yeti growl, gate pass chime.
- **Particles:** Snow spray on turns, powder puff on crash.
- **Daily challenge mode:** `getDailySeed()` exists in `MathUtils` — a shared seed for all players on a given day. Could surface as a special mode.
- **Moguls:** Mentioned in `COLORS` (`COLORS.MOGUL` exists) but not yet implemented as an obstacle.
- **Steam leaderboards:** Infrastructure in place (`IPlatformService`, `LEADERBOARDS` constants). Waiting on Electron + Steam integration (Phase 8).
- **Settings scene:** Exists but shows "coming soon". Candidates: music/SFX volume, control sensitivity, graphics quality toggle.
