import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Preload });
  }

  preload(): void {
    // Draw a loading bar using the Graphics API
    const barW = 400;
    const barH = 20;
    const barX = (WORLD_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT / 2 - barH / 2;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.HUD_BG, 0.8);
    bg.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const bar = this.add.graphics();

    const label = this.add.text(WORLD_WIDTH / 2, barY - 24, 'Loading…', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
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
    this.scene.start(SceneKey.MainMenu);
  }
}
