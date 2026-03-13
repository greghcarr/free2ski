import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';

export class PauseScene extends Phaser.Scene {
  private callerKey = SceneKey.Game;
  private session!: SessionConfig;

  constructor() {
    super({ key: SceneKey.Pause });
  }

  init(data: { callerKey?: SceneKey; session?: SessionConfig }): void {
    this.callerKey = data.callerKey ?? SceneKey.Game;
    this.session   = data.session  ?? { mode: GameMode.FreeSki, seed: Date.now() };
  }

  create(): void {
    // Dim overlay
    this.add.rectangle(WORLD_WIDTH / 2, GAME_HEIGHT / 2, WORLD_WIDTH, GAME_HEIGHT, COLORS.OVERLAY, 0.65);

    // Light blue card behind the menu
    const cardW = 540;
    const cardH = 570;
    const cardGfx = this.add.graphics();
    cardGfx.fillStyle(COLORS.HUD_BG, 0.);
    cardGfx.fillRoundedRect(WORLD_WIDTH / 2 - cardW / 2, 270, cardW, cardH, 18);

    this.add.text(WORLD_WIDTH / 2, 260, 'pause', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '150px',
      fontStyle: 'bold',
      color: COLORS.HUD_UTILITY,
    }).setOrigin(0.5);

    const resume = (): void => { this.scene.stop(); this.scene.resume(this.callerKey); };

    let nav: MenuNav | undefined;
    const resumeItem  = this.createButton(WORLD_WIDTH / 2, 440, 'resume',       resume, () => nav?.hoverAt(0));
    const restartItem = this.createButton(WORLD_WIDTH / 2, 630, 'restart run', () => {
      this.scene.stop(this.callerKey);
      this.scene.stop();
      this.scene.start(SceneKey.Game, { session: this.session });
    }, () => nav?.hoverAt(1));
    const quitItem    = this.createButton(WORLD_WIDTH / 2, 820, 'quit to menu', () => {
      this.scene.stop(this.callerKey);
      this.scene.stop();
      this.scene.start(SceneKey.MainMenu);
    }, () => nav?.hoverAt(2));
    nav = new MenuNav(this, [resumeItem, restartItem, quitItem]);

    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ESC', resume);
      this.input.keyboard.once('keydown-P', resume);
    }

    addVersionLabel(this, COLORS.VERSION_GAME);
    addUsernameLabel(this, COLORS.VERSION_GAME);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void, onHover?: () => void): MenuNavItem {
    const btnW = 600;
    const btnH = 140;

    const GLOW_LAYERS = [
      { pad: 42, alpha: 0.04 },
      { pad: 28, alpha: 0.08 },
      { pad: 18, alpha: 0.13 },
      { pad: 10, alpha: 0.18 },
      { pad:  4, alpha: 0.24 },
    ] as const;

    const container  = this.add.container(x, y);
    const glowGfx    = this.add.graphics();
    const bg         = this.add.graphics();
    const labelText  = this.add.text(0, 0, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '80px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add([glowGfx, bg, labelText]);

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-btnW / 2 - pad, -btnH / 2 - pad, btnW + pad * 2, btnH + pad * 2, 15 + pad);
      }
    };
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 15);
      labelText.setText(hovered ? `~ ${label} ~` : label);
      labelText.setColor('#ffffff');
    };
    drawBg(false);

    let pulseTween: Phaser.Tweens.Tween | null = null;

    const flashAndGo = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
      bg.clear();
      bg.fillStyle(0xddf4ff, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 15);
      labelText.setColor('#2a5ab8');
      this.tweens.add({
        targets:    container,
        scaleX:     1.07,
        scaleY:     1.07,
        duration:   55,
        ease:       'Quad.easeOut',
        yoyo:       true,
        onComplete: onClick,
      });
    };

    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      onHover?.(); drawGlow(true); drawBg(true);
      if (!pulseTween) pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    hit.on('pointerout', () => {
      drawGlow(false); drawBg(false);
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
    });
    hit.on('pointerdown', flashAndGo);

    return {
      setFocus: (f) => {
        drawGlow(f); drawBg(f);
        if (f && !pulseTween) {
          pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (!f && pulseTween) {
          pulseTween.stop(); pulseTween = null; container.setScale(1);
        }
      },
      activate: flashAndGo,
    };
  }
}
