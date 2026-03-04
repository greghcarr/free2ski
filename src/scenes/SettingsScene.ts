import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { addVersionLabel } from '@/ui/versionLabel';
import { HighScoreManager } from '@/data/HighScoreManager';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Settings });
  }

  create(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.add.text(WORLD_WIDTH / 2, 80, 'SETTINGS', {
      fontFamily: 'sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#1a3a8a',
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'Settings — coming soon.', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#3a5a9a',
    }).setOrigin(0.5);

    const resetItem = this.createDebugButton(WORLD_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'DEBUG: Reset All Stats', () => {
      HighScoreManager.reset();
    });

    new MenuNav(this, [resetItem]);

    this.add.text(60, GAME_HEIGHT - 50, '← Back', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#1a3a8a',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu));

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
  }

  private createDebugButton(x: number, y: number, label: string, onClick: () => void): MenuNavItem {
    const btnW = 280;
    const btnH = 42;
    const bg   = this.add.graphics();
    let   pending = false;

    const draw = (hovered: boolean): void => {
      bg.clear();
      if (pending) {
        bg.fillStyle(0xff2222, 1);
      } else {
        bg.fillStyle(hovered ? 0x884444 : 0x663333, 1);
      }
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 8);
    };
    draw(false);

    const txt = this.add.text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize:   '15px',
      color:      '#ffcccc',
    }).setOrigin(0.5);

    const activate = (): void => {
      if (!pending) {
        pending = true;
        txt.setText('Are you sure? Confirm to reset.');
        draw(false);
      } else {
        onClick();
        pending = false;
        txt.setText(label);
        draw(false);
      }
    };

    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => draw(true));
    hit.on('pointerout',   () => draw(false));
    hit.on('pointerdown',  activate);

    return {
      setFocus: (f) => draw(f),
      activate,
    };
  }
}
