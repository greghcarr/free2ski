import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, GATE_POLE_RADIUS } from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { addVersionLabel } from '@/ui/versionLabel';
import { HighScoreManager } from '@/data/HighScoreManager';
import { formatRaceTime } from '@/utils/MathUtils';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';

const MODES = [GameMode.Slalom, GameMode.FreeSki, GameMode.Jump];

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.ModeSelect });
  }

  create(): void {
    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.add.text(WORLD_WIDTH / 2, 240, 'SELECT MODE', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '60px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, 303, `Total runs: ${HighScoreManager.getTotalRuns()}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '24px',
      color: COLORS.UI_SUBTITLE,
    }).setOrigin(0.5);

    const cardW = 360;
    const cardH = 390;
    const spacing = 30;
    const totalW = MODES.length * cardW + (MODES.length - 1) * spacing;
    const startX = (WORLD_WIDTH - totalW) / 2 + cardW / 2;

    let nav: MenuNav | undefined;
    const cardItems: MenuNavItem[] = MODES.map((mode, i) => {
      const cfg = GAME_MODE_CONFIGS[mode];
      const cx = startX + i * (cardW + spacing);
      const cy = GAME_HEIGHT / 2 + 45;
      return this.createModeCard(cx, cy, cardW, cardH, mode, cfg.displayName, cfg.description, () => {
        const session: SessionConfig = { mode, seed: Date.now() };
        this.scene.start(SceneKey.Game, { session });
      }, () => nav?.hoverAt(i));
    });

    nav = new MenuNav(this, cardItems, 'horizontal');

    // Back button
    this.add.text(60, GAME_HEIGHT - 50, '← Back', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '30px',
      color: COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu));

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
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
    const bg = this.add.graphics();
    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.CARD_HOVER : COLORS.CARD, 1);
      bg.lineStyle(3, COLORS.BTN, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    };
    draw(false);

    this.add.text(cx, cy - h / 2 + 54, title, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '30px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);

    this.add.text(cx, cy - h / 2 + 102, desc, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '21px',
      color: COLORS.UI_SUBTITLE,
      wordWrap: { width: w - 24 },
      align: 'center',
    }).setOrigin(0.5, 0);

    this.add.text(cx, cy + 6, this.bestLabel(mode), {
      fontFamily: 'FoxwhelpFont',
      fontSize: '20px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
      align: 'center',
    }).setOrigin(0.5, 1);

    // Mode illustration in the lower half of the card
    this.drawModeIllustration(mode, cx, cy);

    const hit = this.add.rectangle(cx, cy, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { onHover?.(); draw(true); });
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', onClick);

    return {
      setFocus: (f) => draw(f),
      activate: onClick,
    };
  }

  private bestLabel(mode: GameMode): string {
    const best = HighScoreManager.getBest(mode);
    if (!best) return 'No personal best yet';
    switch (mode) {
      case GameMode.FreeSki: return `Personal best: ${best.distance.toLocaleString()} m`;
      case GameMode.Slalom:  return best.timeMs !== undefined ? `Personal best: ${formatRaceTime(best.timeMs)}` : 'No personal best yet';
      case GameMode.Jump:    return `Personal best: ${best.score}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Per-mode illustrations — exact same drawing logic as the in-game entities,
  // scaled to fit the lower half of a 360×390 card.
  // ---------------------------------------------------------------------------

  private drawModeIllustration(mode: GameMode, cx: number, cy: number): void {
    switch (mode) {
      case GameMode.FreeSki: this.drawTree(cx, cy);  break;
      case GameMode.Slalom:  this.drawGate(cx, cy);  break;
      case GameMode.Jump:    this.drawRamp(cx, cy);  break;
    }
  }

  /**
   * Pine tree — matches Tree.ts drawTree() at scale 3.0.
   * Origin placed so the visual mass is centred in the lower card half.
   */
  private drawTree(cx: number, cy: number): void {
    const g  = this.add.graphics();
    const s  = 3.0;
    // Shift origin so the tree sits comfortably in the lower card half.
    const oy = cy + 112;

    // Drop shadow
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(cx + 4 * s, oy + 10 * s, 28 * s, 10 * s);

    // Trunk
    g.fillStyle(COLORS.TREE_TRUNK, 1);
    g.fillRect(cx - 3 * s, oy + 4 * s, 6 * s, 10 * s);

    // Base layer (widest, darkest green)
    g.fillStyle(COLORS.TREE_DARK, 1);
    g.fillTriangle(cx - 15 * s, oy + 8 * s, cx + 15 * s, oy + 8 * s, cx, oy - 6 * s);

    // Mid layer
    g.fillStyle(COLORS.TREE_MID, 1);
    g.fillTriangle(cx - 11 * s, oy + 1 * s, cx + 11 * s, oy + 1 * s, cx, oy - 16 * s);

    // Top layer
    g.fillStyle(COLORS.TREE_TOP, 1);
    g.fillTriangle(cx - 7 * s, oy - 7 * s, cx + 7 * s, oy - 7 * s, cx, oy - 22 * s);

  }

  /**
   * Slalom gate — matches SlalomGate.ts at a scaled-down half-gap so it fits
   * within the 360 px card width.
   */
  private drawGate(cx: number, cy: number): void {
    const g        = this.add.graphics();
    const halfGap  = 82;    // scaled from in-game 165 to fit card
    const halfPole = GATE_POLE_RADIUS;   // 12 px — same as game
    const poleH    = 84;    // close to in-game POLE_H=96, trimmed slightly
    const bannerH  = 21;    // same as in-game BANNER_H
    // Centre vertically in the lower card half
    const oy = cy + 102;

    // Drop shadows under poles
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(cx - halfGap, oy + poleH / 2 + 4, halfPole * 4, 8);
    g.fillEllipse(cx + halfGap, oy + poleH / 2 + 4, halfPole * 4, 8);

    const colorVal = COLORS.GATE_LEFT; // red gate

    // Left pole body
    g.fillStyle(colorVal, 1);
    g.fillRect(cx - halfGap - halfPole, oy - poleH / 2, halfPole * 2, poleH);

    // Right pole body
    g.fillRect(cx + halfGap - halfPole, oy - poleH / 2, halfPole * 2, poleH);

    // White stripe on each pole
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - halfGap - halfPole, oy - poleH / 2 + 4, halfPole * 2, 10);
    g.fillRect(cx + halfGap - halfPole, oy - poleH / 2 + 4, halfPole * 2, 10);

    // Horizontal banner connecting the poles
    g.fillStyle(colorVal, 0.80);
    g.fillRect(cx - halfGap, oy - bannerH / 2, halfGap * 2, bannerH);

    // Banner centre stripe (white) for visibility
    g.fillStyle(0xffffff, 0.50);
    g.fillRect(cx - halfGap + 8, oy - 3, halfGap * 2 - 16, 6);
  }

  /**
   * Jump ramp — matches Ramp.ts at scale 3×.
   */
  private drawRamp(cx: number, cy: number): void {
    const g = this.add.graphics();
    const s = 3;

    const RAMP_W = 70, RAMP_D = 28, CORNER = 7;
    const hw   = (RAMP_W / 2) * s;
    const hd   = (RAMP_D / 2) * s;
    const lipH = 7 * s;

    // Centre vertically in the lower card half
    const oy = cy + 102;

    // Drop shadow
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(cx - hw + 4 * s, oy + hd - 2 * s, RAMP_W * s, 10 * s, 4);

    // Main ramp platform
    g.fillStyle(COLORS.RAMP_SURFACE, 1);
    g.fillRoundedRect(cx - hw, oy - hd, RAMP_W * s, RAMP_D * s, CORNER * s);

    // Upper highlight
    g.fillStyle(COLORS.RAMP_HIGHLIGHT, 0.70);
    g.fillRoundedRect(cx - hw + 4 * s, oy - hd + 2 * s, (RAMP_W - 8) * s, RAMP_D * 0.45 * s, (CORNER - 2) * s);

    // Front launch lip
    g.fillStyle(COLORS.RAMP_LIP, 1);
    g.fillRoundedRect(cx - hw, oy + hd - lipH, RAMP_W * s, lipH, { tl: 0, tr: 0, bl: CORNER * s, br: CORNER * s });

    // Yellow direction arrow (same path as Ramp.ts)
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

    // Platform outline
    g.lineStyle(1.5, COLORS.RAMP_OUTLINE, 0.8);
    g.strokeRoundedRect(cx - hw, oy - hd, RAMP_W * s, RAMP_D * s, CORNER * s);
  }
}
