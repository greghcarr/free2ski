# free2ski — Claude Context

## What This Is
A SkiFree-inspired endless skiing game. Targets: browser (web) via GitHub Pages, and macOS + Windows via Steam/Electron.

## Stack
- **Phaser 3** — game engine (2D, no pixel art — all vector/flat Graphics API)
- **TypeScript strict** + Vite
- **Electron** + **steamworks.js** (Steam SDK — main process only, never renderer)
- **electron-builder** (packages .app / .exe)

## Dev Commands
- `npm run dev:web` — Vite dev server at localhost:8080
- `npm run build:web` — produces dist/web/
- `npm run dev:electron` / `npm run dist:mac` / `npm run dist:win`

## Git Workflow
- `main` = production. GitHub Pages auto-deploys on every push via GitHub Actions.
- `dev` = daily work. All commits go here. Push to `dev` does not deploy.
- **"commit" means local only. Never push unless explicitly asked.**
- See DEVELOPMENT.md for full branching, versioning, and feature-branch guidelines.

## Key Files
- `src/data/constants.ts` — all tunable values (speeds, sizes, colors, achievement IDs)
- `src/config/GameModes.ts` — GameMode enum + GAME_MODE_CONFIGS
- `src/entities/Player.ts` — Player class + PlayerState enum
- `src/entities/obstacles/ObstacleBase.ts` — abstract base for all obstacles
- `src/systems/InputSystem.ts` — keyboard InputState; stored as `controls` on GameScene
- `src/world/ChunkManager.ts` — chunk pool + all collision; returns CollisionResult
- `src/world/ObstacleSpawner.ts` — per-mode spawn logic
- `src/scenes/GameScene.ts` — main game loop, HUD, trail, input wiring
- `src/data/HighScoreManager.ts` — static class, localStorage key `skifree_save_v1`
- `src/ui/versionLabel.ts` — APP_VERSION + addVersionLabel()

## Architecture
1. **No Arcade Physics bodies** — all collision is manual AABB + circle in ChunkManager
2. **Chunk-based world** — 5 active chunks (3 ahead, 2 behind), 1200px each, seeded deterministically
3. **Player is a plain class**, not a Phaser GameObject — position in `this.x / this.screenY`, visual in `container`
4. **Steam stub pattern** — NullPlatformService in web; SteamPlatformService uses window.platform IPC
5. **`__PLATFORM__` compile-time define** — tree-shakes Steam code from web bundle

## Scene Flow
Boot → Preload → MainMenu → ModeSelect → Game → GameOver
Game launches Pause as an overlay via `scene.launch`

## Render Depth Layers
1=terrain, 2=obstacles, 3=trail, 3.5=player, 4=yeti, 5=finish line, 20=HUD bg, 21=HUD text, 30=score popups

## Coding Conventions
- Path alias `@/` = `src/`
- All tunable values belong in `src/data/constants.ts`, not inline
- Tween-based animations — `this.scene.tweens.add()`, no spritesheet frames
- `pointerdown` (not `click`) for all interactive elements — works on mouse and touch
- `useHandCursor: true` on all interactive game objects
- Scene data via `scene.start(key, data)` / `scene.launch(key, data)`, received in `init(data)`
- `input` is reserved on Phaser.Scene — use `controls` for the InputSystem field
- New obstacle: extend ObstacleBase, implement `hitRadius`, build visual into `this.container`
- New constant: add to `src/data/constants.ts` with a comment, export it

## Key Gotcha
`input` is a reserved field on `Phaser.Scene` (the InputPlugin). Always name custom input fields `controls` or similar to avoid TS2416.
