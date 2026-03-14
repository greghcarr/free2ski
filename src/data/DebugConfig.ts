import { GameMode } from '@/config/GameModes';
import { PX_PER_METER } from '@/data/constants';
import type { GameOverData } from '@/scenes/GameOverScene';

// ─── flip this to turn all debug features on / off ───────────────────────────
const ENABLED = false;
// ─────────────────────────────────────────────────────────────────────────────

// Scene routing — set one to skip directly to that scene (null = normal flow).
// Only one should be non-null at a time. Gated by ENABLED.
const GAME_SCENE_MODE:  GameMode | null = GameMode.Jump;  // or null
const GAME_OVER_MODE:   GameMode | null = null;               // or GameMode.Slalom / .Jump / .FreeSki

// prettier-ignore
export const DEBUG = {
  gameSceneMode: ENABLED ? GAME_SCENE_MODE : null,
  gameOverMode:  ENABLED ? GAME_OVER_MODE  : null,

  // ── GameScene tweaks ──────────────────────────────────────────────────────
  /** Stop all world progression — player, obstacles, yeti all frozen in place. */
  freezeWorld:    ENABLED,
  /** Freeze the natural speed ramp — stays at BASE_SCROLL_SPEED. */
  freezeSpeed:    ENABLED,
  /** Spawn the yeti immediately on game start (FreeSki only). */
  forceYetiSpawn: ENABLED,
  /** Allow pressing T to cycle jump score tiers (normal → daily → best → wr). */
  cycleTiers:     ENABLED,

  // ── GameOverScene tweaks ──────────────────────────────────────────────────
  /** Always show "first run on record" — skips localStorage write. */
  forceNewBest:     ENABLED,
  /** Pre-show red glow on the name entry input field. */
  showInputGlow:    ENABLED,
  /** Skip leaderboard fetch and immediately show the world record badge. */
  forceWorldRecord: ENABLED,

  // ── MainMenu tweaks ───────────────────────────────────────────────────────
  /** Show a time-of-day slider on the main menu to preview sky effects. */
  skyDebugHour: false,
};

export const DEBUG_ENABLED = ENABLED;

/** Builds synthetic GameOverData for the given mode (debug only). */
export function buildDebugGameOverData(mode: GameMode): GameOverData {
  const session = { mode };
  if (mode === GameMode.Slalom) {
    return {
      session,
      distancePx:     0,
      score:          1200,
      caughtByYeti:   false,
      courseComplete: true,
      finishTimeMs:   94200,
      penaltyMs:      5000,
      gatesPassed:    24,
      gatesMissed:    1,
    };
  }
  if (mode === GameMode.Jump) {
    return {
      session,
      distancePx:     5000 * PX_PER_METER,
      score:          1,
      caughtByYeti:   false,
      courseComplete: true,
    };
  }
  // FreeSki default: caught by yeti at ~3600m, 2 evaded
  return {
    session,
    distancePx:   3600 * PX_PER_METER,
    score:        2,
    caughtByYeti: true,
    yetisEvaded:  2,
  };
}
