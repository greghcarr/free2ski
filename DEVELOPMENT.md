# Development Standards

## Branching & Deployment

Two permanent branches:

| Branch | Purpose |
|--------|---------|
| `main` | Production. GitHub Pages deploys from here. Only merge into this intentionally. |
| `dev`  | Daily work. All commits go here. Pushing to `dev` does not trigger a deploy. |

### Daily workflow

Work on `dev` throughout the day:

```bash
git add <files>
git commit -m "..."
git push   # safe — no deploy triggered
```

End-of-day promotion to production:

```bash
git checkout main
git merge dev --ff-only   # refuses if history has diverged — safety net
git push                  # triggers GitHub Pages deploy
git checkout dev          # return to dev immediately
```

### When to bump the version

Version bumps track meaningful milestones, not calendar days.

- **Do bump** when promoting a notable feature, fix, or set of changes a player would notice.
- **Don't bump** for minor tweaks (typo fixes, color adjustments, refactors).
- Rule of thumb: if you'd write a changelog entry for it, bump the version. If not, don't.

You may go several nightly merges without a version change, and that's fine.

---

### Starting a new session

Always confirm you're on `dev` before coding:

```bash
git checkout dev
git status
```

---

## Versioning

Version is stored in two places — keep them in sync:

- [`src/ui/versionLabel.ts`](src/ui/versionLabel.ts) — `APP_VERSION` string displayed in-game
- [`package.json`](package.json) — `"version"` field

Format: `MAJOR.MINOR.PATCH[-pre-alpha|-alpha|-beta]`

Bump the version with each production push to `main`.
