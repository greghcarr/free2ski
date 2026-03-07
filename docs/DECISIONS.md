# Architecture Decision Log

Key decisions made during development, and the reasoning behind them.
Newest first within each section.

---

## Gameplay

### Slalom as a fixed 25-gate time trial (not endless)
Endless slalom felt aimless — there was no satisfying endpoint and distance became a proxy for skill rather than execution. A fixed 25-gate course makes each run a discrete race with a clear finish, a real time to beat, and a meaningful personal best. Gate miss penalty (5s) punishes sloppy lines without ending the run.

### Yeti wave system with escalating speed (FreeSki)
A single yeti with a fixed speed becomes boring to outrun once the player learns the pattern. The wave system (every 2000m, each wave slightly faster) creates escalating tension across a long run without requiring new mechanics. The speed cap (220 px/s) prevents it from becoming unfair.

### Mouse/pointer steering over on-screen joystick
On-screen joysticks require precise thumb placement and visual space. The dot-product approach (tap either side of the skier's current trajectory to steer) is more intuitive and works equally well with a mouse, touchscreen, or stylus. No UI chrome needed.

### Removed Tree Slalom mode
Tree Slalom was conceptually redundant — it was FreeSki with gate markers but without a clear scoring advantage over either pure FreeSki or pure Slalom. Removing it keeps the mode list focused and avoids diluting the game feel of the remaining three modes.

---

## Architecture

### Manual AABB + circle collision instead of Arcade Physics
Phaser's Arcade Physics requires GameObjects with physics bodies, which conflicts with the chunk-based world model (obstacles are created and destroyed frequently, and the player isn't a standard physics body). Manual collision in `ChunkManager` is simpler, faster, and gives exact control over what counts as a hit.

### Chunk-based world with seeded RNG
A streaming world (like an infinite runner) needs obstacles far ahead of the player. Chunks (1200px each) with a mulberry32 seed per chunk means the world is deterministic — the same seed always produces the same course, enabling daily challenges and fair comparisons. The seed is derived from `baseSeed ^ (chunkIndex * 0x9e3779b9)` for good bit spread.

### Player as a plain class, not a Phaser GameObject
The player has no physics body, no texture, and is positioned in screen space rather than world space. Extending `Phaser.GameObjects.Container` would add a lot of overhead and API surface for no benefit. A plain class with a `container` field is lighter and clearer.

### Single repo, dual Vite configs (no monorepo)
A monorepo (Turborepo / nx) would be overkill for two build targets. Separate `vite.web.config.ts` and `vite.electron.config.ts` share the same source and differ only in the steamworks.js alias and output path. Simpler to maintain, easier to reason about.

### Steam stub pattern (`NullPlatformService` / `SteamPlatformService`)
Steam SDK (steamworks.js) only works in the Electron main process — it can't be imported in a browser or a renderer. The `IPlatformService` abstraction lets game code call `platform.submitScore()` etc. without knowing the environment. The web build aliases steamworks.js to a stub that tree-shakes to nothing.

### `controls` not `input` for InputSystem
`input` is a reserved field on `Phaser.Scene` (the `InputPlugin`). Using it as a custom field name causes TS2416. Named `controls` throughout.

---

## UI / UX

### `pointerdown` not `click` for all interactive elements
`click` fires after `pointerup` and has a ~300ms delay on mobile (legacy tap detection). `pointerdown` fires immediately on both mouse and touch with no delay. All buttons use `pointerdown`.

### Version label in-game (bottom-right corner)
Pre-alpha builds are being shared with players for feedback. The in-game version label lets players report which build they were on without needing to check the URL or any metadata. It's small and unobtrusive.

### `position: fixed` + `100dvh` for mobile layout
Mobile browsers show/hide the URL bar dynamically, which changes `100vh` and causes the canvas to shift. `position: fixed` on `<body>` pins the layout so it doesn't reflow when the URL bar animates. `100dvh` (dynamic viewport height) gives the actual available height rather than the maximum possible height.
