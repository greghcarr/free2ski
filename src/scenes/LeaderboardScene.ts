import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, BACK_BTN_Y } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { fetchTopScores, type LeaderboardRow } from '@/services/LeaderboardService';
import { formatRaceTime, formatSeedDate } from '@/utils/MathUtils';

const MODES: GameMode[] = [GameMode.Slalom, GameMode.FreeSki, GameMode.Jump];

// Layout constants
const TAB_W       = 490;
const TAB_H       = 80;
const TAB_GAP     = 30;
const TAB_Y       = 230;
const HEADER_Y    = 345;
const ROW_START_Y = 460;   // well below the divider (HEADER_Y + header text + gap)
const ROW_H       = 58;

// Column x positions
const COL_RANK     = 160;
const COL_USERNAME = 230;
const COL_SCORE    = 1440;
const COL_SEED     = 1740;

export class LeaderboardScene extends Phaser.Scene {
  private activeMode:       GameMode = GameMode.FreeSki;
  private tabIndex:         number   = MODES.indexOf(GameMode.FreeSki);
  private isBack:           boolean  = false;
  private tabGraphics:      Phaser.GameObjects.Graphics[] = [];
  private tabLabels:        Phaser.GameObjects.Text[]     = [];
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private backUnderline!:   Phaser.GameObjects.Graphics;
  private backText!:        Phaser.GameObjects.Text;
  private sessionId:        number   = 0;

  constructor() {
    super({ key: SceneKey.Leaderboard });
  }

  create(): void {
    this.sessionId++;
    this.tabGraphics = [];
    this.tabLabels   = [];
    this.contentContainer = null;
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
        this.isBack = false;
        this.setBackFocus(false);
        this.tabIndex = i;
        this.switchTab(mode);
      });
      hit.on('pointerover', () => {
        this.isBack = false;
        this.setBackFocus(false);
        if (mode !== this.activeMode) this.drawTab(i, 'hover');
      });
      hit.on('pointerout', () => {
        if (mode !== this.activeMode) this.drawTab(i, 'idle');
      });
    });

    // Column headers
    const headerStyle = { fontFamily: 'FoxwhelpFont', fontSize: '40px', color: COLORS.UI_SECONDARY };
    this.add.text(COL_RANK,     HEADER_Y, '#',      headerStyle).setOrigin(1, 0);
    this.add.text(COL_USERNAME, HEADER_Y, 'player', headerStyle).setOrigin(0, 0);
    this.add.text(COL_SCORE,    HEADER_Y, 'score',  headerStyle).setOrigin(1, 0);
    this.add.text(COL_SEED,     HEADER_Y, 'seed',   headerStyle).setOrigin(1, 0);

    // Divider under headers
    const div = this.add.graphics();
    div.lineStyle(2, COLORS.UI_DIVIDER, 0.6);
    div.beginPath();
    div.moveTo(120, HEADER_Y + 44);
    div.lineTo(WORLD_WIDTH - 120, HEADER_Y + 44);
    div.strokePath();

    // Back button
    const backY = BACK_BTN_Y;
    this.backText = this.add.text(60, backY, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '50px',
      color:      COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu))
      .on('pointerover', () => { this.isBack = true; this.setBackFocus(true); })
      .on('pointerout',  () => { this.isBack = false; this.setBackFocus(false); });

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
      kb.on('keydown-LEFT', () => {
        if (this.isBack) return;
        this.tabIndex = (this.tabIndex - 1 + MODES.length) % MODES.length;
        this.switchTab(MODES[this.tabIndex]!);
      });
      kb.on('keydown-RIGHT', () => {
        if (this.isBack) return;
        this.tabIndex = (this.tabIndex + 1) % MODES.length;
        this.switchTab(MODES[this.tabIndex]!);
      });
      kb.on('keydown-DOWN', () => {
        if (!this.isBack) { this.isBack = true; this.setBackFocus(true); }
        else              { this.isBack = false; this.setBackFocus(false); }
      });
      kb.on('keydown-UP', () => {
        if (!this.isBack) { this.isBack = true; this.setBackFocus(true); }
        else              { this.isBack = false; this.setBackFocus(false); }
      });
      kb.on('keydown-SPACE', () => { if (this.isBack) this.scene.start(SceneKey.MainMenu); });
      kb.on('keydown-ENTER', () => { if (this.isBack) this.scene.start(SceneKey.MainMenu); });
      kb.on('keydown-ESC',   () => this.scene.start(SceneKey.MainMenu));
    }

    addVersionLabel(this);
    addUsernameLabel(this);

    // Load initial tab
    this.switchTab(GameMode.FreeSki);
  }

  private setBackFocus(focused: boolean): void {
    this.backUnderline.setVisible(focused);
    MODES.forEach((m, i) => this.drawTab(i, focused ? 'idle' : m === this.activeMode ? 'active' : 'idle'));
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

  private drawTab(index: number, state: 'active' | 'idle' | 'hover'): void {
    const totalW    = MODES.length * TAB_W + (MODES.length - 1) * TAB_GAP;
    const tabStartX = (WORLD_WIDTH - totalW) / 2 + TAB_W / 2;
    const cx = tabStartX + index * (TAB_W + TAB_GAP);
    const g  = this.tabGraphics[index]!;
    const t  = this.tabLabels[index]!;
    const mode = MODES[index]!;

    g.clear();
    if (state === 'active') {
      g.fillStyle(this.modeColor(mode), 1);
      g.fillRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor('#ffffff').setStroke('#000000', 0);
    } else if (state === 'hover') {
      g.fillStyle(COLORS.BTN_HOVER, 0.4);
      g.fillRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      g.lineStyle(2, COLORS.BTN, 1);
      g.strokeRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor(COLORS.UI_SUBTITLE);
    } else {
      g.lineStyle(2, COLORS.BTN, 0.5);
      g.strokeRoundedRect(cx - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H, 10);
      t.setColor(COLORS.UI_SUBTITLE);
    }
  }

  private switchTab(mode: GameMode): void {
    this.activeMode = mode;
    MODES.forEach((m, i) => this.drawTab(i, m === mode ? 'active' : 'idle'));
    this.setContent(null);

    const sid = this.sessionId;
    fetchTopScores(mode).then(rows => {
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
      this.contentContainer.add(
        this.add.text(WORLD_WIDTH / 2, ROW_START_Y + ROW_H * 4, 'no scores yet — be the first!', {
          fontFamily: 'FoxwhelpFont', fontSize: '55px', color: COLORS.UI_MUTED,
        }).setOrigin(0.5),
      );
      return;
    }

    const rowStyle   = { fontFamily: 'FoxwhelpFont', fontSize: '50px', color: this.modeColorStr(mode!) };
    const mutedStyle = { fontFamily: 'FoxwhelpFont', fontSize: '46px', color: COLORS.UI_SECONDARY };

    rows.forEach((row, i) => {
      const y = ROW_START_Y + i * ROW_H;

      if (i % 2 === 0) {
        const tint = this.add.graphics();
        tint.fillStyle(COLORS.SNOW_SHADOW, 0.3);
        tint.fillRect(120, y - ROW_H / 2 + 4, WORLD_WIDTH - 240, ROW_H - 4);
        this.contentContainer!.add(tint);
      }

      const scoreStr = this.formatScore(row.score, mode!);
      const seedStr  = row.seed !== null ? formatSeedDate(row.seed) : '—';

      this.contentContainer!.add([
        this.add.text(COL_RANK,     y, `${row.rank}`,  rowStyle).setOrigin(1, 0.5),
        this.add.text(COL_USERNAME, y, row.username,   rowStyle).setOrigin(0, 0.5),
        this.add.text(COL_SCORE,    y, scoreStr,       rowStyle).setOrigin(1, 0.5),
        this.add.text(COL_SEED,     y, seedStr,      mutedStyle).setOrigin(1, 0.5),
      ]);
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
