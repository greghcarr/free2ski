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

    this.add.text(WORLD_WIDTH / 2, 120, 'SETTINGS', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '60px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'Settings — coming soon.', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '33px',
      color: COLORS.UI_SUBTITLE,
    }).setOrigin(0.5);

    const resetItem = this.createDebugButton(WORLD_WIDTH / 2, GAME_HEIGHT / 2 + 90, 'DEBUG: Reset All Stats', () => {
      HighScoreManager.reset();
    });

    new MenuNav(this, [resetItem]);

    this.add.text(60, GAME_HEIGHT - 100, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '50px',
      color: COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu));

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
  }

  private createDebugButton(x: number, y: number, label: string, onClick: () => void): MenuNavItem {
    const btnW = 420;
    const btnH = 63;
    const bg   = this.add.graphics();
    let   pending = false;

    const draw = (hovered: boolean): void => {
      bg.clear();
      if (pending) {
        bg.fillStyle(COLORS.DESTRUCT_CONFIRM, 1);
      } else {
        bg.fillStyle(hovered ? COLORS.DESTRUCT_HOVER : COLORS.DESTRUCT_BTN, 1);
      }
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
    };
    draw(false);

    const txt = this.add.text(x, y, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '23px',
      color:      COLORS.DESTRUCT_TEXT,
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
