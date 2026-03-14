import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, PX_PER_METER, JUMP_COURSE_DISTANCE_M, COLORS } from '@/data/constants';
import { addVersionLabel, APP_VERSION } from '@/ui/versionLabel';
import { HighScoreManager, type SubmitResult } from '@/data/HighScoreManager';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';
import { formatRaceTime } from '@/utils/MathUtils';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';
import { submitRun, fetchTopScore } from '@/services/LeaderboardService';
import { getDailySeed } from '@/utils/MathUtils';
import { hasProfanity, sanitizeName } from '@/utils/ProfanityFilter';
import { DEBUG } from '@/data/DebugConfig';

const LAYOUT = {
  // Mode label (top of screen)
  MODE_Y:              92,
  MODE_FONT:           '60px',
  MODE_LETTER_SPACING: 4,

  // Headline ("WIPEOUT", "COURSE COMPLETE", "THE YETI GOT YOU!")
  HEADLINE_Y:             225,
  HEADLINE_FONT:          '165px',
  HEADLINE_FONT_WIPEOUT:  '200px',
  HEADLINE_STROKE_W:      0,

  // Primary metric (distance / finish time / score)
  PRIMARY_Y:         405,  // distance + score modes
  PRIMARY_Y_TIME:    405,  // slalom finish time
  PRIMARY_FONT:      '200px',
  PRIMARY_FONT_TIME: '200px',

  // Secondary sublabel (gates passed, yeti count, distance/score)
  SUB_Y:          512,  // distance + score modes
  SUB_Y_TIME:     512,  // time / slalom-crash modes
  SUB_FONT:       '70px',
  SUB_FONT_SMALL: '70px',

  // Horizontal divider
  // DIVIDER_Y:      475,
  // DIVIDER_HALF_W: 240,

  // New personal best badge
  NEW_BEST_X:          WORLD_WIDTH - 340,
  NEW_BEST_Y:          405,
  NEW_BEST_FONT:       '50px',
  NEW_BEST_PULSE_SCALE: 1.06,
  NEW_BEST_PULSE_MS:    700,

  // World record badge (upgrades the personal best badge)
  NEW_WR_FONT:         '58px',

  // Existing personal best row
  BEST_Y:    526,
  BEST_FONT: '60px',

  // Sub-detail row (prev→current improvement, or run delta)
  DETAIL_Y_BADGE: 520,  // below new-best badge
  DETAIL_Y_DELTA: 520,  // below existing-best row
  DETAIL_FONT:    '66px',

  // Name entry (confirm button is inline to the right of the input)
  NAME_LABEL_Y:      600,
  NAME_INPUT_Y:      660,   // game-space center of the DOM input (H=68)
  NAME_INPUT_W:      620,   // width of the DOM input in game units
  NAME_INPUT_H:      68,
  CONFIRM_BTN_W:     210,   // sits inline right of the input; gap of 16 between them
  CONFIRM_BTN_FONT:  '44px',

  // Run counter (pinned to bottom)
  RUN_COUNTER_BOTTOM: 50,   // offset from GAME_HEIGHT
  RUN_COUNTER_FONT:   '50px',

  // Nav buttons
  BTN_PLAY_AGAIN_Y: 780,
  BTN_MAIN_MENU_Y:  920,
  BTN_W:            695,
  BTN_H:            110,
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
  private summary!:                RunSummary;
  private pendingLeaderboardScore: number | null = null;
  private nameInput:               HTMLInputElement | null = null;
  private handleConfirmVisual:     ((success: boolean) => void) | null = null;
  private liveDotText:             Phaser.GameObjects.Text | null = null;
  private liveNameText:            Phaser.GameObjects.Text | null = null;
  private nav:                     MenuNav | null = null;
  private setConfirmBtnFocus:      ((focused: boolean) => void) | null = null;
  private inputErrorActive         = false;

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
    // Jump mode: only save completed courses (crashes don't count)
    const { mode } = this.summary.session;
    const skipSave = mode === GameMode.Jump && !this.summary.courseComplete;

    const result: SubmitResult = DEBUG.forceNewBest
      ? { isNewBest: true, prevBest: null, current: { distance: this.summary.distanceM, score: this.summary.score, timestamp: Date.now() } }
      : skipSave
        ? { isNewBest: false, prevBest: HighScoreManager.getBest(mode), current: { distance: this.summary.distanceM, score: this.summary.score, timestamp: Date.now() } }
        : HighScoreManager.submitRun(
            mode,
            this.summary.distanceM,
            this.summary.score,
            this.summary.finishTimeMs,
          );

    // Compute the leaderboard score — will be submitted after the user enters their name
    if (mode === GameMode.FreeSki) {
      this.pendingLeaderboardScore = this.summary.distanceM;
    } else if (mode === GameMode.Slalom && this.summary.finishTimeMs !== undefined) {
      this.pendingLeaderboardScore = this.summary.finishTimeMs;
    } else if (mode === GameMode.Jump && !skipSave) {
      this.pendingLeaderboardScore = this.summary.score;
    }

    this.buildBackground();
    this.buildHeadline();
    this.buildStats(result);
    const inputNavItem = this.buildNameEntry();
    this.buildConfirmButton();
    this.buildButtons(inputNavItem);
    addVersionLabel(this, COLORS.VERSION_GAMEOVER);
    this.buildLiveUsernameLabel(COLORS.VERSION_GAMEOVER);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupNameInput());
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

    if (isNewBest) {
      const badge = this.buildNewBestTimeBadge(finishTimeMs!, prevBest?.timeMs ?? null);
      this.checkWorldRecord(badge, finishTimeMs!);
    } else {
      this.buildExistingBestTimeRow(finishTimeMs!, prevBest?.timeMs ?? null);
    }
  }

  private buildNewBestTimeBadge(timeMs: number, prevMs: number | null): Phaser.GameObjects.Text {
    const badge = this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, '★  new personal best !!  ★', {
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

    return badge;

    // const sub = prevMs !== null
    //   ? `${formatRaceTime(prevMs)}  →  ${formatRaceTime(timeMs)}`
    //   : 'first run on record!';
    // this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_BADGE, sub, {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize: LAYOUT.DETAIL_FONT,
    //   color: COLORS.UI_DETAIL,
    // }).setOrigin(0.5);
  }

  private buildExistingBestTimeRow(timeMs: number, bestMs: number | null): void {
    if (bestMs === null) return;
    const deltaMs = timeMs - bestMs;
    if (deltaMs === 0) {
      const badge = this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, '★  tied personal best !!  ★', {
        fontFamily: 'FoxwhelpFont',
        fontSize: LAYOUT.NEW_BEST_FONT,
        fontStyle: 'bold',
        color: COLORS.POPUP_GOLD,
        stroke: '#000000',
        strokeThickness: 1,
      }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scaleX: LAYOUT.NEW_BEST_PULSE_SCALE, scaleY: LAYOUT.NEW_BEST_PULSE_SCALE, duration: LAYOUT.NEW_BEST_PULSE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const label = deltaMs > 0
        ? `+${formatRaceTime(Math.abs(deltaMs))} slower than personal best`
        : `${formatRaceTime(Math.abs(deltaMs))} faster than personal best`;
      this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize: LAYOUT.NEW_BEST_FONT,
        fontStyle: 'bold',
        color: deltaMs > 0 ? COLORS.SCORE_WORSE : COLORS.SCORE_BETTER,
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
      const badge = this.buildNewBestDistanceBadge(distanceM, prevBest?.distance ?? null);
      this.checkWorldRecord(badge, distanceM);
    } else {
      this.buildExistingBestDistanceRow(distanceM, prevBest?.distance ?? null);
    }
  }

  private buildNewBestDistanceBadge(distanceM: number, prevM: number | null): Phaser.GameObjects.Text {
    const badge = this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, '★  new personal best !!  ★', {
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

    // const sub = prevM !== null
    //   ? `+${(distanceM - prevM).toLocaleString()} m over previous (${prevM.toLocaleString()} m)`
    //   : 'first run on record!';
    // this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_BADGE, sub, {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize: LAYOUT.DETAIL_FONT,
    //   color: COLORS.UI_DETAIL,
    // }).setOrigin(0.5);

    return badge;
  }

  private buildExistingBestDistanceRow(distanceM: number, bestM: number | null): void {
    if (bestM === null) return;
    const delta = distanceM - bestM;
    if (delta === 0) {
      const badge = this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, '★  tied personal best !!  ★', {
        fontFamily: 'FoxwhelpFont',
        fontSize: LAYOUT.NEW_BEST_FONT,
        fontStyle: 'bold',
        color: COLORS.POPUP_GOLD,
        stroke: '#000000',
        strokeThickness: 1,
      }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scaleX: LAYOUT.NEW_BEST_PULSE_SCALE, scaleY: LAYOUT.NEW_BEST_PULSE_SCALE, duration: LAYOUT.NEW_BEST_PULSE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const label = delta < 0
        ? `${Math.abs(delta).toLocaleString()} m less than personal best`
        : `${Math.abs(delta).toLocaleString()} m more than personal best`;
      this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize: LAYOUT.NEW_BEST_FONT,
        fontStyle: 'bold',
        color: delta < 0 ? COLORS.SCORE_WORSE : COLORS.SCORE_BETTER,
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
      const badge = this.buildNewBestJumpBadge(score, prevBest?.score ?? null);
      this.checkWorldRecord(badge, score);
    } else {
      this.buildExistingBestJumpRow(score, prevBest?.score ?? null);
    }
  }

  private buildNewBestJumpBadge(score: number, prevScore: number | null): Phaser.GameObjects.Text {
    const badge = this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, '★  new personal best !!  ★', {
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

    // const sub = prevScore !== null
    //   ? `+${score - prevScore} over previous  (best: ${prevScore})`
    //   : 'first run on record!';
    // this.add.text(WORLD_WIDTH / 2, LAYOUT.DETAIL_Y_BADGE, sub, {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize:   LAYOUT.DETAIL_FONT,
    //   color:      COLORS.UI_DETAIL,
    // }).setOrigin(0.5);

    return badge;
  }

  private buildExistingBestJumpRow(score: number, bestScore: number | null): void {
    if (bestScore === null) return;
    const delta = score - bestScore;
    if (delta === 0) {
      const badge = this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, '★  tied personal best !!  ★', {
        fontFamily: 'FoxwhelpFont',
        fontSize:   LAYOUT.NEW_BEST_FONT,
        fontStyle:  'bold',
        color:      COLORS.POPUP_GOLD,
        stroke:     '#000000',
        strokeThickness: 1,
      }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scaleX: LAYOUT.NEW_BEST_PULSE_SCALE, scaleY: LAYOUT.NEW_BEST_PULSE_SCALE, duration: LAYOUT.NEW_BEST_PULSE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const label = delta < 0
        ? `${Math.abs(delta).toLocaleString()} less than personal best`
        : `${Math.abs(delta).toLocaleString()} more than personal best`;
      this.add.text(LAYOUT.NEW_BEST_X, LAYOUT.NEW_BEST_Y, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   LAYOUT.NEW_BEST_FONT,
        fontStyle:  'bold',
        color: delta < 0 ? COLORS.SCORE_WORSE : COLORS.SCORE_BETTER,
      }).setOrigin(0.5);
    }
  }

  // ---------------------------------------------------------------------------
  // World record check
  // ---------------------------------------------------------------------------

  private checkWorldRecord(badge: Phaser.GameObjects.Text, playerScore: number): void {
    if (DEBUG.forceWorldRecord) {
      this.upgradeToWorldRecord(badge);
      return;
    }
    const mode = this.summary.session.mode;
    fetchTopScore(mode)
      .then(topScore => {
        if (!this.sys.isActive() || !badge.active) return;
        const isWR = topScore === null
          || (mode === GameMode.Slalom ? playerScore < topScore : playerScore > topScore);
        if (isWR) this.upgradeToWorldRecord(badge);
      })
      .catch(() => {});
  }

  private upgradeToWorldRecord(badge: Phaser.GameObjects.Text): void {
    badge.setText('★  NEW WORLD RECORD  ★');
    badge.setFontSize(LAYOUT.NEW_WR_FONT);
    badge.setStroke('#000000', 3);

    this.cameras.main.flash(500, 255, 255, 255);
    this.cameras.main.shake(350, 0.009);

    this.tweens.killTweensOf(badge);

    // Scale pulse
    this.tweens.add({
      targets:  badge,
      scaleX:   1.15,
      scaleY:   1.15,
      duration: 380,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Gentle rotation rock
    const rockTween = this.tweens.add({
      targets:  badge,
      angle:    { from: -8, to: 8 },
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Occasional crazy full spin
    const scheduleSpin = (): void => {
      this.time.delayedCall(Phaser.Math.Between(2200, 5000), () => {
        if (!badge.active) return;
        rockTween.pause();
        badge.setAngle(0);
        this.tweens.add({
          targets:    badge,
          angle:      720,
          duration:   480,
          ease:       'Quad.easeInOut',
          onComplete: () => {
            badge.setAngle(0);
            rockTween.restart();
            scheduleSpin();
          },
        });
      });
    };
    scheduleSpin();

    // Occasional parabolic jump to the other side of the screen
    const originX = LAYOUT.NEW_BEST_X;
    const otherX  = WORLD_WIDTH - LAYOUT.NEW_BEST_X;
    const scheduleJump = (): void => {
      this.time.delayedCall(Phaser.Math.Between(1800, 4000), () => {
        if (!badge.active) return;
        const startX = badge.x;
        const endX   = Math.abs(badge.x - originX) < 20 ? otherX : originX;
        const startY = badge.y;
        const arcH   = 260;
        const prog   = { t: 0 };
        this.tweens.add({
          targets:    prog,
          t:          1,
          duration:   550,
          ease:       'Linear',
          onUpdate:   () => {
            badge.x = startX + (endX - startX) * prog.t;
            badge.y = startY - arcH * 4 * prog.t * (1 - prog.t);
          },
          onComplete: () => {
            badge.x = endX;
            badge.y = startY;
            scheduleJump();
          },
        });
      });
    };
    scheduleJump();

    // Rainbow color cycling
    const RAINBOW = ['#ff4444', '#ff8c00', '#ffee00', '#44ff88', '#44aaff', '#aa44ff', '#ff44cc'];
    let ri = 0;
    this.time.addEvent({
      delay:    70,
      loop:     true,
      callback: () => {
        if (!badge.active) return;
        badge.setColor(RAINBOW[ri % RAINBOW.length]!);
        ri++;
      },
    });
  }

  private buildButtons(inputNavItem: MenuNavItem): void {
    const playAgain = this.createButton(WORLD_WIDTH / 2, LAYOUT.BTN_PLAY_AGAIN_Y, 'play again', () => {
      this.submitAndNavigate(() => this.scene.start(SceneKey.Game, { session: this.summary.session }));
    }, () => this.nav?.hoverAt(1));
    const mainMenu = this.createButton(WORLD_WIDTH / 2, LAYOUT.BTN_MAIN_MENU_Y, 'main menu', () => {
      this.submitAndNavigate(() => this.scene.start(SceneKey.MainMenu));
    }, () => this.nav?.hoverAt(2));
    this.nav = new MenuNav(this, [inputNavItem, playAgain, mainMenu]);
  }

  private buildNameEntry(): MenuNavItem {
    const saved = HighScoreManager.getDisplayName() ?? '';

    this.add.text(WORLD_WIDTH / 2, LAYOUT.NAME_LABEL_Y, 'enter your name', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '46px',
      color:      COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    const canvas = this.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = bounds.width  / this.scale.width;
    const scaleY = bounds.height / this.scale.height;

    const inputX = bounds.left + (WORLD_WIDTH / 2 - LAYOUT.NAME_INPUT_W / 2) * scaleX;
    const inputY = bounds.top  + (LAYOUT.NAME_INPUT_Y - LAYOUT.NAME_INPUT_H / 2) * scaleY;

    const el = document.createElement('input');
    el.type          = 'text';
    el.value         = saved;
    el.maxLength     = 24;
    el.placeholder   = 'your name';
    el.autocomplete  = 'off';
    el.spellcheck    = false;
    el.setAttribute('autocorrect',    'off');
    el.setAttribute('autocapitalize', 'off');
    Object.assign(el.style, {
      position:     'fixed',
      left:         `${inputX}px`,
      top:          `${inputY}px`,
      width:        `${LAYOUT.NAME_INPUT_W * scaleX}px`,
      height:       `${LAYOUT.NAME_INPUT_H * scaleY}px`,
      fontSize:     `${Math.round(30 * scaleY)}px`,
      fontFamily:   'monospace',
      background:   'rgba(255,255,255,0.12)',
      border:       '2px solid rgba(255,255,255,0.4)',
      borderRadius: '6px',
      color:        '#ffffff',
      padding:      '0 12px',
      outline:      'none',
      textAlign:    'center',
      zIndex:       '99998',
      boxSizing:    'border-box',
      transition:   'border-color 0.15s ease, box-shadow 0.15s ease',
    });
    (canvas.parentElement ?? document.body).appendChild(el);
    el.focus();
    if (saved) el.select();

    el.addEventListener('focus', () => {
      if (!this.inputErrorActive) {
        el.style.borderColor = '#3a6ae8';
        el.style.boxShadow   = '0 0 12px 3px rgba(58,106,232,0.6)';
      }
    });
    el.addEventListener('blur', () => {
      if (!this.inputErrorActive) {
        el.style.borderColor = 'rgba(255,255,255,0.4)';
        el.style.boxShadow   = 'none';
      }
    });
    el.addEventListener('input', () => {
      this.setInputGlow(false);
      this.updateLiveUsernameLabel(sanitizeName(el.value));
    });
    el.addEventListener('keydown', (e) => {
      // Stop all keys from bubbling to Phaser's window-level handler,
      // which would call preventDefault() on WASD / Space and swallow them.
      e.stopPropagation();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        el.blur();
        this.nav?.move(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (e.key === 'ArrowRight') {
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
        if (atEnd && !el.disabled) {
          e.preventDefault();
          el.blur();
          this.setConfirmBtnFocus?.(true);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const ok = this.confirmName();
        this.handleConfirmVisual?.(ok);
      }
    });

    if (DEBUG.showInputGlow) this.setInputGlow(true);

    this.nameInput = el;

    return {
      setFocus: (focused) => {
        if (focused && !el.disabled) el.focus();
        else if (!focused && document.activeElement === el) el.blur();
      },
      activate: () => {
        if (!el.disabled) el.focus();
      },
    };
  }

  private buildConfirmButton(): void {
    // Positioned inline to the right of the input field
    const inputRightX = WORLD_WIDTH / 2 + LAYOUT.NAME_INPUT_W / 2;
    const gap  = 16;
    const w    = LAYOUT.CONFIRM_BTN_W;
    const h    = LAYOUT.NAME_INPUT_H;
    const x    = inputRightX + gap + w / 2;
    const y    = LAYOUT.NAME_INPUT_Y;

    const GLOW_LAYERS = [
      { pad: 24, alpha: 0.04 },
      { pad: 16, alpha: 0.08 },
      { pad: 10, alpha: 0.13 },
      { pad:  6, alpha: 0.18 },
      { pad:  2, alpha: 0.24 },
    ] as const;

    const container = this.add.container(x, y);
    const glowGfx   = this.add.graphics();
    const bg        = this.add.graphics();
    const lbl       = this.add.text(0, 0, 'confirm', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   LAYOUT.CONFIRM_BTN_FONT,
      fontStyle:  'bold',
      color:      '#ffffff',
    }).setOrigin(0.5);
    container.add([glowGfx, bg, lbl]);

    let kbFocused    = false;
    let pulseTween: Phaser.Tweens.Tween | null = null;

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 10 + pad);
      }
    };
    const draw = (state: 'default' | 'hover' | 'focused' | 'saved' | 'rejected'): void => {
      bg.clear();
      if (state === 'saved') {
        bg.fillStyle(0x4caf50, 1);
        lbl.setText('saved!');
        lbl.setColor('#ffffff');
      } else if (state === 'rejected') {
        bg.fillStyle(0xcc3333, 1);
        lbl.setText('rejected');
        lbl.setColor('#ffffff');
      } else {
        bg.fillStyle(state === 'hover' || state === 'focused' ? COLORS.BTN_HOVER : COLORS.BTN, 1);
        lbl.setText('confirm');
        lbl.setColor('#ffffff');
      }
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw('default');

    const activate = (): void => {
      const ok = this.confirmName();
      this.handleConfirmVisual?.(ok);
      this.tweens.add({
        targets:  container,
        scaleX:   1.07,
        scaleY:   1.07,
        duration: 55,
        ease:     'Quad.easeOut',
        yoyo:     true,
      });
    };

    this.setConfirmBtnFocus = (focused: boolean) => {
      kbFocused = focused;
      drawGlow(focused);
      draw(focused ? 'focused' : 'default');
      if (focused) {
        this.nav?.clearFocus();
        if (!pulseTween) {
          pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      } else if (pulseTween) {
        pulseTween.stop(); pulseTween = null; container.setScale(1);
      }
    };

    this.input.keyboard?.on('keydown-ENTER', () => { if (kbFocused) activate(); });
    this.input.keyboard?.on('keydown-SPACE', () => { if (kbFocused) activate(); });
    this.input.keyboard?.on('keydown-LEFT',  () => {
      if (!kbFocused) return;
      this.setConfirmBtnFocus?.(false);
      if (this.nameInput) {
        const len = this.nameInput.value.length;
        this.nameInput.focus();
        this.nameInput.setSelectionRange(len, len);
      }
    });

    const hit = this.add.rectangle(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      if (!kbFocused) { drawGlow(true); draw('hover'); }
      if (!pulseTween) pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    hit.on('pointerout', () => {
      if (!kbFocused) { drawGlow(false); draw('default'); }
      if (pulseTween && !kbFocused) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
    });
    hit.on('pointerdown', activate);

    this.handleConfirmVisual = (ok: boolean): void => {
      kbFocused = false;
      drawGlow(false);
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
      if (ok) {
        draw('saved');
        hit.disableInteractive();
        if (this.nameInput) this.nameInput.disabled = true;
        // Defer to next frame so the current keydown-ENTER finishes
        // propagating before MenuNav sees hasFocus=true.
        // Remove the (now-disabled) input item, then focus play again (new index 0).
        this.time.delayedCall(0, () => {
          this.nav?.removeItemAt(0);
          this.nav?.focusAt(0);
        });
      } else {
        draw('rejected');
        this.time.delayedCall(1200, () => draw('default'));
      }
    };
  }

  private confirmName(): boolean {
    const raw  = this.nameInput?.value ?? '';
    const name = sanitizeName(raw);

    if (name.length === 0) {
      this.setInputGlow(true);
      return false;
    }
    if (hasProfanity(name)) {
      this.setInputGlow(true);
      return false;
    }

    this.setInputGlow(false);
    HighScoreManager.setDisplayName(name);

    if (this.pendingLeaderboardScore !== null) {
      submitRun(name, this.summary.session.mode, this.pendingLeaderboardScore, getDailySeed(), APP_VERSION)
        .catch(() => {});
      this.pendingLeaderboardScore = null;
    }
    return true;
  }

  private submitAndNavigate(next: () => void): void {
    const ok = this.confirmName();
    this.handleConfirmVisual?.(ok);
    if (ok) {
      this.cleanupNameInput();
      next();
    }
  }

  private buildLiveUsernameLabel(color: string): void {
    const name = HighScoreManager.getDisplayName();
    this.liveDotText = this.add.text(27, GAME_HEIGHT - 27, '● ', {
      fontFamily: 'monospace',
      fontSize:   '26px',
      color:      name ? '#4caf50' : '#888888',
    }).setOrigin(0, 1);
    this.liveNameText = this.add.text(27 + this.liveDotText.displayWidth, GAME_HEIGHT - 27, name ?? '', {
      fontFamily: 'monospace',
      fontSize:   '26px',
      color,
    }).setOrigin(0, 1);
  }

  private updateLiveUsernameLabel(name: string): void {
    this.liveDotText?.setColor(name.length > 0 ? '#4caf50' : '#888888');
    this.liveNameText?.setText(name);
  }

  private setInputGlow(error: boolean): void {
    if (!this.nameInput) return;
    this.inputErrorActive = error;
    if (error) {
      this.nameInput.style.borderColor = '#ff4444';
      this.nameInput.style.boxShadow   = '0 0 12px 3px rgba(255,68,68,0.7)';
    } else {
      const focused = document.activeElement === this.nameInput;
      this.nameInput.style.borderColor = focused ? '#3a6ae8'                       : 'rgba(255,255,255,0.4)';
      this.nameInput.style.boxShadow   = focused ? '0 0 12px 3px rgba(58,106,232,0.6)' : 'none';
    }
  }

  private cleanupNameInput(): void {
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }
  }

  private createButton(x: number, y: number, label: string, onClick: () => void, onHover?: () => void): MenuNavItem {
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
      fontSize: LAYOUT.BTN_FONT,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add([glowGfx, bg, labelText]);

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-LAYOUT.BTN_W / 2 - pad, -LAYOUT.BTN_H / 2 - pad, LAYOUT.BTN_W + pad * 2, LAYOUT.BTN_H + pad * 2, LAYOUT.BTN_RADIUS + pad);
      }
    };
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      bg.fillRoundedRect(-LAYOUT.BTN_W / 2, -LAYOUT.BTN_H / 2, LAYOUT.BTN_W, LAYOUT.BTN_H, LAYOUT.BTN_RADIUS);
      labelText.setText(hovered ? `~ ${label} ~` : label);
      labelText.setColor('#ffffff');
    };
    drawBg(false);

    let pulseTween: Phaser.Tweens.Tween | null = null;

    const flashAndGo = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
      bg.clear();
      bg.fillStyle(0xddf4ff, 1);
      bg.fillRoundedRect(-LAYOUT.BTN_W / 2, -LAYOUT.BTN_H / 2, LAYOUT.BTN_W, LAYOUT.BTN_H, LAYOUT.BTN_RADIUS);
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

    const hit = this.add.rectangle(x, y, LAYOUT.BTN_W, LAYOUT.BTN_H).setInteractive({ useHandCursor: true });
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
