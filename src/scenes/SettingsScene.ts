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

    const GLOW_LAYERS = [
      { pad: 42, alpha: 0.04 },
      { pad: 28, alpha: 0.08 },
      { pad: 18, alpha: 0.13 },
      { pad: 10, alpha: 0.18 },
      { pad:  4, alpha: 0.24 },
    ] as const;

    const container = this.add.container(x, y);
    const glowGfx   = this.add.graphics();
    const rowBg     = this.add.graphics();
    const labelText = this.add.text(-W / 2 + 30, 0, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '54px',
      color:      '#ffffff',
    }).setOrigin(0, 0.5);
    const stateText = this.add.text(W / 2 - 30, 0, '', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '54px',
    }).setOrigin(1, 0.5);
    container.add([glowGfx, rowBg, labelText, stateText]);

    let isFocused  = false;
    let pulseTween: Phaser.Tweens.Tween | null = null;

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-W / 2 - pad, -H / 2 - pad, W + pad * 2, H + pad * 2, 12 + pad);
      }
    };
    const startPulse = (): void => {
      if (!pulseTween) pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    const stopPulse = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
    };

    const draw = (focused: boolean): void => {
      isFocused = focused;
      rowBg.clear();
      rowBg.fillStyle(focused ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      rowBg.fillRoundedRect(-W / 2, -H / 2, W, H, 12);
      const isOn = this.scale.isFullscreen;
      stateText.setText(isOn ? 'on' : 'off');
      stateText.setColor(isOn ? '#4caf50' : '#888888');
    };
    draw(false);

    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => draw(isFocused));
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN,  () => draw(isFocused));

    const activate = (): void => { onToggle(); };

    const hit = this.add.rectangle(x, y, W, H).setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => { draw(true);  drawGlow(true);  startPulse(); });
    hit.on('pointerout',   () => { draw(false); drawGlow(false); stopPulse();  });
    hit.on('pointerdown',  activate);

    return {
      setFocus: (f) => {
        draw(f); drawGlow(f);
        if (f) startPulse(); else stopPulse();
      },
      activate,
    };
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
