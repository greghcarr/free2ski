# free2ski

A retro skiing game inspired by the classic SkiFree, rebuilt from scratch with modern web tech. Three modes, an online leaderboard, powerups, and a yeti that never gives up. All art is vector — no sprites, no pixel art.

Built with Phaser 3, TypeScript, and Vite. Playable in the browser and coming to Steam.

**[Play now →](https://greghcarr.github.io/free2ski/)**

---

## Modes

| Mode | Description |
|------|-------------|
| **Free Ski** | Ski as far as you can. The yeti appears at 2000m and gets faster with every wave. Collect stars for invincibility and lightning bolts for a speed boost. |
| **Slalom** | Race through 25 gates as fast as possible. Missed gates add a 5-second penalty. |
| **Jump** | Hit ramps to jump over trees and score points. Complete the course to save your score. |

## Controls

| Input | Action |
|-------|--------|
| Arrow keys / WASD | Steer |
| Up / W | Brake |
| Click / tap | Steer toward pointer |
| ESC / P | Pause |

## Development

### Prerequisites
- Node.js 20+
- npm

### Setup
```bash
npm install
```

### Run (web)
```bash
npm run dev:web
# Opens at http://localhost:8080
```

### Build (web)
```bash
npm run build:web
# Output: dist/web/
```

### Run (Electron desktop)
```bash
npm run dev:electron
```

### Package (desktop installers)
```bash
npm run dist:mac   # macOS .dmg
npm run dist:win   # Windows .exe
```

## Project Docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — branching workflow and versioning guidelines
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — version history
- [docs/DECISIONS.md](docs/DECISIONS.md) — architectural decision log
- [docs/DEVLOG.md](docs/DEVLOG.md) — development diary

## Status

**v0.4.0-pre-alpha** — actively in development. Feedback welcome.
