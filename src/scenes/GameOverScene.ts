import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, PX_PER_METER, JUMP_COURSE_DISTANCE_M, COLORS } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { HighScoreManager, type SubmitResult } from '@/data/HighScoreManager';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';
import { formatRaceTime } from '@/utils/MathUtils';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';
import { pushScores } from '@/services/LeaderboardService';

const LAYOUT = {
  // Mode label (top of screen)
  MODE_Y:              70,
  MODE_FONT:           '60px',
  MODE_LETTER_SPACING: 4,

  // Headline ("WIPEOUT", "COURSE COMPLETE", "THE YETI GOT YOU!")
  HEADLINE_Y:             190,
  HEADLINE_FONT:          '140px',
  HEADLINE_FONT_WIPEOUT:  '200px',
  HEADLINE_STROKE_W:      3,

  // Primary metric (distance / finish time / score)
  PRIMARY_Y:         342,  // distance + score modes
  PRIMARY_Y_TIME:    342,  // slalom finish time
  PRIMARY_FONT:      '160px',
  PRIMARY_FONT_TIME: '160px',

  // Secondary sublabel (gates passed, yeti count, distance/score)
  SUB_Y:          460,  // distance + score modes
  SUB_Y_TIME:     460,  // time / slalom-crash modes
  SUB_FONT:       '70px',
  SUB_FONT_SMALL: '70px',

  // Horizontal divider
  DIVIDER_Y:      475,
  DIVIDER_HALF_W: 240,

  // Existing personal best row
  BEST_Y:    526,
  BEST_FONT: '50px',

  // New personal best badge
  NEW_BEST_Y:          342,
  NEW_BEST_FONT:       '50px',
  NEW_BEST_PULSE_SCALE: 1.06,
  NEW_BEST_PULSE_MS:    700,

  // Sub-detail row (prev→current improvement, or run delta)
  DETAIL_Y_BADGE: 597,  // below new-best badge
  DETAIL_Y_DELTA: 597,  // below existing-best row
  DETAIL_FONT:    '40px',

  // Run counter (pinned to bottom)
  RUN_COUNTER_BOTTOM: 70,  // offset from GAME_HEIGHT
  RUN_COUNTER_FONT:   '50px',

  // Buttons
  BTN_PLAY_AGAIN_Y: 630,
  BTN_MAIN_MENU_Y:  860,
  BTN_W:            695,
  BTN_H:            180,
  BTN_RADIUS:       15,
  BTN_FONT:         '80px',
} as const;

export interface GameOverData {
  session:             SessionConfig;
  distancePx:          number;
  score:               number;
  caughtByYeti:        boolean;
  courseComplete?:     boolean;
  finishTimeMs?:       number;
  penaltyMs?:          number;
  gatesPassed?:        number;
  gatesMissed?:        number;
  // Slalom crash (no finish time)
  elapsedTimeMs?:      number;
  totalGatesInCourse?: number;
  yetisEvaded?:        number;
}

interface RunSummary {
  distanceM:           number;
  score:               number;
  session:             SessionConfig;
  caughtByYeti:        boolean;
  courseComplete?:     boolean;
  finishTimeMs?:       number;
  penaltyMs?:          number;
  gatesPassed?:        number;
  gatesMissed?:        number;
  elapsedTimeMs?:      number;
  totalGatesInCourse?: number;
  yetisEvaded?:        number;
}

export class GameOverScene extends Phaser.Scene {
  private summary!: RunSummary;

  constructor() {
    super({ key: SceneKey.GameOver });
  }

  init(data: Partial<GameOverData>): void {
    // Store data for use in create() — don't call this.add here
    this.summary = {
      distanceM:      Math.floor((data.distancePx ?? 0) / PX_PER_METER),
      score:          data.score ?? 0,
      session:        data.session ?? { mode: GameMode.FreeSki },
      caughtByYeti:   data.caughtByYeti ?? false,
      courseComplete: data.courseComplete ?? false,
      ...(data.finishTimeMs !== undefined && {
        finishTimeMs: data.finishTimeMs,
        penaltyMs:    data.penaltyMs ?? 0,
        gatesPassed:  data.gatesPassed ?? 0,
        gatesMissed:  data.gatesMissed ?? 0,
      }),
      ...(data.elapsedTimeMs !== undefined && {
        elapsedTimeMs:      data.elapsedTimeMs,
        gatesPassed:        data.gatesPassed ?? 0,
        totalGatesInCourse: data.totalGatesInCourse ?? 0,
      }),
      ...(data.yetisEvaded !== undefined && { yetisEvaded: data.yetisEvaded }),
    };
  }

  create(): void {
    // Submit run first so the result informs the whole UI
    const result = HighScoreManager.submitRun(
      this.summary.session.mode,
      this.summary.distanceM,
      this.summary.score,
      this.summary.finishTimeMs,
    );

    pushScores().catch(() => { /* network unavailable */ });

    this.buildBackground();
    this.buildHeadline();
    this.buildStats(result);
    this.buildButtons();
    addVersionLabel(this, COLORS.VERSION_GAMEOVER);
    addUsernameLabel(this, COLORS.VERSION_GAMEOVER);
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  private buildBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.GAME_OVER_BG_TOP, COLORS.GAME_OVER_BG_TOP, COLORS.GAME_OVER_BG_BOT, COLORS.GAME_OVER_BG_BOT, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
  }

  private buildHeadline(): void {
    const { caughtByYeti, courseComplete, session, finishTimeMs } = this.summary;

    this.add.text(WORLD_WIDTH / 2, LAYOUT.MODE_Y, session.mode.replace(/_/g, ' '), {
      fontFamily: 'FoxwhelpFont',
      fontStyle: '',
      fontSize: LAYOUT.MODE_FONT,
      color: COLORS.UI_COUNT,
      letterSpacing: LAYOUT.MODE_LETTER_SPACING,
    }).setOrigin(0.5);

    let headline: string;
    let color: string;
    let fontSize: string;
    if (courseComplete || finishTimeMs !== undefined) {
      headline = 'COURSE COMPLETE!'; color = COLORS.POPUP_GOLD; fontSize = LAYOUT.HEADLINE_FONT;
    } else if (caughtByYeti) {
      headline = 'THE YETI GOT YOU!'; color = COLORS.DANGER; fontSize = LAYOUT.HEADLINE_FONT;
    } else {
      headline = 'WIPEOUT'; color = COLORS.DANGER; fontSize = LAYOUT.HEADLINE_FONT_WIPEOUT;
    }

    this.add.text(WORLD_WIDTH / 2, LAYOUT.HEADLINE_Y, headline, {
      fontFamily: 'FoxwhelpFont',
      fontSize,
      fontStyle:  'bold',
      color,
      stroke:     '#000000',
      strokeThickness: LAYOUT.HEADLINE_STROKE_W,
    }).setOrigin(0.5);
  }

  private buildStats(result: SubmitResult): void {
    if (this.summary.finishTimeMs !== undefined) {
      this.buildTimerStats(result);
    } else if (this.summary.session.mode === GameMode.Slalom) {
      this.buildSlalomCrashStats();
    } else if (this.summary.session.mode === GameMode.Jump) {
      this.buildJumpStats(result);
    } else {
      this.buildDistanceStats(result);
    }

    const total = HighScoreManager.getTotalRuns();
    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT - LAYOUT.RUN_COUNTER_BOTTOM, `run #${total}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.RUN_COUNTER_FONT,
      color: COLORS.UI_COUNT,

    }).setOrigin(0.5);
  }

  // --- Slalom crash (mid-course wipeout) layout ---

  private buildSlalomCrashStats(): void {
    const elapsed = this.summary.elapsedTimeMs ?? 0;
    const passed  = this.summary.gatesPassed   ?? 0;
    const total   = this.summary.totalGatesInCourse ?? 0;

    this.add.text(WORLD_WIDTH / 2, LAYOUT.PRIMARY_Y, formatRaceTime(elapsed), {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.PRIMARY_FONT_TIME,
      fontStyle:  'bold',
      color:      '#ffffff',
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, LAYOUT.SUB_Y_TIME, `${passed} / ${total} gates passed`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.SUB_FONT_SMALL,
      color:      COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    // const div = this.add.graphics();
    // div.lineStyle(1, 0xffffff, 1);
    // div.beginPath();
    // div.moveTo(WORLD_WIDTH / 2 - LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.lineTo(WORLD_WIDTH / 2 + LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.strokePath();

    // const bestMs = HighScoreManager.getBest(GameMode.Slalom)?.timeMs ?? null;
    // if (bestMs !== null) {
    //   this.add.text(WORLD_WIDTH / 2, LAYOUT.BEST_Y, `personal best ${formatRaceTime(bestMs)}`, {
    //     fontFamily: 'FoxwhelpFont',
    //     fontSize:   LAYOUT.BEST_FONT,
    //     color:      COLORS.UI_TITLE,
    //   }).setOrigin(0.5);

    // } else {
    //   this.add.text(WORLD_WIDTH / 2, LAYOUT.BEST_Y, 'no completed runs on record', {
    //     fontFamily: 'FoxwhelpFont',
    //     fontSize:   LAYOUT.SUB_FONT_SMALL,
    //     color:      COLORS.UI_SECONDARY,
    //   }).setOrigin(0.5);
    // }
  }

  // --- Time-trial (Slalom) layout ---

  private buildTimerStats(result: SubmitResult): void {
    const { finishTimeMs, penaltyMs, gatesPassed, gatesMissed } = this.summary;
    const { isNewBest, prevBest } = result;
    const missed  = gatesMissed ?? 0;
    const penalty = penaltyMs  ?? 0;

    this.add.text(WORLD_WIDTH / 2, LAYOUT.PRIMARY_Y_TIME, formatRaceTime(finishTimeMs!), {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.PRIMARY_FONT_TIME,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const subtitle = missed > 0
      ? `${missed} gate${missed > 1 ? 's' : ''} missed  ·  +${penalty / 1000}s penalty applied`
      : `${(gatesPassed ?? 0)} / ${(gatesPassed ?? 0) + missed} gates  ·  no penalties`;
    this.add.text(WORLD_WIDTH / 2, LAYOUT.SUB_Y_TIME, subtitle, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.SUB_FONT_SMALL,
      color: missed > 0 ? COLORS.SCORE_WORSE : COLORS.SCORE_BETTER,
    }).setOrigin(0.5);

    // const div = this.add.graphics();
    // div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    // div.beginPath();
    // div.moveTo(WORLD_WIDTH / 2 - LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.lineTo(WORLD_WIDTH / 2 + LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.strokePath();

    // if (isNewBest) {
    //   this.buildNewBestTimeBadge(finishTimeMs!, prevBest?.timeMs ?? null);
    // } else {
    //   this.buildExistingBestTimeRow(finishTimeMs!, prevBest?.timeMs ?? null);
    // }
  }

  private buildNewBestTimeBadge(timeMs: number, prevMs: number | null): void {
    const badge = this.add.text(WORLD_WIDTH * 0.78, LAYOUT.NEW_BEST_Y, '★  new personal best !!  ★', {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.NEW_BEST_FONT,
      fontStyle: 'bold',
      color: COLORS.POPUP_GOLD,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: badge,
      scaleX: LAYOUT.NEW_BEST_PULSE_SCALE,
      scaleY: LAYOUT.NEW_BEST_PULSE_SCALE,
      duration: LAYOUT.NEW_BEST_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const sub = prevMs !== null
      ? `${formatRaceTime(prevMs)}  →  ${formatRaceTime(timeMs)}`
      : 'first run on record!';
    this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_BADGE, sub, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.DETAIL_FONT,
      color: COLORS.UI_DETAIL,
    }).setOrigin(0.5);
  }

  private buildExistingBestTimeRow(timeMs: number, bestMs: number | null): void {
    const best = bestMs ?? timeMs;
    this.add.text(WORLD_WIDTH / 2, LAYOUT.BEST_Y, `personal best ${formatRaceTime(best)}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.BEST_FONT,
      color: COLORS.HUD_UTILITY,
    }).setOrigin(0.5).setAlpha(0.7);

    if (bestMs !== null) {
      const deltaMs = timeMs - bestMs;
      const label   = deltaMs === 0 ? '(same as this run)'
                    : `this run ${deltaMs > 0 ? '+' : '-'}${formatRaceTime(Math.abs(deltaMs))}`;
      const color   = deltaMs === 0 ? COLORS.UI_SECONDARY : deltaMs < 0 ? COLORS.SCORE_BETTER : COLORS.SCORE_WORSE;
      this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_DELTA, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize: LAYOUT.DETAIL_FONT,
        color,
      }).setOrigin(0.5);
    }
  }

  // --- Distance-based (all other modes) layout ---

  private buildDistanceStats(result: SubmitResult): void {
    const { distanceM, score, session, yetisEvaded } = this.summary;
    const { isNewBest, prevBest } = result;

    this.add.text(WORLD_WIDTH / 2, LAYOUT.PRIMARY_Y, `${distanceM.toLocaleString()} m`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.PRIMARY_FONT,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const subLabel = session.mode === GameMode.FreeSki
      ? `yetis evaded: ${yetisEvaded ?? 0}`
      : `score: ${score.toLocaleString()}`;
    this.add.text(WORLD_WIDTH / 2, LAYOUT.SUB_Y, subLabel, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.SUB_FONT,
      color: COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    // const div = this.add.graphics();
    // div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    // div.beginPath();
    // div.moveTo(WORLD_WIDTH / 2 - LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.lineTo(WORLD_WIDTH / 2 + LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.strokePath();

    if (isNewBest) {
      this.buildNewBestDistanceBadge(distanceM, prevBest?.distance ?? null);
    } 
    // else {
    //   this.buildExistingBestDistanceRow(distanceM, prevBest?.distance ?? null);
    // }
  }

  private buildNewBestDistanceBadge(distanceM: number, prevM: number | null): void {
    const badge = this.add.text(WORLD_WIDTH * 0.78, LAYOUT.NEW_BEST_Y, '★  new personal best !!  ★', {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.NEW_BEST_FONT,
      fontStyle: 'bold',
      color: COLORS.POPUP_GOLD,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: badge,
      scaleX: LAYOUT.NEW_BEST_PULSE_SCALE,
      scaleY: LAYOUT.NEW_BEST_PULSE_SCALE,
      duration: LAYOUT.NEW_BEST_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const sub = prevM !== null
      ? `+${(distanceM - prevM).toLocaleString()} m over previous (${prevM.toLocaleString()} m)`
      : 'first run on record!';
    this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_BADGE, sub, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.DETAIL_FONT,
      color: COLORS.UI_DETAIL,
    }).setOrigin(0.5);
  }

  private buildExistingBestDistanceRow(distanceM: number, bestM: number | null): void {
    const best = bestM ?? distanceM;
    this.add.text(WORLD_WIDTH / 2, LAYOUT.BEST_Y, `personal best: ${best.toLocaleString()} m`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.BEST_FONT,
      color: COLORS.UI_TITLE,
    }).setOrigin(0.5);

    if (bestM !== null) {
      const delta = distanceM - bestM;
      const label = delta === 0 ? '(same as this run)'
                  : `this run ${delta > 0 ? '+' : '-'}${Math.abs(delta).toLocaleString()} m`;
      const color = delta === 0 ? COLORS.UI_SECONDARY : delta > 0 ? COLORS.SCORE_BETTER : COLORS.SCORE_WORSE;
      this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_DELTA, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize: LAYOUT.DETAIL_FONT,
        color,
      }).setOrigin(0.5);
    }
  }

  // --- Jump mode layout ---

  private buildJumpStats(result: SubmitResult): void {
    const { score, distanceM, courseComplete } = this.summary;
    const { isNewBest, prevBest } = result;

    this.add.text(WORLD_WIDTH / 2, LAYOUT.PRIMARY_Y, `score: ${score}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.PRIMARY_FONT,
      fontStyle:  'bold',
      color:      '#ffffff',
    }).setOrigin(0.5);

    if (!courseComplete) {
      const courseM = JUMP_COURSE_DISTANCE_M;
      this.add.text(WORLD_WIDTH / 2, LAYOUT.SUB_Y, `${distanceM.toLocaleString()} / ${courseM.toLocaleString()} m`, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   LAYOUT.SUB_FONT,
        color:      COLORS.UI_SECONDARY,
      }).setOrigin(0.5);
    }

    // const div = this.add.graphics();
    // div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    // div.beginPath();
    // div.moveTo(WORLD_WIDTH / 2 - LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.lineTo(WORLD_WIDTH / 2 + LAYOUT.DIVIDER_HALF_W, LAYOUT.DIVIDER_Y);
    // div.strokePath();

    if (isNewBest) {
      this.buildNewBestJumpBadge(score, prevBest?.score ?? null);
    } 
    // else {
    //   this.buildExistingBestJumpRow(score, prevBest?.score ?? null);
    // }
  }

  private buildNewBestJumpBadge(score: number, prevScore: number | null): void {
    const badge = this.add.text(WORLD_WIDTH * 0.78, LAYOUT.NEW_BEST_Y, '★  new personal best !!  ★', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.NEW_BEST_FONT,
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    this.tweens.add({
      targets:  badge,
      scaleX:   LAYOUT.NEW_BEST_PULSE_SCALE,
      scaleY:   LAYOUT.NEW_BEST_PULSE_SCALE,
      duration: LAYOUT.NEW_BEST_PULSE_MS,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    const sub = prevScore !== null
      ? `+${score - prevScore} over previous  (best: ${prevScore})`
      : 'First run on record!';
    this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_BADGE, sub, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.DETAIL_FONT,
      color:      COLORS.UI_DETAIL,
    }).setOrigin(0.5);
  }

  private buildExistingBestJumpRow(score: number, bestScore: number | null): void {
    const best = bestScore ?? score;
    this.add.text(WORLD_WIDTH / 2, LAYOUT.BEST_Y, `personal best: ${best}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.BEST_FONT,
      color:      COLORS.UI_TITLE,
    }).setOrigin(0.5);

    if (bestScore !== null) {
      const delta = score - bestScore;
      const label = delta === 0 ? 'Same as this run'
                  : `${delta > 0 ? '+' : ''}${delta} this run`;
      const color = delta === 0 ? COLORS.HUD_VALUE : delta > 0 ? COLORS.SCORE_BETTER : COLORS.SCORE_WORSE;
      this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_DELTA, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   LAYOUT.DETAIL_FONT,
        color,
      }).setOrigin(0.5);
    }
  }

  private buildButtons(): void {
    let nav: MenuNav | undefined;
    const playAgain = this.createButton(WORLD_WIDTH / 2, LAYOUT.BTN_PLAY_AGAIN_Y, 'play again', () => {
      this.scene.start(SceneKey.Game, { session: this.summary.session });
    }, () => nav?.hoverAt(0));
    const mainMenu = this.createButton(WORLD_WIDTH / 2, LAYOUT.BTN_MAIN_MENU_Y, 'main menu', () => {
      this.scene.start(SceneKey.MainMenu);
    }, () => nav?.hoverAt(1));
    nav = new MenuNav(this, [playAgain, mainMenu]);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void, onHover?: () => void): MenuNavItem {
    const bg = this.add.graphics();
    const labelText = this.add.text(x, y, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize: LAYOUT.BTN_FONT,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      bg.fillRoundedRect(x - LAYOUT.BTN_W / 2, y - LAYOUT.BTN_H / 2, LAYOUT.BTN_W, LAYOUT.BTN_H, LAYOUT.BTN_RADIUS);
      labelText.setText(hovered ? `~ ${label} ~` : label);
    };
    draw(false);

    const hit = this.add.rectangle(x, y, LAYOUT.BTN_W, LAYOUT.BTN_H).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { onHover?.(); draw(true); });
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', onClick);

    return {
      setFocus: (f) => draw(f),
      activate: onClick,
    };
  }
}
