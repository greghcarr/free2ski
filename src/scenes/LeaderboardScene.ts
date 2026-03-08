import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { addVersionLabel } from '@/ui/versionLabel';

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Leaderboard });
  }

  create(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.add.text(WORLD_WIDTH / 2, 120, 'LEADERBOARD', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '60px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'Steam leaderboards — coming soon.\nPlay some runs first!', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '33px',
      color: COLORS.UI_SUBTITLE,
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(60, GAME_HEIGHT - 50, '← Back', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '30px',
      color: COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu));

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
  }
}
