import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, GATE_POLE_RADIUS, BACK_BTN_Y } from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { HighScoreManager } from '@/data/HighScoreManager';
import { formatRaceTime } from '@/utils/MathUtils';
import { type MenuNavItem } from '@/ui/MenuNav';
import { fetchTopScores } from '@/services/LeaderboardService';

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

    const cardContainers: Phaser.GameObjects.Container[] = [];

    const dimOtherCards = (activeIdx: number): void => {
      cardContainers.forEach((c, j) => c.setAlpha(j === activeIdx ? 1 : 0.75));
      backContainer.setAlpha(0.6);
    };
    const dimAllCards = (): void => {
      cardContainers.forEach(c => c.setAlpha(0.6));
    };
    const cardItems: MenuNavItem[] = MODES.map((mode, i) => {
      const cfg = GAME_MODE_CONFIGS[mode];
      const cx = startX + i * (cardW + spacing);
      const cy = GAME_HEIGHT / 2 + 10;
      return this.createModeCard(cx, cy, cardW, cardH, mode, cfg.displayName, cfg.description, () => {
        const session: SessionConfig = { mode, seed: Date.now() };
        this.scene.stop(SceneKey.MainMenu);
        this.scene.start(SceneKey.Game, { session });
      }, () => {
        backItem.setFocus(false);
        cardItems.forEach((item, j) => { if (j !== i) item.setFocus(false); });
        cardIndex = i; isBack = false; cardFocused = false;
        dimOtherCards(i);
      }, () => {
        cardItems.forEach(item => item.setFocus(false));
        backContainer.setAlpha(1);
      }, cardContainers);
    });

    // Back button — card-styled with pulse + underline (no glow)
    const backGoTo = () => { this.scene.stop(); this.scene.resume(SceneKey.MainMenu); };
    const backW = 350;
    const backH = 90;
    const backX = startX - cardW / 2 + backW / 2;
    const backBtnY = BACK_BTN_Y + 15;
    const backContainer = this.add.container(backX, backBtnY);
    const backBg = this.add.graphics();
    const backLabel = this.add.text(0, 0, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '60px',
      color:      COLORS.UI_TITLE,
    }).setOrigin(0.5);
    backContainer.add([backBg, backLabel]);

    let backPulseTween: Phaser.Tweens.Tween | null = null;
    const startBackPulse = (): void => {
      if (!backPulseTween) backPulseTween = this.tweens.add({ targets: backContainer, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    const stopBackPulse = (): void => {
      if (backPulseTween) { backPulseTween.stop(); backPulseTween = null; backContainer.setScale(1); }
    };

    const drawBackBg = (hovered: boolean): void => {
      backBg.clear();
      backBg.fillStyle(hovered ? COLORS.CARD_HOVER : COLORS.CARD, 1);
      backBg.lineStyle(3, COLORS.BTN, 1);
      backBg.fillRoundedRect(-backW / 2, -backH / 2, backW, backH, 12);
      backBg.strokeRoundedRect(-backW / 2, -backH / 2, backW, backH, 12);
      backLabel.setFontStyle(hovered ? 'bold' : '');
    };
    drawBackBg(false);

    const backHit = this.add.rectangle(backX, backBtnY, backW, backH).setInteractive({ useHandCursor: true });
    backHit.on('pointerover', () => {
      cardItems.forEach(item => item.setFocus(false));
      isBack = true; cardFocused = false;
      drawBackBg(true); startBackPulse();
      dimAllCards();
      backContainer.setAlpha(1);
    });
    backHit.on('pointerout',  () => { drawBackBg(false); stopBackPulse(); cardContainers.forEach(c => c.setAlpha(1)); backContainer.setAlpha(1); });
    const flashAndGoBack = (): void => {
      stopBackPulse();
      backBg.clear();
      backBg.fillStyle(0xffffff, 1);
      backBg.fillRoundedRect(-backW / 2, -backH / 2, backW, backH, 12);
      this.tweens.add({ targets: backContainer, scaleX: 1.07, scaleY: 1.07, duration: 55, ease: 'Quad.easeOut', yoyo: true, onComplete: backGoTo });
    };
    backHit.on('pointerdown', flashAndGoBack);

    const backItem: MenuNavItem = {
      setFocus: (f) => {
        drawBackBg(f);
        if (f) startBackPulse(); else stopBackPulse();
      },
      activate: flashAndGoBack,
    };

    if (this.input.keyboard) {
      const kb = this.input.keyboard;

      const focusBack = (): void => {
        cardItems[cardIndex]!.setFocus(false);
        backItem.setFocus(true);
        isBack = true; cardFocused = false;
        dimAllCards();
        backContainer.setAlpha(1);
      };
      const focusCards = (): void => {
        backItem.setFocus(false);
        cardFocused = true; isBack = false;
        cardItems[cardIndex]!.setFocus(true);
        dimOtherCards(cardIndex);
      };

      kb.on('keydown-LEFT', () => {
        if (isBack) return;
        if (!cardFocused) { cardFocused = true; cardItems[cardIndex]!.setFocus(true); dimOtherCards(cardIndex); return; }
        cardItems[cardIndex]!.setFocus(false);
        cardIndex = (cardIndex - 1 + MODES.length) % MODES.length;
        cardItems[cardIndex]!.setFocus(true);
        dimOtherCards(cardIndex);
      });
      kb.on('keydown-RIGHT', () => {
        if (isBack) return;
        if (!cardFocused) { cardFocused = true; cardItems[cardIndex]!.setFocus(true); dimOtherCards(cardIndex); return; }
        cardItems[cardIndex]!.setFocus(false);
        cardIndex = (cardIndex + 1) % MODES.length;
        cardItems[cardIndex]!.setFocus(true);
        dimOtherCards(cardIndex);
      });
      kb.on('keydown-DOWN', () => {
        if (isBack)         focusCards();
        else if (cardFocused) focusBack();
        else                { cardFocused = true; cardItems[cardIndex]!.setFocus(true); dimOtherCards(cardIndex); }
      });
      kb.on('keydown-UP', () => {
        if (isBack)         focusCards();
        else if (cardFocused) focusBack();
        else                { cardFocused = true; cardItems[cardIndex]!.setFocus(true); dimOtherCards(cardIndex); }
      });
      kb.on('keydown-SPACE', () => { isBack ? backItem.activate() : cardItems[cardIndex]!.activate(); });
      kb.on('keydown-ENTER', () => { isBack ? backItem.activate() : cardItems[cardIndex]!.activate(); });
      kb.on('keydown-ESC',   () => { this.scene.stop(); this.scene.resume(SceneKey.MainMenu); });
    }

    addVersionLabel(this, COLORS.VERSION_GAME);
    addUsernameLabel(this, COLORS.VERSION_GAME);
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
    onLeave?: () => void,
    containerList?: Phaser.GameObjects.Container[],
  ): MenuNavItem {
    const GLOW_LAYERS = [
      { pad: 42, alpha: 0.04 },
      { pad: 28, alpha: 0.08 },
      { pad: 18, alpha: 0.13 },
      { pad: 10, alpha: 0.18 },
      { pad:  4, alpha: 0.24 },
    ] as const;

    const container  = this.add.container(cx, cy);
    containerList?.push(container);
    const glowGfx    = this.add.graphics();
    const bg         = this.add.graphics();
    const titleText  = this.add.text(0, -h / 2 + 85, title, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '100px',
      fontStyle: 'bold',
      color: this.modeColorStr(mode),
    }).setOrigin(0.5);
    const descText   = this.add.text(0, -h / 2 + 160, desc, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '50px',
      color: COLORS.UI_SUBTITLE,
      wordWrap: { width: w - 100 },
      align: 'center',
    }).setOrigin(0.5, 0);
    const illustGfx  = this.drawModeIllustration(mode);
    const statStyle = {
      fontFamily: 'FoxwhelpFont',
      fontSize: '38px',
      fontStyle: 'bold italic',
      color: COLORS.UI_SUBTITLE,
      align: 'center',
      padding: { right: 16 },
    } as const;
    const dailyLabel   = this.dailyLabel(mode);
    const bestLabel    = this.bestLabel(mode);
    const hasDaily     = !dailyLabel.startsWith('no ');
    const hasBest      = !bestLabel.startsWith('no ');
    const DB_COLOR = '#88ee88';
    const PB_COLOR = COLORS.POPUP_GOLD;
    const WR_COLOR = '#ff4444';
    const dailyText    = this.add.text(0, 155, dailyLabel, statStyle).setOrigin(0.5, 1).setAlpha(hasDaily ? 1 : 0.5);
    if (hasDaily) { dailyText.setColor(DB_COLOR); dailyText.setStroke('#000000', 6); }
    const bestText     = this.add.text(0, 205, bestLabel, statStyle).setOrigin(0.5, 1).setAlpha(hasBest ? 1 : 0.5);
    if (hasBest) { bestText.setColor(PB_COLOR); bestText.setStroke('#000000', 6); }
    const wrText       = this.add.text(0, 255, 'world record: ...', statStyle).setOrigin(0.5, 1).setAlpha(0.5);
    const wrHolderText = this.add.text(0, 295, '', statStyle).setOrigin(0.5, 1);
    let hasWR = false;
    container.add([glowGfx, bg, illustGfx, titleText, descText, bestText, dailyText, wrText, wrHolderText]);

    fetchTopScores(mode)
      .then(rows => {
        if (!this.scene.isActive()) return;
        if (rows.length === 0) {
          hasWR = false;
          wrText.setText('no world record yet').setAlpha(0.5);
        } else {
          hasWR = true;
          const top = rows[0]!;
          wrText.setText(`world record: ${this.formatScore(mode, top.score)}`).setColor(WR_COLOR).setStroke('#000000', 6);
          wrHolderText.setText(`by ${top.username}`).setColor(WR_COLOR).setStroke('#000000', 6);
        }
      })
      .catch(() => {
        hasWR = false;
        if (this.scene.isActive()) wrText.setText('world record: unavailable').setAlpha(0.5);
      });

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 18 + pad);
      }
    };
    const statTexts = [dailyText, bestText, wrText, wrHolderText];
    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.CARD_HOVER : COLORS.CARD, 1);
      bg.lineStyle(3, COLORS.BTN, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      titleText.setText(title);
    };
    const setDimmed = (dimmed: boolean): void => {
      for (const t of statTexts) {
        const noRecord = (t === dailyText && !hasDaily) || (t === bestText && !hasBest) || ((t === wrText || t === wrHolderText) && !hasWR);
        t.setAlpha(dimmed ? (noRecord ? 0.25 : 0.5) : (noRecord ? 0.5 : 1));
      }
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
      bg.fillStyle(0xffffff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      titleText.setColor(COLORS.UI_TITLE);
      descText.setColor(COLORS.UI_TITLE);
      this.tweens.add({ targets: container, scaleX: 1.07, scaleY: 1.07, duration: 55, ease: 'Quad.easeOut', yoyo: true, onComplete: onClick });
    };

    // Hit area stays outside the container so it doesn't scale with it
    const hit = this.add.rectangle(cx, cy, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { onHover?.(); drawGlow(true); draw(true); setDimmed(false); startPulse(); });
    hit.on('pointerout',  () => { drawGlow(false); draw(false); stopPulse(); containerList?.forEach(c => c.setAlpha(1)); onLeave?.(); });
    hit.on('pointerdown', flashAndGo);

    return {
      setFocus: (f) => {
        drawGlow(f); draw(f); setDimmed(false);
        if (f) startPulse(); else stopPulse();
        container.setAlpha(1);
      },
      activate: flashAndGo,
    };
  }

  private dailyLabel(mode: GameMode): string {
    const best = HighScoreManager.getDailyBest(mode);
    if (!best) return 'no daily best yet';
    switch (mode) {
      case GameMode.FreeSki: return `daily best: ${best.distance.toLocaleString()} m`;
      case GameMode.Slalom:  return best.timeMs !== undefined ? `daily best: ${formatRaceTime(best.timeMs)}` : 'no daily best yet';
      case GameMode.Jump:    return `daily best: ${best.score}`;
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

  private modeColorStr(mode: GameMode): string {
    if (mode === GameMode.Slalom) return '#e63030';
    if (mode === GameMode.Jump)   return '#3a7a32';
    return COLORS.UI_TITLE;
  }

  private formatScore(mode: GameMode, score: number): string {
    switch (mode) {
      case GameMode.FreeSki: return `${score.toLocaleString()} m`;
      case GameMode.Slalom:  return formatRaceTime(score);
      case GameMode.Jump:    return `${score}`;
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
    const oy = 35;   // shift so visual mass sits in lower card half

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
    const oy       = 30;

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
    const oy   = 25;

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
