import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, BACK_BTN_Y } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { fetchTopScores, type LeaderboardRow } from '@/services/LeaderboardService';
import { formatRaceTime } from '@/utils/MathUtils';
import { HighScoreManager } from '@/data/HighScoreManager';

const MODES: GameMode[] = [GameMode.Slalom, GameMode.FreeSki, GameMode.Jump];

// Layout constants
const TAB_W       = 490;
const TAB_H       = 80;
const TAB_GAP     = 30;
const TAB_Y       = 280;
const HEADER_Y    = 345;
const ROW_START_Y = 430;   // well below the divider (HEADER_Y + header text + gap)
const ROW_H       = 50;

// Column x positions
const COL_RANK     = 160;
const COL_USERNAME = 230;
const COL_SCORE    = 1440;
const COL_SEED     = 1740;

const FOCUS_ZONES = ['checkbox', 'tabs', 'back'] as const;
type FocusZone = typeof FOCUS_ZONES[number] | null;

export class LeaderboardScene extends Phaser.Scene {
  private activeMode:       GameMode = GameMode.FreeSki;
  private tabIndex:         number   = MODES.indexOf(GameMode.FreeSki);
  private focusZone:        FocusZone = null;
  private tabGraphics:      Phaser.GameObjects.Graphics[] = [];
  private tabGlowGraphics:  Phaser.GameObjects.Graphics[] = [];
  private tabLabels:        Phaser.GameObjects.Text[]     = [];
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private backUnderline!:   Phaser.GameObjects.Graphics;
  private backText!:        Phaser.GameObjects.Text;
  private sessionId:        number   = 0;
  private dailyOnly:        boolean  = false;
  private drawCheckbox!:    (focused: boolean) => void;
  private toggleDaily!:     () => void;
  private dividerGfx!:      Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: SceneKey.Leaderboard });
  }

  create(): void {
    this.sessionId++;
    this.tabGraphics     = [];
    this.tabGlowGraphics = [];
    this.tabLabels       = [];
    this.contentContainer = null;
    this.tabIndex  = MODES.indexOf(GameMode.FreeSki);
    this.focusZone = null;
    this.dailyOnly = false;
    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Title
    this.add.text(WORLD_WIDTH / 2, 100, 'leaderboard', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '130px',
      fontStyle:  'bold',
      color:      COLORS.UI_TITLE,
    }).setOrigin(0.5);

    // Mode tabs
    const totalW    = MODES.length * TAB_W + (MODES.length - 1) * TAB_GAP;
    const tabStartX = (WORLD_WIDTH - totalW) / 2 + TAB_W / 2;

    MODES.forEach((mode, i) => {
      const cx = tabStartX + i * (TAB_W + TAB_GAP);
      const glow = this.add.graphics();
      this.tabGlowGraphics.push(glow);
      const g  = this.add.graphics();
      const t  = this.add.text(cx, TAB_Y, GAME_MODE_CONFIGS[mode].displayName, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   '52px',
        fontStyle:  'bold',
        color:      '#ffffff',
      }).setOrigin(0.5);

      this.tabGraphics.push(g);
      this.tabLabels.push(t);

      const hit = this.add.rectangle(cx, TAB_Y, TAB_W, TAB_H).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.setFocusZone('tabs');
        if (mode === this.activeMode) return;
        this.tabIndex = i;
        this.switchTab(mode);
      });
      hit.on('pointerover', () => {
        this.setFocusZone('tabs');
        if (mode !== this.activeMode) this.drawTab(i, 'hover');
      });
      hit.on('pointerout', () => {
        if (mode !== this.activeMode) this.drawTab(i, 'idle');
      });
    });

    // Daily filter checkbox — centred below the FreeSki (middle) tab
    const checkboxY = 195;
    const boxSize   = 40;
    const checkGfx  = this.add.graphics();
    const checkLabel = this.add.text(WORLD_WIDTH / 2 + boxSize / 2 + 14, checkboxY, 'daily', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '44px',
      color:      COLORS.UI_SUBTITLE,
    }).setOrigin(0, 0.5);
    const checkboxX = WORLD_WIDTH / 2 - checkLabel.displayWidth / 2 - boxSize / 2;
    checkLabel.setX(checkboxX + boxSize + 14);

    this.drawCheckbox = (focused: boolean): void => {
      const alpha = (focused || this.dailyOnly) ? 1 : 0.5;
      checkGfx.clear();
      checkGfx.lineStyle(focused ? 3 : 2, COLORS.BTN, alpha);
      checkGfx.strokeRect(checkboxX, checkboxY - boxSize / 2, boxSize, boxSize);
      if (this.dailyOnly) {
        checkGfx.fillStyle(COLORS.BTN, alpha);
        checkGfx.fillRect(checkboxX + 6, checkboxY - boxSize / 2 + 6, boxSize - 12, boxSize - 12);
      }
      checkLabel.setColor(COLORS.UI_TITLE).setAlpha(alpha);
      if (focused) {
        const ulY = checkLabel.y + checkLabel.displayHeight / 2 - 6;
        checkGfx.fillStyle(COLORS.BTN, 1);
        checkGfx.fillRect(checkLabel.x, ulY, checkLabel.displayWidth, 3);
      }
    };
    this.drawCheckbox(false);

    this.toggleDaily = (): void => {
      this.dailyOnly = !this.dailyOnly;
      this.drawCheckbox(this.focusZone === 'checkbox');
      this.switchTab(this.activeMode);
    };

    const checkHit = this.add.rectangle(
      checkboxX + boxSize / 2 + (checkLabel.displayWidth + 14) / 2,
      checkboxY,
      boxSize + checkLabel.displayWidth + 28,
      boxSize + 16,
    ).setInteractive({ useHandCursor: true });
    checkHit.on('pointerdown', () => {
      this.setFocusZone('checkbox');
      this.toggleDaily();
    });
    checkHit.on('pointerover', () => this.setFocusZone('checkbox'));
    checkHit.on('pointerout',  () => { if (this.focusZone === 'checkbox') this.setFocusZone(null); });

    // Column headers
    const headerStyle = { fontFamily: 'FoxwhelpFont', fontSize: '40px', color: COLORS.UI_SECONDARY };
    this.add.text(COL_RANK,     HEADER_Y, '#',      headerStyle).setOrigin(1, 0).setAlpha(0.5);
    this.add.text(COL_USERNAME, HEADER_Y, 'player', headerStyle).setOrigin(0, 0).setAlpha(0.5);
    this.add.text(COL_SCORE,    HEADER_Y, 'score',  headerStyle).setOrigin(1, 0).setAlpha(0.5);
    this.add.text(COL_SEED,     HEADER_Y, 'date',   headerStyle).setOrigin(1, 0).setAlpha(0.5);

    // Divider under headers
    this.dividerGfx = this.add.graphics();
    this.dividerGfx.lineStyle(2, COLORS.UI_DIVIDER, 0.6);
    this.dividerGfx.beginPath();
    this.dividerGfx.moveTo(120, HEADER_Y + 44);
    this.dividerGfx.lineTo(WORLD_WIDTH - 120, HEADER_Y + 44);
    this.dividerGfx.strokePath();

    // Back button
    const backY = BACK_BTN_Y;
    this.backText = this.add.text(60, backY, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '50px',
      color:      COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu))
      .on('pointerover', () => this.setFocusZone('back'))
      .on('pointerout',  () => { if (this.focusZone === 'back') this.setFocusZone(null); });

    // Back underline (keyboard focus indicator, mirrors ModeSelectScene)
    const ulY = backY + this.backText.displayHeight - 6;
    const prefixMeasure = this.add.text(0, 0, '← ', { fontFamily: 'FoxwhelpFont', fontSize: '50px' }).setVisible(false);
    const backWordX = 60 + prefixMeasure.displayWidth;
    const backWordW = this.backText.displayWidth - prefixMeasure.displayWidth;
    prefixMeasure.destroy();
    this.backUnderline = this.add.graphics();
    this.backUnderline.fillStyle(parseInt(COLORS.UI_TITLE.slice(1), 16), 1);
    this.backUnderline.fillRect(backWordX, ulY, backWordW, 4);
    this.backUnderline.setVisible(false);

    // Keyboard navigation
    if (this.input.keyboard) {
      const kb = this.input.keyboard;
      kb.on('keydown-LEFT',  () => {
        if (this.focusZone === null) { this.setFocusZone('tabs'); return; }
        if (this.focusZone !== 'tabs') return;
        this.tabIndex = (this.tabIndex - 1 + MODES.length) % MODES.length;
        this.switchTab(MODES[this.tabIndex]!);
      });
      kb.on('keydown-RIGHT', () => {
        if (this.focusZone === null) { this.setFocusZone('tabs'); return; }
        if (this.focusZone !== 'tabs') return;
        this.tabIndex = (this.tabIndex + 1) % MODES.length;
        this.switchTab(MODES[this.tabIndex]!);
      });
      kb.on('keydown-DOWN',  () => {
        if (this.focusZone === null) { this.setFocusZone('tabs'); return; }
        const idx = FOCUS_ZONES.indexOf(this.focusZone);
        this.setFocusZone(FOCUS_ZONES[(idx + 1) % FOCUS_ZONES.length]!);
      });
      kb.on('keydown-UP',    () => {
        if (this.focusZone === null) { this.setFocusZone('tabs'); return; }
        const idx = FOCUS_ZONES.indexOf(this.focusZone);
        this.setFocusZone(FOCUS_ZONES[(idx - 1 + FOCUS_ZONES.length) % FOCUS_ZONES.length]!);
      });
      kb.on('keydown-ENTER', () => { if (this.focusZone) this.activateFocused(); });
      kb.on('keydown-SPACE', () => { if (this.focusZone) this.activateFocused(); });
      kb.on('keydown-ESC',   () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this, COLORS.VERSION_MENU);
    addUsernameLabel(this, COLORS.VERSION_MENU);

    // Load initial tab
    this.switchTab(GameMode.FreeSki);
  }

  private setFocusZone(zone: FocusZone): void {
    this.focusZone = zone;
    // Update tab visuals — active tab uses unfocused style when focus is elsewhere
    const activeState = zone === 'tabs' ? 'active' : 'active-unfocused';
    MODES.forEach((m, i) => this.drawTab(i, m === this.activeMode ? activeState : 'idle'));
    // Update checkbox visual
    this.drawCheckbox(zone === 'checkbox');
    // Update back underline
    this.backUnderline.setVisible(zone === 'back');
  }

  private activateFocused(): void {
    switch (this.focusZone) {
      case 'tabs':     break; // tabs are already activated on LEFT/RIGHT
      case 'checkbox': this.toggleDaily(); break;
      case 'back':     this.scene.start(SceneKey.MainMenu); break;
    }
  }

  private modeColor(mode: GameMode): number {
    if (mode === GameMode.Slalom) return COLORS.GATE_LEFT;
    if (mode === GameMode.Jump)   return COLORS.TREE_MID;
    return COLORS.BTN;
  }

  private modeColorStr(mode: GameMode): string {
    if (mode === GameMode.Slalom) return '#e63030';
    if (mode === GameMode.Jump)   return '#3a7a32';
    return COLORS.UI_TITLE;
  }

  private drawTab(index: number, state: 'active' | 'active-unfocused' | 'idle' | 'hover'): void {
    const totalW    = MODES.length * TAB_W + (MODES.length - 1) * TAB_GAP;
    const tabStartX = (WORLD_WIDTH - totalW) / 2 + TAB_W / 2;
    const cx = tabStartX + index * (TAB_W + TAB_GAP);
    const g  = this.tabGraphics[index]!;
    const gw = this.tabGlowGraphics[index]!;
    const t  = this.tabLabels[index]!;
    const mode = MODES[index]!;

    g.clear();
    gw.clear();

    const showGlow = state === 'active' || state === 'hover';
    if (showGlow) {
      const GLOW_LAYERS = [
        { pad: 42, alpha: 0.04 },
        { pad: 28, alpha: 0.08 },
        { pad: 18, alpha: 0.13 },
        { pad: 10, alpha: 0.18 },
        { pad:  4, alpha: 0.24 },
      ] as const;
      for (const { pad, alpha } of GLOW_LAYERS) {
        gw.fillStyle(0xaaddff, alpha);
        gw.fillRoundedRect(cx - TAB_W / 2 - pad, TAB_Y - TAB_H / 2 - pad, TAB_W + pad * 2, TAB_H + pad * 2, 10 + pad);
      }
    }

    if (state === 'active') {
      g.fillStyle(this.modeColor(mode), 1);
      g.fillRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor('#ffffff').setStroke('#000000', 0).setAlpha(1);
    } else if (state === 'active-unfocused') {
      const mc = this.modeColor(mode);
      g.lineStyle(3, mc, 1);
      g.strokeRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor(this.modeColorStr(mode)).setStroke('#000000', 0).setAlpha(1);
    } else if (state === 'hover') {
      const mc = this.modeColor(mode);
      g.fillStyle(mc, 0.25);
      g.fillRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      g.lineStyle(2, mc, 1);
      g.strokeRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor(this.modeColorStr(mode)).setAlpha(1);
    } else {
      g.lineStyle(2, this.modeColor(mode), 0.5);
      g.strokeRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor(this.modeColorStr(mode)).setAlpha(0.5);
    }
  }

  private switchTab(mode: GameMode): void {
    this.activeMode = mode;
    const activeState = this.focusZone === 'tabs' ? 'active' : 'active-unfocused';
    MODES.forEach((m, i) => this.drawTab(i, m === mode ? activeState : 'idle'));
    this.drawCheckbox(this.focusZone === 'checkbox');
    // Recolor divider to match mode
    this.dividerGfx.clear();
    this.dividerGfx.lineStyle(2, this.modeColor(mode), 0.6);
    this.dividerGfx.beginPath();
    this.dividerGfx.moveTo(120, HEADER_Y + 44);
    this.dividerGfx.lineTo(WORLD_WIDTH - 120, HEADER_Y + 44);
    this.dividerGfx.strokePath();
    this.setContent(null);

    const sid = this.sessionId;
    fetchTopScores(mode, this.dailyOnly).then(rows => {
      if (this.sessionId !== sid || this.activeMode !== mode) return;
      this.setContent(rows, mode);
    }).catch(() => {
      if (this.sessionId !== sid || this.activeMode !== mode) return;
      this.setContent('error');
    });
  }

  private setContent(rows: LeaderboardRow[] | null | 'error', mode?: GameMode): void {
    this.contentContainer?.destroy();
    this.contentContainer = this.add.container(0, 0);

    if (rows === null) {
      this.contentContainer.add(
        this.add.text(WORLD_WIDTH / 2, ROW_START_Y + ROW_H * 4, 'loading…', {
          fontFamily: 'FoxwhelpFont', fontSize: '60px', color: COLORS.UI_MUTED,
        }).setOrigin(0.5),
      );
      return;
    }

    if (rows === 'error') {
      this.contentContainer.add(
        this.add.text(WORLD_WIDTH / 2, ROW_START_Y + ROW_H * 4, 'could not load scores', {
          fontFamily: 'FoxwhelpFont', fontSize: '55px', color: COLORS.UI_MUTED,
        }).setOrigin(0.5),
      );
      return;
    }

    if (rows.length === 0) {
      const emptyMsg = this.dailyOnly ? 'no runs today — be the first!' : 'no scores yet — be the first!';
      this.contentContainer.add(
        this.add.text(WORLD_WIDTH / 2, ROW_START_Y + ROW_H * 4, emptyMsg, {
          fontFamily: 'FoxwhelpFont', fontSize: '55px', color: COLORS.UI_MUTED,
        }).setOrigin(0.5),
      );
      return;
    }

    const rowStyle   = { fontFamily: 'FoxwhelpFont', fontSize: '44px', color: this.modeColorStr(mode!) };
    const mutedStyle = { fontFamily: 'FoxwhelpFont', fontSize: '40px', color: this.modeColorStr(mode!) };
    const myUsername = HighScoreManager.getDisplayName() ?? '';

    rows.forEach((row, i) => {
      const y = ROW_START_Y + i * ROW_H;

      if (i % 2 === 0) {
        const tint = this.add.graphics();
        tint.fillStyle(COLORS.SNOW_SHADOW, 0.3);
        tint.fillRect(120, y - ROW_H / 2 + 4, WORLD_WIDTH - 240, ROW_H - 4);
        this.contentContainer!.add(tint);
      }

      const scoreStr = this.formatScore(row.score, mode!);
      const played     = new Date(row.playedAt);
      const now        = new Date();
      const todayUTC   = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const playedUTC  = Date.UTC(played.getUTCFullYear(), played.getUTCMonth(), played.getUTCDate());
      const daysAgo    = Math.floor((todayUTC - playedUTC) / 86_400_000);
      const seedStr    = daysAgo === 0 ? 'today'
                       : daysAgo === 1 ? 'yesterday'
                       : daysAgo === 2 ? '2 days ago'
                       : daysAgo === 3 ? '3 days ago'
                       : played.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const usernameText = this.add.text(COL_USERNAME, y, row.username, rowStyle).setOrigin(0, 0.5);
      const items: Phaser.GameObjects.GameObject[] = [
        this.add.text(COL_RANK, y, `${row.rank}`, rowStyle).setOrigin(1, 0.5),
        usernameText,
        this.add.text(COL_SCORE, y, scoreStr,  rowStyle).setOrigin(1, 0.5),
        this.add.text(COL_SEED,  y, seedStr, mutedStyle).setOrigin(1, 0.5),
      ];

      if (row.username === myUsername) {
        items.push(
          this.add.text(COL_USERNAME + usernameText.displayWidth + 20, y, '← this is you', {
            fontFamily:    'FoxwhelpFont',
            fontSize:      '44px',
            letterSpacing: 1,
            color:         '#000000',
          }).setOrigin(0, 0.5),
        );
      }

      this.contentContainer!.add(items);
    });
  }

  private formatScore(score: number, mode: GameMode): string {
    switch (mode) {
      case GameMode.FreeSki: return `${score.toLocaleString()} m`;
      case GameMode.Slalom:  return formatRaceTime(score);
      case GameMode.Jump:    return `${score}`;
    }
  }
}
