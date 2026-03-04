import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { addVersionLabel } from '@/ui/versionLabel';

export class PauseScene extends Phaser.Scene {
  private callerKey = SceneKey.Game;

  constructor() {
    super({ key: SceneKey.Pause });
  }

  init(data: { callerKey?: SceneKey }): void {
    this.callerKey = data.callerKey ?? SceneKey.Game;
  }

  create(): void {
    // Dim overlay
    this.add.rectangle(WORLD_WIDTH / 2, GAME_HEIGHT / 2, WORLD_WIDTH, GAME_HEIGHT, 0x000020, 0.55);

    this.add.text(WORLD_WIDTH / 2, 240, 'PAUSED', {
      fontFamily: 'sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.createButton(WORLD_WIDTH / 2, 340, 'RESUME', () => {
      this.scene.stop();
      this.scene.resume(this.callerKey);
    });

    this.createButton(WORLD_WIDTH / 2, 420, 'SETTINGS', () => {
      this.scene.start(SceneKey.Settings);
    });

    this.createButton(WORLD_WIDTH / 2, 500, 'QUIT TO MENU', () => {
      this.scene.stop(this.callerKey);
      this.scene.stop();
      this.scene.start(SceneKey.MainMenu);
    });

    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ESC', () => {
        this.scene.stop();
        this.scene.resume(this.callerKey);
      });
    }

    addVersionLabel(this, '#8aaabb');
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btnW = 260;
    const btnH = 54;
    const bg = this.add.graphics();
    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? 0x3a6ae8 : 0x2a5ab8, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
    };
    draw(false);
    this.add.text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);
  }
}
