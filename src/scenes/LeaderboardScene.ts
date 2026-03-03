import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Leaderboard });
  }

  create(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.add.text(WORLD_WIDTH / 2, 80, 'LEADERBOARD', {
      fontFamily: 'sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#1a3a8a',
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'Steam leaderboards — coming soon.\nPlay some runs first!', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#3a5a9a',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(60, GAME_HEIGHT - 50, '← Back', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#1a3a8a',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu));
  }
}
