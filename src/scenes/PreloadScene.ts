import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { HighScoreManager } from '@/data/HighScoreManager';
import { submitRun } from '@/services/LeaderboardService';
import { DEBUG, buildDebugGameOverData } from '@/data/DebugConfig';

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
    HighScoreManager.submitLegacyScores(submitRun).catch(() => {});
    if (DEBUG.gameOverMode !== null) {
      this.scene.start(SceneKey.GameOver, buildDebugGameOverData(DEBUG.gameOverMode));
      return;
    }
    this.scene.start(SceneKey.MainMenu);
  }
}
