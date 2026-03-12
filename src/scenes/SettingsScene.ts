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

    // Simple linear nav — UP/DOWN cycles through all items
    const navItems: MenuNavItem[] = [];
    let focusIdx = 0;

    const setFocus = (idx: number): void => {
      navItems[focusIdx]?.setFocus(false);
      focusIdx = (idx + navItems.length) % navItems.length;
      navItems[focusIdx]?.setFocus(true);
    };

    // ── Fullscreen toggle ────────────────────────────────────────────────────
    navItems.push(this.createToggle(WORLD_WIDTH / 2, 560, 'fullscreen', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else                         this.scale.startFullscreen();
    }));

    // ── Reset stats (debug) — hidden for now ────────────────────────────────
    // navItems.push(this.createDebugButton(WORLD_WIDTH / 2, 700, 'DEBUG: Reset All Stats', () => {
    //   HighScoreManager.reset();
    // }));

    // ── Back button ──────────────────────────────────────────────────────────
    const backGoTo = () => this.scene.start(SceneKey.MainMenu);
    const backText = this.add.text(60, BACK_BTN_Y, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '50px',
      color: COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', backGoTo);

    const backUlY      = BACK_BTN_Y + backText.displayHeight - 6;
    const prefix       = this.add.text(0, 0, '← ', { fontFamily: 'FoxwhelpFont', fontSize: '50px' }).setVisible(false);
    const backWordX    = 60 + prefix.displayWidth;
    const backWordW    = backText.displayWidth - prefix.displayWidth;
    prefix.destroy();
    const backUnderline = this.add.graphics();
    backUnderline.fillStyle(parseInt(COLORS.UI_TITLE.slice(1), 16), 1);
    backUnderline.fillRect(backWordX, backUlY, backWordW, 4);
    backUnderline.setVisible(false);

    navItems.push({
      setFocus: (f) => backUnderline.setVisible(f),
      activate: backGoTo,
    });
    backText.on('pointerover', () => setFocus(navItems.length - 1));

    // ── Initial focus + keyboard nav ─────────────────────────────────────────
    setFocus(0);

    if (this.input.keyboard) {
      const kb = this.input.keyboard;
      kb.on('keydown-DOWN',  () => setFocus(focusIdx + 1));
      kb.on('keydown-UP',    () => setFocus(focusIdx - 1));
      kb.on('keydown-SPACE', () => navItems[focusIdx]?.activate());
      kb.on('keydown-ENTER', () => navItems[focusIdx]?.activate());
      kb.on('keydown-ESC',   () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
    addUsernameLabel(this);
  }

  // ─── Toggle row ─────────────────────────────────────────────────────────────
  // Full-width row with a label on the left and an on/off indicator on the right.

  private createToggle(x: number, y: number, label: string, onToggle: () => void): MenuNavItem {
    const W = 700, H = 90;

    const rowBg = this.add.graphics();

    const labelText = this.add.text(x - W / 2 + 30, y, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '54px',
      color:      '#ffffff',
    }).setOrigin(0, 0.5);

    const stateText = this.add.text(x + W / 2 - 30, y, '', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '54px',
    }).setOrigin(1, 0.5);

    const draw = (focused: boolean): void => {
      rowBg.clear();
      rowBg.fillStyle(focused ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      rowBg.fillRoundedRect(x - W / 2, y - H / 2, W, H, 12);
      // Read current state after the toggle has had a chance to apply
      const isOn = this.scale.isFullscreen;
      stateText.setText(isOn ? 'on' : 'off');
      stateText.setColor(isOn ? '#4caf50' : '#888888');
      // suppress TS unused-var warning
      void labelText;
    };
    draw(false);

    const activate = (): void => {
      onToggle();
      // Delay one frame so scale.isFullscreen reflects the new state
      this.time.delayedCall(50, () => draw(true));
    };

    const hit = this.add.rectangle(x, y, W, H).setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => draw(true));
    hit.on('pointerout',   () => draw(false));
    hit.on('pointerdown',  activate);

    return { setFocus: draw, activate };
  }

  // ─── Destructive confirm button ──────────────────────────────────────────────

  private createDebugButton(x: number, y: number, label: string, onClick: () => void): MenuNavItem {
    const btnW = 700;
    const btnH = 90;
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
