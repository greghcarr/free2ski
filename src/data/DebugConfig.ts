import { GameMode } from '@/config/GameModes';
import { PX_PER_METER } from '@/data/constants';
import type { GameOverData } from '@/scenes/GameOverScene';

// ─── flip this one line to enable / disable all debug features ───
const ENABLED = false;
// ─────────────────────────────────────────────────────────────────

export const DEBUG = {
  /** Jump straight to GameOverScene for rapid UI iteration.
   *  Change gameOverMode to simulate a different mode's data. */
  gameOverMode: ENABLED ? GameMode.FreeSki : null as GameMode | null,

  /** Skip localStorage write on GameOver; always show "first run on record". */
  forceNewBest: ENABLED,

  /** Pre-show red glow on the name entry input field. */
  showInputGlow: ENABLED,
};

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
      score:          2400,
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
