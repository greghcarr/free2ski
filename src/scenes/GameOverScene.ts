import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, PX_PER_METER } from '@/data/constants';
import { HighScoreManager, type SubmitResult } from '@/data/HighScoreManager';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';
import { formatRaceTime } from '@/utils/MathUtils';

export interface GameOverData {
  session:      SessionConfig;
  distancePx:   number;
  score:        number;
  caughtByYeti: boolean;
  finishTimeMs?: number;
  penaltyMs?:    number;
  gatesPassed?:  number;
  gatesMissed?:  number;
}

interface RunSummary {
  distanceM:    number;
  score:        number;
  session:      SessionConfig;
  caughtByYeti: boolean;
  finishTimeMs?: number;
  penaltyMs?:    number;
  gatesPassed?:  number;
  gatesMissed?:  number;
}

export class GameOverScene extends Phaser.Scene {
  private summary!: RunSummary;

  constructor() {
    super({ key: SceneKey.GameOver });
  }

  init(data: Partial<GameOverData>): void {
    // Store data for use in create() — don't call this.add here
    this.summary = {
      distanceM:    Math.floor((data.distancePx ?? 0) / PX_PER_METER),
      score:        data.score ?? 0,
      session:      data.session ?? { mode: GameMode.FreeSki },
      caughtByYeti: data.caughtByYeti ?? false,
      ...(data.finishTimeMs !== undefined && {
        finishTimeMs: data.finishTimeMs,
        penaltyMs:    data.penaltyMs ?? 0,
        gatesPassed:  data.gatesPassed ?? 0,
        gatesMissed:  data.gatesMissed ?? 0,
      }),
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
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  private buildBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1520, 0x0a1520, 0x162535, 0x162535, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
  }

  private buildHeadline(): void {
    const { caughtByYeti, session, finishTimeMs } = this.summary;

    this.add.text(WORLD_WIDTH / 2, 58, session.mode.replace(/_/g, ' ').toUpperCase(), {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#445566',
      letterSpacing: 3,
    }).setOrigin(0.5);

    let headline: string;
    let color: string;
    let fontSize: string;
    if (finishTimeMs !== undefined) {
      headline = 'COURSE COMPLETE'; color = '#ffd700'; fontSize = '50px';
    } else if (caughtByYeti) {
      headline = 'THE YETI GOT YOU'; color = '#c8ddf0'; fontSize = '50px';
    } else {
      headline = 'WIPEOUT'; color = '#e63030'; fontSize = '62px';
    }

    this.add.text(WORLD_WIDTH / 2, 120, headline, {
      fontFamily: 'sans-serif',
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
    } else {
      this.buildDistanceStats(result);
    }

    const total = HighScoreManager.getTotalRuns();
    this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT - 22, `Run #${total}`, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#2a3a4a',
    }).setOrigin(0.5);
  }

  // --- Time-trial (Slalom) layout ---

  private buildTimerStats(result: SubmitResult): void {
    const { finishTimeMs, penaltyMs, gatesPassed, gatesMissed } = this.summary;
    const { isNewBest, prevBest } = result;
    const missed  = gatesMissed ?? 0;
    const penalty = penaltyMs  ?? 0;

    this.add.text(WORLD_WIDTH / 2, 220, formatRaceTime(finishTimeMs!), {
      fontFamily: 'sans-serif',
      fontSize: '58px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const subtitle = missed > 0
      ? `${missed} gate${missed > 1 ? 's' : ''} missed  ·  +${penalty / 1000}s penalty`
      : `${(gatesPassed ?? 0)} / ${(gatesPassed ?? 0) + missed} gates  ·  no penalties`;
    this.add.text(WORLD_WIDTH / 2, 292, subtitle, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: missed > 0 ? '#cc7777' : '#78bb78',
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, 0x223344, 1);
    div.beginPath();
    div.moveTo(WORLD_WIDTH / 2 - 220, 328);
    div.lineTo(WORLD_WIDTH / 2 + 220, 328);
    div.strokePath();

    if (isNewBest) {
      this.buildNewBestTimeBadge(finishTimeMs!, prevBest?.timeMs ?? null);
    } else {
      this.buildExistingBestTimeRow(finishTimeMs!, prevBest?.timeMs ?? null);
    }
  }

  private buildNewBestTimeBadge(timeMs: number, prevMs: number | null): void {
    const badge = this.add.text(WORLD_WIDTH / 2, 360, '★  NEW PERSONAL BEST  ★', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
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
    this.add.text(WORLD_WIDTH / 2, 398, sub, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#88aacc',
    }).setOrigin(0.5);
  }

  private buildExistingBestTimeRow(timeMs: number, bestMs: number | null): void {
    const best = bestMs ?? timeMs;
    this.add.text(WORLD_WIDTH / 2, 358, `Personal Best  ${formatRaceTime(best)}`, {
      fontFamily: 'sans-serif',
      fontSize: '19px',
      color: '#6688aa',
    }).setOrigin(0.5);

    if (bestMs !== null) {
      const deltaMs = timeMs - bestMs;
      const prefix  = deltaMs > 0 ? '+' : '';
      const color   = deltaMs <= 0 ? '#78bb78' : '#cc7777';
      this.add.text(WORLD_WIDTH / 2, 390, `${prefix}${(deltaMs / 1000).toFixed(1)}s this run`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color,
      }).setOrigin(0.5);
    }
  }

  // --- Distance-based (all other modes) layout ---

  private buildDistanceStats(result: SubmitResult): void {
    const { distanceM, score } = this.summary;
    const { isNewBest, prevBest } = result;

    this.add.text(WORLD_WIDTH / 2, 226, `${distanceM.toLocaleString()} m`, {
      fontFamily: 'sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, 290, `Score  ${score.toLocaleString()}`, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#6688aa',
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, 0x223344, 1);
    div.beginPath();
    div.moveTo(WORLD_WIDTH / 2 - 220, 328);
    div.lineTo(WORLD_WIDTH / 2 + 220, 328);
    div.strokePath();

    if (isNewBest) {
      this.buildNewBestDistanceBadge(distanceM, prevBest?.distance ?? null);
    } else {
      this.buildExistingBestDistanceRow(distanceM, prevBest?.distance ?? null);
    }
  }

  private buildNewBestDistanceBadge(distanceM: number, prevM: number | null): void {
    const badge = this.add.text(WORLD_WIDTH / 2, 360, '★  NEW PERSONAL BEST  ★', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
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
      ? `+${distanceM - prevM} m over previous  (${prevM.toLocaleString()} m)`
      : 'First run on record!';
    this.add.text(WORLD_WIDTH / 2, 398, sub, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#88aacc',
    }).setOrigin(0.5);
  }

  private buildExistingBestDistanceRow(distanceM: number, bestM: number | null): void {
    const best = bestM ?? distanceM;
    this.add.text(WORLD_WIDTH / 2, 358, `Personal Best  ${best.toLocaleString()} m`, {
      fontFamily: 'sans-serif',
      fontSize: '19px',
      color: '#6688aa',
    }).setOrigin(0.5);

    if (bestM !== null) {
      const delta  = distanceM - bestM;
      const prefix = delta >= 0 ? '+' : '';
      const color  = delta >= 0 ? '#78bb78' : '#cc7777';
      this.add.text(WORLD_WIDTH / 2, 390, `${prefix}${delta} m this run`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color,
      }).setOrigin(0.5);
    }
  }

  private buildButtons(): void {
    this.createButton(WORLD_WIDTH / 2, 464, 'PLAY AGAIN', () => {
      this.scene.start(SceneKey.Game, { session: this.summary.session });
    });
    this.createButton(WORLD_WIDTH / 2, 538, 'MAIN MENU', () => {
      this.scene.start(SceneKey.MainMenu);
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btnW = 270;
    const btnH = 54;
    const bg   = this.add.graphics();

    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? 0x3a6ae8 : 0x2a5ab8, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
    };
    draw(false);

    this.add.text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', onClick);
  }
}
