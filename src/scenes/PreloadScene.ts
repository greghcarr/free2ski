import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, DEBUG_GAME_OVER_MODE, PX_PER_METER } from '@/data/constants';
import { GameMode } from '@/config/GameModes';
import type { GameOverData } from '@/scenes/GameOverScene';
import { HighScoreManager } from '@/data/HighScoreManager';
import { claimUsername, submitRun } from '@/services/LeaderboardService';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Preload });
  }

  preload(): void {
    // Draw a loading bar using the Graphics API
    const barW = 600;
    const barH = 30;
    const barX = (WORLD_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT / 2 - barH / 2;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.HUD_BG, 0.8);
    bg.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const bar = this.add.graphics();

    const label = this.add.text(WORLD_WIDTH / 2, barY - 36, 'Loading…', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '27px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(COLORS.PLAYER, 1);
      bar.fillRect(barX, barY, barW * value, barH);
      label.setText(`Loading… ${Math.floor(value * 100)}%`);
    });

    // No external assets yet — all art is drawn with the Graphics API.
    // Future: this.load.atlas('sprites', 'assets/images/sprites.png', 'assets/images/sprites.json');
  }

  create(): void {
    HighScoreManager.initUsername(claimUsername)
      .then(() => HighScoreManager.submitLegacyScores(submitRun))
      .catch(() => { /* network unavailable */ });
    if (DEBUG_GAME_OVER_MODE !== null) {
      this.scene.start(SceneKey.GameOver, buildDebugGameOverData(DEBUG_GAME_OVER_MODE));
      return;
    }
    this.scene.start(SceneKey.MainMenu);
  }
}

function buildDebugGameOverData(mode: string): GameOverData {
  const session = { mode: mode as GameMode };
  if (mode === GameMode.Slalom) {
    // Simulate a completed slalom run: 1 missed gate, 24 passed, +5s penalty
    return {
      session,
      distancePx:      0,
      score:           1200,
      caughtByYeti:    false,
      courseComplete:  true,
      finishTimeMs:    94200,
      penaltyMs:       5000,
      gatesPassed:     24,
      gatesMissed:     1,
    };
  }
  if (mode === GameMode.Jump) {
    // Simulate a completed jump run
    return {
      session,
      distancePx:     5000 * PX_PER_METER,
      score:          2400,
      caughtByYeti:   false,
      courseComplete: true,
    };
  }
  // FreeSki default: wipeout at 3500m, 2 yetis evaded
  return {
    session,
    distancePx:   3600 * PX_PER_METER,
    score:        2,
    caughtByYeti: true,
    yetisEvaded:  2,
  };
}
