import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, GATE_POLE_RADIUS, BACK_BTN_Y } from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { HighScoreManager } from '@/data/HighScoreManager';
import { formatRaceTime } from '@/utils/MathUtils';
import { type MenuNavItem } from '@/ui/MenuNav';

const MODES = [GameMode.Slalom, GameMode.FreeSki, GameMode.Jump];
export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.ModeSelect });
  }

  create(): void {
    // Dim overlay over the main menu scene running behind
    const bg = this.add.graphics();
    bg.fillStyle(0x00081a, 0.62);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // this.add.text(WORLD_WIDTH / 2, 220, 'modes', {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize: '130px',
    //   fontStyle: 'bold',
    //   color: COLORS.UI_TITLE,
    // }).setOrigin(0.5);

    const cardW = 550;
    const cardH = 675;
    const spacing = 30;
    const totalW = MODES.length * cardW + (MODES.length - 1) * spacing;
    const startX = (WORLD_WIDTH - totalW) / 2 + cardW / 2;

    // Nav state: which card is remembered, and whether "back" is focused
    let cardIndex = 1; // FreeSki — first keypress lands here
    let isBack = false;
    let cardFocused = false;

    const cardItems: MenuNavItem[] = MODES.map((mode, i) => {
      const cfg = GAME_MODE_CONFIGS[mode];
      const cx = startX + i * (cardW + spacing);
      const cy = GAME_HEIGHT / 2 + 10;
      return this.createModeCard(cx, cy, cardW, cardH, mode, cfg.displayName, cfg.description, () => {
        const session: SessionConfig = { mode, seed: Date.now() };
        this.scene.stop(SceneKey.MainMenu);
        this.scene.start(SceneKey.Game, { session });
      }, () => { cardIndex = i; isBack = false; cardFocused = false; });
    });

    // Back button — centred, full styled button
    const backItem = this.createNavButton(WORLD_WIDTH / 2, BACK_BTN_Y + 40, 400, 110, 'back', () => {
      this.scene.stop(); this.scene.resume(SceneKey.MainMenu);
    }, () => {
      cardItems.forEach(item => item.setFocus(false));
      isBack = true; cardFocused = false;
    });

    if (this.input.keyboard) {
      const kb = this.input.keyboard;

      const focusBack = (): void => {
        cardItems[cardIndex]!.setFocus(false);
        backItem.setFocus(true);
        isBack = true; cardFocused = false;
      };
      const focusCards = (): void => {
        backItem.setFocus(false);
        cardFocused = true; isBack = false;
        cardItems[cardIndex]!.setFocus(true);
      };

      kb.on('keydown-LEFT', () => {
        if (isBack) return;
        if (!cardFocused) { cardFocused = true; cardItems[cardIndex]!.setFocus(true); return; }
        cardItems[cardIndex]!.setFocus(false);
        cardIndex = (cardIndex - 1 + MODES.length) % MODES.length;
        cardItems[cardIndex]!.setFocus(true);
      });
      kb.on('keydown-RIGHT', () => {
        if (isBack) return;
        if (!cardFocused) { cardFocused = true; cardItems[cardIndex]!.setFocus(true); return; }
        cardItems[cardIndex]!.setFocus(false);
        cardIndex = (cardIndex + 1) % MODES.length;
        cardItems[cardIndex]!.setFocus(true);
      });
      kb.on('keydown-DOWN', () => {
        if (isBack)         focusCards();
        else if (cardFocused) focusBack();
        else                { cardFocused = true; cardItems[cardIndex]!.setFocus(true); }
      });
      kb.on('keydown-UP', () => {
        if (isBack)         focusCards();
        else if (cardFocused) focusBack();
        else                { cardFocused = true; cardItems[cardIndex]!.setFocus(true); }
      });
      kb.on('keydown-SPACE', () => { isBack ? backItem.activate() : cardItems[cardIndex]!.activate(); });
      kb.on('keydown-ENTER', () => { isBack ? backItem.activate() : cardItems[cardIndex]!.activate(); });
      kb.on('keydown-ESC',   () => { this.scene.stop(); this.scene.resume(SceneKey.MainMenu); });
    }

    addVersionLabel(this);
    addUsernameLabel(this);
  }

  private createNavButton(
    x: number, y: number,
    w: number, h: number,
    label: string,
    onClick: () => void,
    onHover?: () => void,
  ): MenuNavItem {
    const GLOW_LAYERS = [
      { pad: 42, alpha: 0.04 },
      { pad: 28, alpha: 0.08 },
      { pad: 18, alpha: 0.13 },
      { pad: 10, alpha: 0.18 },
      { pad:  4, alpha: 0.24 },
    ] as const;

    const container = this.add.container(x, y);
    const glowGfx   = this.add.graphics();
    const bg        = this.add.graphics();
    const labelText = this.add.text(0, 0, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '70px',
      fontStyle:  'bold',
      color:      COLORS.UI_TITLE,
    }).setOrigin(0.5);
    container.add([glowGfx, bg, labelText]);

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 15 + pad);
      }
    };
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.CARD_HOVER : COLORS.CARD, 1);
      bg.lineStyle(3, COLORS.BTN, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 15);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 15);
      labelText.setText(hovered ? `~ ${label} ~` : label);
    };
    drawBg(false);

    let pulseTween: Phaser.Tweens.Tween | null = null;
    const startPulse = (): void => {
      if (!pulseTween) pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    const stopPulse = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
    };
    const flashAndGo = (): void => {
      stopPulse();
      bg.clear();
      bg.fillStyle(0xddf4ff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 15);
      labelText.setColor('#2a5ab8');
      this.tweens.add({ targets: container, scaleX: 1.07, scaleY: 1.07, duration: 55, ease: 'Quad.easeOut', yoyo: true, onComplete: onClick });
    };

    const hit = this.add.rectangle(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { onHover?.(); drawGlow(true); drawBg(true); startPulse(); });
    hit.on('pointerout',  () => { drawGlow(false); drawBg(false); stopPulse(); });
    hit.on('pointerdown', flashAndGo);

    return {
      setFocus: (f) => {
        drawGlow(f); drawBg(f);
        if (f) startPulse(); else stopPulse();
      },
      activate: flashAndGo,
    };
  }

  private createModeCard(
    cx: number,
    cy: number,
    w: number,
    h: number,
    mode: GameMode,
    title: string,
    desc: string,
    onClick: () => void,
    onHover?: () => void,
  ): MenuNavItem {
    const GLOW_LAYERS = [
      { pad: 42, alpha: 0.04 },
      { pad: 28, alpha: 0.08 },
      { pad: 18, alpha: 0.13 },
      { pad: 10, alpha: 0.18 },
      { pad:  4, alpha: 0.24 },
    ] as const;

    const container  = this.add.container(cx, cy);
    const glowGfx    = this.add.graphics();
    const bg         = this.add.graphics();
    const titleText  = this.add.text(0, -h / 2 + 145, title, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '100px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);
    const descText   = this.add.text(0, -h / 2 + 220, desc, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '50px',
      color: COLORS.UI_SUBTITLE,
      wordWrap: { width: w - 100 },
      align: 'center',
    }).setOrigin(0.5, 0);
    const illustGfx  = this.drawModeIllustration(mode);
    const bestText   = this.add.text(0, 225, this.bestLabel(mode), {
      fontFamily: 'FoxwhelpFont',
      fontSize: '38px',
      fontStyle: 'bold italic',
      color: COLORS.UI_SUBTITLE,
      align: 'center',
    }).setOrigin(0.5, 1);
    const dailyText  = this.add.text(0, 275, this.dailyLabel(mode), {
      fontFamily: 'FoxwhelpFont',
      fontSize: '38px',
      fontStyle: 'bold italic',
      color: COLORS.UI_SUBTITLE,
      align: 'center',
    }).setOrigin(0.5, 1);
    container.add([glowGfx, bg, illustGfx, titleText, descText, bestText, dailyText]);

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 18 + pad);
      }
    };
    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.CARD_HOVER : COLORS.CARD, 1);
      bg.lineStyle(3, COLORS.BTN, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      titleText.setText(hovered ? `~ ${title} ~` : title);
    };
    draw(false);

    let pulseTween: Phaser.Tweens.Tween | null = null;
    const startPulse = (): void => {
      if (!pulseTween) pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    const stopPulse = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
    };
    const flashAndGo = (): void => {
      stopPulse();
      bg.clear();
      bg.fillStyle(0xddf4ff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      titleText.setColor('#2a5ab8');
      this.tweens.add({ targets: container, scaleX: 1.07, scaleY: 1.07, duration: 55, ease: 'Quad.easeOut', yoyo: true, onComplete: onClick });
    };

    // Hit area stays outside the container so it doesn't scale with it
    const hit = this.add.rectangle(cx, cy, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { onHover?.(); drawGlow(true); draw(true); startPulse(); });
    hit.on('pointerout',  () => { drawGlow(false); draw(false); stopPulse(); });
    hit.on('pointerdown', flashAndGo);

    return {
      setFocus: (f) => {
        drawGlow(f); draw(f);
        if (f) startPulse(); else stopPulse();
      },
      activate: flashAndGo,
    };
  }

  private dailyLabel(mode: GameMode): string {
    const best = HighScoreManager.getDailyBest(mode);
    if (!best) return 'daily: —';
    switch (mode) {
      case GameMode.FreeSki: return `daily: ${best.distance.toLocaleString()} m`;
      case GameMode.Slalom:  return best.timeMs !== undefined ? `daily: ${formatRaceTime(best.timeMs)}` : 'daily: —';
      case GameMode.Jump:    return `daily: ${best.score}`;
    }
  }

  private bestLabel(mode: GameMode): string {
    const best = HighScoreManager.getBest(mode);
    if (!best) return 'no personal best yet';
    switch (mode) {
      case GameMode.FreeSki: return `personal best: ${best.distance.toLocaleString()} m`;
      case GameMode.Slalom:  return best.timeMs !== undefined ? `personal best: ${formatRaceTime(best.timeMs)}` : 'no personal best yet';
      case GameMode.Jump:    return `personal best: ${best.score}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Per-mode illustrations — exact same drawing logic as the in-game entities,
  // scaled to fit the lower half of a 360×390 card.
  // ---------------------------------------------------------------------------

  private drawModeIllustration(mode: GameMode): Phaser.GameObjects.Graphics {
    switch (mode) {
      case GameMode.FreeSki: return this.drawTree();
      case GameMode.Slalom:  return this.drawGate();
      case GameMode.Jump:    return this.drawRamp();
    }
  }

  /**
   * Pine tree — matches Tree.ts drawTree() at scale 3.0.
   * Drawn relative to (0, 0) — place inside a Container at (cx, cy).
   */
  private drawTree(): Phaser.GameObjects.Graphics {
    const g  = this.add.graphics();
    const s  = 3.0;
    const cx = 0;
    const oy = 115;  // shift so visual mass sits in lower card half

    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(cx + 4 * s, oy + 10 * s, 28 * s, 10 * s);

    g.fillStyle(COLORS.TREE_TRUNK, 1);
    g.fillRect(cx - 3 * s, oy + 4 * s, 6 * s, 10 * s);

    g.fillStyle(COLORS.TREE_DARK, 1);
    g.fillTriangle(cx - 15 * s, oy + 8 * s, cx + 15 * s, oy + 8 * s, cx, oy - 6 * s);

    g.fillStyle(COLORS.TREE_MID, 1);
    g.fillTriangle(cx - 11 * s, oy + 1 * s, cx + 11 * s, oy + 1 * s, cx, oy - 16 * s);

    g.fillStyle(COLORS.TREE_TOP, 1);
    g.fillTriangle(cx - 7 * s, oy - 7 * s, cx + 7 * s, oy - 7 * s, cx, oy - 22 * s);

    return g;
  }

  /**
   * Slalom gate — matches SlalomGate.ts at a scaled-down half-gap so it fits
   * within the 360 px card width.
   * Drawn relative to (0, 0) — place inside a Container at (cx, cy).
   */
  private drawGate(): Phaser.GameObjects.Graphics {
    const g        = this.add.graphics();
    const halfGap  = 82;
    const halfPole = GATE_POLE_RADIUS;
    const poleH    = 84;
    const bannerH  = 21;
    const cx       = 0;
    const oy       = 110;

    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(cx - halfGap, oy + poleH / 2 + 4, halfPole * 4, 8);
    g.fillEllipse(cx + halfGap, oy + poleH / 2 + 4, halfPole * 4, 8);

    const colorVal = COLORS.GATE_LEFT;

    g.fillStyle(colorVal, 1);
    g.fillRect(cx - halfGap - halfPole, oy - poleH / 2, halfPole * 2, poleH);
    g.fillRect(cx + halfGap - halfPole, oy - poleH / 2, halfPole * 2, poleH);

    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - halfGap - halfPole, oy - poleH / 2 + 4, halfPole * 2, 10);
    g.fillRect(cx + halfGap - halfPole, oy - poleH / 2 + 4, halfPole * 2, 10);

    g.fillStyle(colorVal, 0.80);
    g.fillRect(cx - halfGap, oy - bannerH / 2, halfGap * 2, bannerH);

    g.fillStyle(0xffffff, 0.50);
    g.fillRect(cx - halfGap + 8, oy - 3, halfGap * 2 - 16, 6);

    return g;
  }

  /**
   * Jump ramp — matches Ramp.ts at scale 3×.
   * Drawn relative to (0, 0) — place inside a Container at (cx, cy).
   */
  private drawRamp(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const s = 3;

    const RAMP_W = 70, RAMP_D = 28, CORNER = 7;
    const hw   = (RAMP_W / 2) * s;
    const hd   = (RAMP_D / 2) * s;
    const lipH = 7 * s;
    const cx   = 0;
    const oy   = 105;

    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(cx - hw + 4 * s, oy + hd - 2 * s, RAMP_W * s, 10 * s, 4);

    g.fillStyle(COLORS.RAMP_SURFACE, 1);
    g.fillRoundedRect(cx - hw, oy - hd, RAMP_W * s, RAMP_D * s, CORNER * s);

    g.fillStyle(COLORS.RAMP_HIGHLIGHT, 0.70);
    g.fillRoundedRect(cx - hw + 4 * s, oy - hd + 2 * s, (RAMP_W - 8) * s, RAMP_D * 0.45 * s, (CORNER - 2) * s);

    g.fillStyle(COLORS.RAMP_LIP, 1);
    g.fillRoundedRect(cx - hw, oy + hd - lipH, RAMP_W * s, lipH, { tl: 0, tr: 0, bl: CORNER * s, br: CORNER * s });

    const asx  = 3 * s;
    const asy1 = oy - hd + 5 * s;
    const asy2 = oy - hd + 14 * s;
    const ahw  = 11 * s;
    const atip = oy + hd - lipH - 2 * s;

    const drawArrow = (): void => {
      g.beginPath();
      g.moveTo(cx - asx, asy1);
      g.lineTo(cx + asx, asy1);
      g.lineTo(cx + asx, asy2);
      g.lineTo(cx + ahw, asy2);
      g.lineTo(cx,       atip);
      g.lineTo(cx - ahw, asy2);
      g.lineTo(cx - asx, asy2);
      g.closePath();
    };

    g.fillStyle(COLORS.RAMP_ARROW, 0.92);
    drawArrow();
    g.fillPath();

    g.lineStyle(1.5, 0x000000, 0.80);
    drawArrow();
    g.strokePath();

    g.lineStyle(1.5, COLORS.RAMP_OUTLINE, 0.8);
    g.strokeRoundedRect(cx - hw, oy - hd, RAMP_W * s, RAMP_D * s, CORNER * s);

    return g;
  }
}
