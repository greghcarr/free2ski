import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, BACK_BTN_Y } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { HighScoreManager } from '@/data/HighScoreManager';
import { type MenuNavItem } from '@/ui/MenuNav';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Settings });
  }

  create(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.add.text(WORLD_WIDTH / 2, 400, 'settings', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '100px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);

    // Nav state
    let isBack = false;

    const resetItem = this.createDebugButton(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'DEBUG: Reset All Stats', () => {
      HighScoreManager.reset();
    });

    // Back button
    const backGoTo = () => this.scene.start(SceneKey.MainMenu);
    const backText = this.add.text(60, BACK_BTN_Y, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '50px',
      color: COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', backGoTo);

    const backUlY = (BACK_BTN_Y) + backText.displayHeight - 6;
    const prefixMeasure = this.add.text(0, 0, '← ', { fontFamily: 'FoxwhelpFont', fontSize: '50px' }).setVisible(false);
    const backWordX = 60 + prefixMeasure.displayWidth;
    const backWordW = backText.displayWidth - prefixMeasure.displayWidth;
    prefixMeasure.destroy();
    const backUnderline = this.add.graphics();
    backUnderline.fillStyle(parseInt(COLORS.UI_TITLE.slice(1), 16), 1);
    backUnderline.fillRect(backWordX, backUlY, backWordW, 4);
    backUnderline.setVisible(false);

    backText.on('pointerover', () => {
      resetItem.setFocus(false);
      backUnderline.setVisible(true);
      isBack = true;
    });
    backText.on('pointerout', () => {
      backUnderline.setVisible(false);
      isBack = false;
    });

    // Initial focus
    resetItem.setFocus(true);

    if (this.input.keyboard) {
      const kb = this.input.keyboard;
      kb.on('keydown-DOWN', () => {
        if (isBack) {
          backUnderline.setVisible(false);
          isBack = false;
          resetItem.setFocus(true);
        } else {
          resetItem.setFocus(false);
          backUnderline.setVisible(true);
          isBack = true;
        }
      });
      kb.on('keydown-UP', () => {
        if (isBack) {
          backUnderline.setVisible(false);
          isBack = false;
          resetItem.setFocus(true);
        } else {
          resetItem.setFocus(false);
          backUnderline.setVisible(true);
          isBack = true;
        }
      });
      kb.on('keydown-SPACE', () => { isBack ? backGoTo() : resetItem.activate(); });
      kb.on('keydown-ENTER', () => { isBack ? backGoTo() : resetItem.activate(); });
      kb.on('keydown-ESC',   () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
    addUsernameLabel(this);
  }

  private createDebugButton(x: number, y: number, label: string, onClick: () => void): MenuNavItem {
    const btnW = 800;
    const btnH = 100;
    const bg   = this.add.graphics();
    let   pending = false;

    const txt = this.add.text(x, y, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '50px',
      color:      COLORS.DESTRUCT_TEXT,
    }).setOrigin(0.5);

    const draw = (hovered: boolean): void => {
      bg.clear();
      if (pending) {
        bg.fillStyle(COLORS.DESTRUCT_CONFIRM, 1);
        txt.setText('Are you sure? Once more to reset.');
      } else {
        bg.fillStyle(hovered ? COLORS.DESTRUCT_HOVER : COLORS.DESTRUCT_BTN, 1);
        txt.setText(hovered ? `~ ${label} ~` : label);
      }
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
    };
    draw(false);

    const activate = (): void => {
      if (!pending) {
        pending = true;
        draw(false);
      } else {
        onClick();
        pending = false;
        draw(false);
      }
    };

    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => draw(true));
    hit.on('pointerout',   () => { pending = false; draw(false); });
    hit.on('pointerdown',  activate);

    return {
      setFocus: (f) => { if (!f) pending = false; draw(f); },
      activate,
    };
  }
}
