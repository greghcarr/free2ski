import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, PX_PER_METER, JUMP_COURSE_DISTANCE_M, COLORS } from '@/data/constants';
import { addVersionLabel } from '@/ui/versionLabel';
import { HighScoreManager, type SubmitResult } from '@/data/HighScoreManager';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';
import { formatRaceTime } from '@/utils/MathUtils';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';

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

    this.buildBackground();
    this.buildHeadline();
    this.buildStats(result);
    this.buildButtons();
    addVersionLabel(this, COLORS.VERSION_GAMEOVER);
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

    this.add.text(WORLD_WIDTH / 2, 87, session.mode.replace(/_/g, ' ').toUpperCase(), {
      fontFamily: 'FoxwhelpFont',
      fontSize: '14px',
      color: COLORS.UI_MUTED,
      letterSpacing: 3,
    }).setOrigin(0.5);

    let headline: string;
    let color: string;
    let fontSize: string;
    if (courseComplete || finishTimeMs !== undefined) {
      headline = 'COURSE COMPLETE'; color = COLORS.POPUP_GOLD; fontSize = '50px';
    } else if (caughtByYeti) {
      headline = 'THE YETI GOT YOU'; color = COLORS.DANGER; fontSize = '50px';
    } else {
      headline = 'WIPEOUT'; color = COLORS.DANGER; fontSize = '62px';
    }

    this.add.text(WORLD_WIDTH / 2, 180, headline, {
      fontFamily: 'FoxwhelpFont',
      fontSize,
      fontStyle:  'bold',
      color,
      stroke:     '#000000',
      strokeThickness: 2,
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
    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT - 28, `Run #${total}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '18px',
      color: COLORS.UI_COUNT,
    }).setOrigin(0.5);
  }

  // --- Slalom crash (mid-course wipeout) layout ---

  private buildSlalomCrashStats(): void {
    const elapsed = this.summary.elapsedTimeMs ?? 0;
    const passed  = this.summary.gatesPassed   ?? 0;
    const total   = this.summary.totalGatesInCourse ?? 0;

    this.add.text(WORLD_WIDTH / 2, 339, formatRaceTime(elapsed), {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '58px',
      fontStyle:  'bold',
      color:      '#ffffff',
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, 438, `${passed} / ${total} gates passed`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '16px',
      color:      COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    div.beginPath();
    div.moveTo(WORLD_WIDTH / 2 - 330, 492);
    div.lineTo(WORLD_WIDTH / 2 + 330, 492);
    div.strokePath();

    const bestMs = HighScoreManager.getBest(GameMode.Slalom)?.timeMs ?? null;
    if (bestMs !== null) {
      this.add.text(WORLD_WIDTH / 2, 537, `Personal best: ${formatRaceTime(bestMs)}`, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   '19px',
        color:      COLORS.UI_SECONDARY,
      }).setOrigin(0.5);

    } else {
      this.add.text(WORLD_WIDTH / 2, 537, 'No completed runs on record', {
        fontFamily: 'FoxwhelpFont',
        fontSize:   '16px',
        color:      COLORS.UI_SECONDARY,
      }).setOrigin(0.5);
    }
  }

  // --- Time-trial (Slalom) layout ---

  private buildTimerStats(result: SubmitResult): void {
    const { finishTimeMs, penaltyMs, gatesPassed, gatesMissed } = this.summary;
    const { isNewBest, prevBest } = result;
    const missed  = gatesMissed ?? 0;
    const penalty = penaltyMs  ?? 0;

    this.add.text(WORLD_WIDTH / 2, 330, formatRaceTime(finishTimeMs!), {
      fontFamily: 'FoxwhelpFont',
      fontSize: '58px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const subtitle = missed > 0
      ? `${missed} gate${missed > 1 ? 's' : ''} missed  ·  +${penalty / 1000}s penalty`
      : `${(gatesPassed ?? 0)} / ${(gatesPassed ?? 0) + missed} gates  ·  no penalties`;
    this.add.text(WORLD_WIDTH / 2, 438, subtitle, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '16px',
      color: missed > 0 ? COLORS.SCORE_WORSE : COLORS.SCORE_BETTER,
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    div.beginPath();
    div.moveTo(WORLD_WIDTH / 2 - 330, 492);
    div.lineTo(WORLD_WIDTH / 2 + 330, 492);
    div.strokePath();

    if (isNewBest) {
      this.buildNewBestTimeBadge(finishTimeMs!, prevBest?.timeMs ?? null);
    } else {
      this.buildExistingBestTimeRow(finishTimeMs!, prevBest?.timeMs ?? null);
    }
  }

  private buildNewBestTimeBadge(timeMs: number, prevMs: number | null): void {
    const badge = this.add.text(WORLD_WIDTH / 2, 540, '★  NEW PERSONAL BEST  ★', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.POPUP_GOLD,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: badge,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const sub = prevMs !== null
      ? `${formatRaceTime(prevMs)}  →  ${formatRaceTime(timeMs)}`
      : 'First run on record!';
    this.add.text(WORLD_WIDTH / 2, 597, sub, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '15px',
      color: COLORS.UI_DETAIL,
    }).setOrigin(0.5);
  }

  private buildExistingBestTimeRow(timeMs: number, bestMs: number | null): void {
    const best = bestMs ?? timeMs;
    this.add.text(WORLD_WIDTH / 2, 537, `Personal best: ${formatRaceTime(best)}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '19px',
      color: COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    if (bestMs !== null) {
      const deltaMs = timeMs - bestMs;
      const label   = deltaMs === 0 ? 'Same as this run'
                    : `${deltaMs > 0 ? '+' : '-'}${formatRaceTime(Math.abs(deltaMs))} this run`;
      const color   = deltaMs === 0 ? COLORS.HUD_VALUE : deltaMs < 0 ? COLORS.SCORE_BETTER : COLORS.SCORE_WORSE;
      this.add.text(WORLD_WIDTH / 2, 585, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize: '15px',
        color,
      }).setOrigin(0.5);
    }
  }

  // --- Distance-based (all other modes) layout ---

  private buildDistanceStats(result: SubmitResult): void {
    const { distanceM, score, session, yetisEvaded } = this.summary;
    const { isNewBest, prevBest } = result;

    this.add.text(WORLD_WIDTH / 2, 339, `${distanceM.toLocaleString()} m`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const subLabel = session.mode === GameMode.FreeSki
      ? `Yetis evaded: ${yetisEvaded ?? 0}`
      : `Score: ${score.toLocaleString()}`;
    this.add.text(WORLD_WIDTH / 2, 435, subLabel, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '20px',
      color: COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    div.beginPath();
    div.moveTo(WORLD_WIDTH / 2 - 330, 492);
    div.lineTo(WORLD_WIDTH / 2 + 330, 492);
    div.strokePath();

    if (isNewBest) {
      this.buildNewBestDistanceBadge(distanceM, prevBest?.distance ?? null);
    } else {
      this.buildExistingBestDistanceRow(distanceM, prevBest?.distance ?? null);
    }
  }

  private buildNewBestDistanceBadge(distanceM: number, prevM: number | null): void {
    const badge = this.add.text(WORLD_WIDTH / 2, 540, '★  NEW PERSONAL BEST  ★', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.POPUP_GOLD,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: badge,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const sub = prevM !== null
      ? `+${(distanceM - prevM).toLocaleString()} m over previous  (${prevM.toLocaleString()} m)`
      : 'First run on record!';
    this.add.text(WORLD_WIDTH / 2, 597, sub, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '15px',
      color: COLORS.UI_DETAIL,
    }).setOrigin(0.5);
  }

  private buildExistingBestDistanceRow(distanceM: number, bestM: number | null): void {
    const best = bestM ?? distanceM;
    this.add.text(WORLD_WIDTH / 2, 537, `Personal best: ${best.toLocaleString()} m`, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '19px',
      color: COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    if (bestM !== null) {
      const delta = distanceM - bestM;
      const label = delta === 0 ? 'Same as this run'
                  : `${delta > 0 ? '+' : '-'}${Math.abs(delta).toLocaleString()} m this run`;
      const color = delta === 0 ? COLORS.HUD_VALUE : delta > 0 ? COLORS.SCORE_BETTER : COLORS.SCORE_WORSE;
      this.add.text(WORLD_WIDTH / 2, 585, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize: '15px',
        color,
      }).setOrigin(0.5);
    }
  }

  // --- Jump mode layout ---

  private buildJumpStats(result: SubmitResult): void {
    const { score, distanceM, courseComplete } = this.summary;
    const { isNewBest, prevBest } = result;

    this.add.text(WORLD_WIDTH / 2, 339, `Score: ${score}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '52px',
      fontStyle:  'bold',
      color:      '#ffffff',
    }).setOrigin(0.5);

    if (!courseComplete) {
      const courseM = JUMP_COURSE_DISTANCE_M;
      this.add.text(WORLD_WIDTH / 2, 435, `${distanceM.toLocaleString()} / ${courseM.toLocaleString()} m`, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   '20px',
        color:      COLORS.UI_SECONDARY,
      }).setOrigin(0.5);
    }

    const div = this.add.graphics();
    div.lineStyle(1, COLORS.UI_DIVIDER, 1);
    div.beginPath();
    div.moveTo(WORLD_WIDTH / 2 - 330, 492);
    div.lineTo(WORLD_WIDTH / 2 + 330, 492);
    div.strokePath();

    if (isNewBest) {
      this.buildNewBestJumpBadge(score, prevBest?.score ?? null);
    } else {
      this.buildExistingBestJumpRow(score, prevBest?.score ?? null);
    }
  }

  private buildNewBestJumpBadge(score: number, prevScore: number | null): void {
    const badge = this.add.text(WORLD_WIDTH / 2, 540, '★  NEW PERSONAL BEST  ★', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '24px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    this.tweens.add({
      targets:  badge,
      scaleX:   1.06,
      scaleY:   1.06,
      duration: 700,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    const sub = prevScore !== null
      ? `+${score - prevScore} over previous  (best: ${prevScore})`
      : 'First run on record!';
    this.add.text(WORLD_WIDTH / 2, 597, sub, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '15px',
      color:      COLORS.UI_DETAIL,
    }).setOrigin(0.5);
  }

  private buildExistingBestJumpRow(score: number, bestScore: number | null): void {
    const best = bestScore ?? score;
    this.add.text(WORLD_WIDTH / 2, 537, `Personal best: ${best}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '19px',
      color:      COLORS.UI_SECONDARY,
    }).setOrigin(0.5);

    if (bestScore !== null) {
      const delta = score - bestScore;
      const label = delta === 0 ? 'Same as this run'
                  : `${delta > 0 ? '+' : ''}${delta} this run`;
      const color = delta === 0 ? COLORS.HUD_VALUE : delta > 0 ? COLORS.SCORE_BETTER : COLORS.SCORE_WORSE;
      this.add.text(WORLD_WIDTH / 2, 585, label, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   '15px',
        color,
      }).setOrigin(0.5);
    }
  }

  private buildButtons(): void {
    let nav: MenuNav | undefined;
    const playAgain = this.createButton(WORLD_WIDTH / 2, 696, 'PLAY AGAIN', () => {
      this.scene.start(SceneKey.Game, { session: this.summary.session });
    }, () => nav?.hoverAt(0));
    const mainMenu = this.createButton(WORLD_WIDTH / 2, 807, 'MAIN MENU', () => {
      this.scene.start(SceneKey.MainMenu);
    }, () => nav?.hoverAt(1));
    nav = new MenuNav(this, [playAgain, mainMenu]);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void, onHover?: () => void): MenuNavItem {
    const btnW = 270;
    const btnH = 54;
    const bg   = this.add.graphics();

    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
    };
    draw(false);

    this.add.text(x, y, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { onHover?.(); draw(true); });
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', onClick);

    return {
      setFocus: (f) => draw(f),
      activate: onClick,
    };
  }
}
