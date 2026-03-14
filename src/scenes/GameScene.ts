import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import {
  WORLD_WIDTH,
  GAME_HEIGHT,
  COLORS,
  DEPTH,
  BASE_SCROLL_SPEED,
  MAX_SCROLL_SPEED,
  SPEED_ACCEL_RATE,
  PX_PER_METER,
  GATE_PASS_BONUS,
  AIR_TIME_DIVISOR,
  COURSE_EDGE_WIDE,
  COURSE_EDGE_NARROW,
  JUMP_COURSE_DISTANCE_M,
  FINISH_LINE_H,
  STAR_DURATION_MS,
  LIGHTNING_DURATION_MS,
  LIGHTNING_SPEED_MULT,
} from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { PlayerState, Player } from '@/entities/Player';
import { InputSystem } from '@/systems/InputSystem';
import { ChunkManager } from '@/world/ChunkManager';
import { YetiSystem } from '@/systems/YetiSystem';
import type { GameOverData } from '@/scenes/GameOverScene';
import { formatRaceTime, getDailySeed, formatTimeUntilMidnightUTC } from '@/utils/MathUtils';
import { HighScoreManager } from '@/data/HighScoreManager';
import { DEBUG } from '@/data/DebugConfig';
import { fetchTopScore } from '@/services/LeaderboardService';

// Screen Y where the player is positioned (upper-centre area)
const PLAYER_SCREEN_Y = Math.floor(GAME_HEIGHT * 0.36);

// Trail configuration
const TRAIL_SAMPLE_INTERVAL = 12;  // world-px between samples
const TRAIL_MAX_WORLD_PX    = 900; // how far back the trail extends
const TRAIL_TRACK_HW        = 8;   // half-distance between left and right ski grooves
const TRAIL_MAX_ALPHA       = 0.45;

interface TrailSample {
  x:      number;
  worldY: number; // worldOffsetY at time of recording
  angle:  number; // player angle (degrees) at time of recording
  lean:   number; // normalised lean -1…+1 (matches Player MAX_ANGLE=72)
}

export class GameScene extends Phaser.Scene {
  // --- State ---
  private naturalSpeed  = BASE_SCROLL_SPEED;
  private worldOffsetY  = 0;
  private distancePx    = 0;
  private gameActive    = false;

  // --- Bonus scoring ---
  private gatesPassed     = 0;
  private bonusScore      = 0;
  private totalAirTimeMs  = 0;

  // --- Slalom time-trial ---
  private courseStartTimeMs   = 0;
  private penaltyMs           = 0;
  private elapsedMs           = 0; // last value shown on HUD timer
  private lastUpdateTime      = -1; // used to detect resume and skip paused duration
  private justResumed         = false;
  private gatesCompleted      = 0;
  private totalGatesInCourse  = 0;
  private lastTimerStr        = '';

  // --- Jump mode ---
  private jumpScore         = 0;
  private finishLineCrossed = false;
  private jumpScoreTier: 'normal' | 'daily' | 'best' | 'wr' = 'normal';
  private jumpDailyBest     = 0;
  private jumpPersonalBest  = 0;
  private jumpWorldRecord   = Infinity; // fetched async; Infinity = not loaded / no record

  // --- Entities ---
  private player!:       Player;
  private controls!:     InputSystem;
  private chunkManager!: ChunkManager;
  private yetiSystem!:   YetiSystem;

  // --- Visuals ---
  private slopeGfx!:    Phaser.GameObjects.Graphics;
  private edgeShadows!: Phaser.GameObjects.Graphics;
  private trailGfx!:    Phaser.GameObjects.Graphics;

  // --- Trail state ---
  private trailSamples:     TrailSample[] = [];
  private lastSampleWorldY  = 0;
  private prevPlayerState:  PlayerState   = PlayerState.Skiing;

  // --- HUD ---
  private distanceText!:  Phaser.GameObjects.Text;
  private timerText!:     Phaser.GameObjects.Text;
  // private yetiWarning!:   Phaser.GameObjects.Text;
  private jumpScoreText!: Phaser.GameObjects.Text;
  private tierBadge:      Phaser.GameObjects.Text | undefined;
  private wrRainbowTimer: Phaser.Time.TimerEvent | undefined;
  private wrSpinTimer:    Phaser.Time.TimerEvent | undefined;

  // --- Finish line (Jump mode) ---
  private finishLineGfx?: Phaser.GameObjects.Graphics;

  // --- Course announcement (world-space) ---
  private announcementContainer: Phaser.GameObjects.Container | undefined;
  private announcementWorldY     = 0;

  private pointerIsDown          = false;
  private onWindowPointerUp      = () => { this.pointerIsDown = false; };


  // --- Session ---
  private session!: SessionConfig;

  constructor() {
    super({ key: SceneKey.Game });
  }

  init(data: { session?: SessionConfig }): void {
    this.session          = data.session ?? { mode: GameMode.FreeSki, seed: Date.now() };
    this.naturalSpeed     = BASE_SCROLL_SPEED;
    this.worldOffsetY     = 0;
    this.distancePx       = 0;
    this.gameActive       = true;
    this.gatesPassed      = 0;
    this.bonusScore       = 0;
    this.totalAirTimeMs   = 0;
    this.penaltyMs        = 0;
    this.gatesCompleted   = 0;
    this.courseStartTimeMs = -1; // set on first update frame
    this.jumpScore         = 0;
    this.finishLineCrossed = false;
    this.jumpScoreTier     = 'normal';
    this.jumpWorldRecord   = Infinity;

    // Load bests for current mode
    // Higher-is-better modes: default to 0 so any positive value beats "no record"
    // Slalom (lower-is-better): default to 0 so value < 0 is never true (no false triggers)
    const mode = this.session.mode;
    if (mode === GameMode.FreeSki) {
      this.jumpDailyBest    = HighScoreManager.getDailyBest(mode)?.distance ?? 0;
      this.jumpPersonalBest = HighScoreManager.getBest(mode)?.distance ?? 0;
    } else if (mode === GameMode.Jump) {
      this.jumpDailyBest    = HighScoreManager.getDailyBest(mode)?.score ?? 0;
      this.jumpPersonalBest = HighScoreManager.getBest(mode)?.score ?? 0;
    } else if (mode === GameMode.Slalom) {
      this.jumpDailyBest    = HighScoreManager.getDailyBest(mode)?.timeMs ?? 0;
      this.jumpPersonalBest = HighScoreManager.getBest(mode)?.timeMs ?? 0;
    } else {
      this.jumpDailyBest    = 0;
      this.jumpPersonalBest = 0;
    }
    const modeCfg = GAME_MODE_CONFIGS[this.session.mode];
    this.totalGatesInCourse = modeCfg.slalomCourse?.totalGates ?? 0;
    this.trailSamples     = [];
    this.lastSampleWorldY = 0;
    this.prevPlayerState  = PlayerState.Skiing;
  }

  create(): void {
    this.slopeGfx    = this.add.graphics();
    this.edgeShadows = this.add.graphics();
    this.trailGfx      = this.add.graphics().setDepth(DEPTH.TRAIL);

    this.drawSlope(0);
    // this.drawEdgeShadows();

    this.player       = new Player(this, WORLD_WIDTH / 2, PLAYER_SCREEN_Y);
    this.controls     = new InputSystem(this);
    const worldSeed = getDailySeed();
    this.chunkManager = new ChunkManager(this, worldSeed, this.session.mode);
    this.yetiSystem   = new YetiSystem(this);

    if (this.session.mode === GameMode.Jump) {
      this.buildFinishLine();
    }

    // Fetch world record async
    // Slalom (lower-is-better): default Infinity means any time beats "no record"
    // FreeSki/Jump (higher-is-better): set to 0 so any positive value beats "no record"
    fetchTopScore(this.session.mode)
      .then(wr => {
        this.jumpWorldRecord = wr !== null
          ? wr
          : this.session.mode === GameMode.Slalom ? Infinity : 0;
      })
      .catch(() => {});

    this.buildHUD();
    this.showCourseAnnouncement();
    this.bindPauseKey();
    this.events.on('resume', () => { this.justResumed = true; });

    if (DEBUG.forceYetiSpawn && GAME_MODE_CONFIGS[this.session.mode].yetiEnabled) {
      this.time.delayedCall(500, () => {
        this.yetiSystem.forceSpawn(this.player.x, this.player.screenY);
        this.showYetiWarning();
      });
    }
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;

    // Debug: render the world but freeze all progression
    if (DEBUG.freezeWorld) {
      this.drawSlope(this.worldOffsetY);
      this.chunkManager.update(this.worldOffsetY, this.player.x, this.player.screenY, false);
      return;
    }

    // Latch course start on the first reliable game-clock tick
    if (this.courseStartTimeMs < 0) this.courseStartTimeMs = _time;

    // Skip any time that elapsed while the scene was paused
    if (this.justResumed) {
      if (this.lastUpdateTime >= 0 && this.courseStartTimeMs >= 0) {
        this.courseStartTimeMs += _time - this.lastUpdateTime;
      }
      this.justResumed = false;
    }
    this.lastUpdateTime = _time;

    const dt = delta / 1000;

    // --- Natural speed ramp ---
    if (!DEBUG.freezeSpeed) {
      this.naturalSpeed = Math.min(this.naturalSpeed + SPEED_ACCEL_RATE * dt, MAX_SCROLL_SPEED);
    }

    // --- Player update ---
    const inputState = this.controls.getState();
    const pointer    = this.input.activePointer;
    if (this.pointerIsDown) {
      // Determine which side of the skier's current trajectory the pointer is on.
      // Dot the pointer-relative vector against the trajectory's right-normal:
      //   trajectory direction = (sin a, cos a)
      //   right-normal         = (cos a, -sin a)
      // Positive result → pointer is right of trajectory → steer right.
      const a   = Phaser.Math.DegToRad(this.player.angle);
      const mdx = pointer.x - this.player.x;
      const mdy = pointer.y - this.player.screenY;
      const side = mdx * Math.cos(a) - mdy * Math.sin(a);
      const DEAD_ZONE = 18;
      if (side >  DEAD_ZONE) inputState.right = true;
      if (side < -DEAD_ZONE) inputState.left  = true;
    }
    const speedMod       = this.player.update(inputState, this.naturalSpeed, delta);
    const effectiveSpeed = this.naturalSpeed * speedMod * this.player.speedBoostMult;

    // Track air time for Jump mode score
    if (this.player.state === PlayerState.Jumping) {
      this.totalAirTimeMs += delta;
    }

    // --- Advance world ---
    this.worldOffsetY += effectiveSpeed * dt;
    this.distancePx   += effectiveSpeed * dt;

    // --- Record trail sample (only when on the ground) ---
    // Clear history on landing so the trail doesn't bridge the airborne gap
    if (this.prevPlayerState === PlayerState.Jumping && this.player.state === PlayerState.Skiing) {
      this.trailSamples     = [];
      this.lastSampleWorldY = this.worldOffsetY;
    }
    this.prevPlayerState = this.player.state;

    if (this.player.state === PlayerState.Skiing &&
        this.worldOffsetY - this.lastSampleWorldY >= TRAIL_SAMPLE_INTERVAL) {
      this.lastSampleWorldY = this.worldOffsetY;
      this.trailSamples.unshift({ x: this.player.x, worldY: this.worldOffsetY, angle: this.player.angle, lean: this.player.angle / 72 });

      // Discard samples that have scrolled too far behind
      while (
        this.trailSamples.length > 0 &&
        this.worldOffsetY - this.trailSamples[this.trailSamples.length - 1]!.worldY > TRAIL_MAX_WORLD_PX
      ) {
        this.trailSamples.pop();
      }
    }

    // --- Chunks + collision ---
    const collision = this.chunkManager.update(
      this.worldOffsetY,
      this.player.x,
      this.player.screenY,
      this.player.state === PlayerState.Jumping,
      this.player.invincible,
    );

    if (collision.starPickup) {
      this.player.startInvincibility(STAR_DURATION_MS);
    }

    if (collision.lightningPickup) {
      this.player.startSpeedBoost(LIGHTNING_DURATION_MS, LIGHTNING_SPEED_MULT);
    }

    if (collision.crashed) {
      this.triggerCrash();
      return;
    }

    if (collision.rampHit) {
      this.player.hitRamp();
      if (this.session.mode === GameMode.Jump) {
        this.jumpScore++;
        this.jumpScoreText.setText(`score: ${this.jumpScore}`);
        this.checkScoreTier(this.jumpScore, this.jumpScoreText);
        this.showJumpBonus(this.player.x, PLAYER_SCREEN_Y - 15);
      }
    }

    // Tree flyovers — bonus points in Jump mode
    if (this.session.mode === GameMode.Jump && collision.treeFlyovers.length > 0) {
      for (const flyover of collision.treeFlyovers) {
        this.jumpScore++;
        this.showTreeFlyoverBonus(flyover.x, flyover.screenY);
      }
      this.jumpScoreText.setText(`score: ${this.jumpScore}`);
      this.checkScoreTier(this.jumpScore, this.jumpScoreText);
      this.repositionTierBadge();
    }

    if (collision.gatePassed) {
      this.gatesPassed++;
      if (this.session.mode === GameMode.Slalom) {
        this.gatesCompleted++;
        this.showGatePass(collision.gateX);
        this.checkCourseFinish();
        if (!this.gameActive) return;
      } else {
        this.bonusScore += GATE_PASS_BONUS;
        this.showGateBonus();
      }
    }

    if (collision.gateMissed) {
      if (this.session.mode === GameMode.Slalom) {
        this.gatesCompleted++;
        const penaltyMs = GAME_MODE_CONFIGS[GameMode.Slalom].slalomCourse!.gateMissPenaltyMs;
        this.penaltyMs += penaltyMs;
        this.showPenalty(penaltyMs, collision.gateX);
        this.checkCourseFinish();
        if (!this.gameActive) return;
      }
    }

    // --- Yeti ---
    const modeCfg   = GAME_MODE_CONFIGS[this.session.mode];
    const yetiEvent = this.yetiSystem.update(
      this.distancePx, this.player.x, this.player.screenY, delta,
      modeCfg.yetiEnabled, this.player.state === PlayerState.Jumping,
    );
    if (yetiEvent === 'caught') {
      this.triggerCaughtByYeti();
      return;
    }
    if (yetiEvent === 'evaded') {
      // Yeti evaded — no popup shown
    }
    if (yetiEvent === 'spawned') {
      this.showYetiWarning();
    }

    // --- Jump mode finish line ---
    if (this.session.mode === GameMode.Jump && this.finishLineGfx && !this.finishLineCrossed) {
      const finishWorldY  = JUMP_COURSE_DISTANCE_M * PX_PER_METER;
      const finishScreenY = PLAYER_SCREEN_Y + (finishWorldY - this.worldOffsetY);
      this.finishLineGfx.setY(finishScreenY);
      if (this.worldOffsetY >= finishWorldY) {
        this.finishLineCrossed = true;
        this.triggerJumpCourseFinish();
        return;
      }
    }

    // --- Redraw slope + trail ---
    this.drawSlope(this.worldOffsetY);
    this.drawTrail();

    // --- HUD ---
    if (this.session.mode === GameMode.FreeSki) {
      const distanceM = Math.floor(this.distancePx / PX_PER_METER);
      this.distanceText.setText(`${distanceM.toLocaleString()} m`);
      this.checkScoreTier(distanceM, this.distanceText);
    }
    if (this.session.mode === GameMode.Slalom && this.totalGatesInCourse > 0) {
      this.elapsedMs = Math.round(_time - this.courseStartTimeMs) + this.penaltyMs;
      const formatted = formatRaceTime(this.elapsedMs);
      if (formatted !== this.lastTimerStr) {
        this.lastTimerStr = formatted;
        this.timerText.setText(formatted);
      }
    }
    this.repositionTierBadge();

    // --- Course announcement (world-space scroll) ---
    if (this.announcementContainer) {
      const screenY = PLAYER_SCREEN_Y + (this.announcementWorldY - this.worldOffsetY);
      this.announcementContainer.setY(screenY);
      if (screenY < -400) {
        this.announcementContainer.destroy();
        this.announcementContainer = undefined;
      }
    }

  }

  // ---------------------------------------------------------------------------
  // End-state triggers
  // ---------------------------------------------------------------------------
  triggerCrash(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    this.player.crash(() => {
      this.time.delayedCall(300, () => this.gotoGameOver(false));
    });
  }

  private checkCourseFinish(): void {
    if (this.gatesCompleted >= this.totalGatesInCourse) {
      this.triggerCourseFinish();
    }
  }

  private triggerCourseFinish(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    const finishTimeMs = Math.max(0, Math.round(this.time.now - this.courseStartTimeMs)) + this.penaltyMs;

    this.checkSlalomTier(finishTimeMs);

    const msg = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'FINISH', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '250px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  msg,
      alpha:    0,
      duration: 600,
      delay:    800,
      onComplete: () => {
        msg.destroy();
        this.gotoGameOver(false, finishTimeMs);
      },
    });
  }

  private showGatePass(gateWorldX: number): void {
    const pop = this.add.text(gateWorldX, PLAYER_SCREEN_Y - 90, '\u2714', {
      fontFamily: 'sans-serif',
      fontSize:   '84px',
      fontStyle:  'bold',
      color:      '#44dd44',
      stroke:     '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  pop,
      y:        pop.y - 60,
      alpha:    0,
      duration: 900,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    });
  }

  private showPenalty(penaltyMs: number, gateX: number): void {
    const secs = penaltyMs / 1000;
    const pop  = this.add.text(gateX, PLAYER_SCREEN_Y - 90, `+${secs}s`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '84px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_PENALTY,
      stroke:     '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  pop,
      y:        pop.y - 60,
      alpha:    0,
      duration: 900,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    });
  }

  triggerCaughtByYeti(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    this.player.caughtByYeti(() => {
      this.time.delayedCall(200, () => this.gotoGameOver(true));
    });
  }

  // ---------------------------------------------------------------------------
  // Trail rendering
  // ---------------------------------------------------------------------------
  private drawTrail(): void {
    this.trailGfx.clear();
    const N = this.trailSamples.length;
    if (N < 2) return;

    for (let i = 0; i < N - 1; i++) {
      const curr = this.trailSamples[i]!;
      const next = this.trailSamples[i + 1]!;

      const currScreenY = PLAYER_SCREEN_Y + (curr.worldY - this.worldOffsetY);
      const nextScreenY = PLAYER_SCREEN_Y + (next.worldY - this.worldOffsetY);

      // Skip segments entirely off the top of the screen
      if (currScreenY < -4 && nextScreenY < -4) continue;

      // Alpha fades linearly from full at index 0 to zero at index N-1
      const alpha = TRAIL_MAX_ALPHA * (1 - i / (N - 1));

      // Perpendicular to the direction of travel gives the ski spread.
      // At angle θ from vertical, perp = (cos θ, −sin θ) in screen coords.
      const rad = Phaser.Math.DegToRad(curr.angle);
      const px  = Math.cos(rad) * TRAIL_TRACK_HW;
      const py  = -Math.sin(rad) * TRAIL_TRACK_HW;

      // Outside ski carries more weight → deeper groove.
      // lean > 0 = right turn → left ski is outside; lean < 0 = left → right is outside.
      const abslean = Math.abs(curr.lean);
      const outsideAlpha = alpha * (1 + 0.6 * abslean);
      const insideAlpha  = alpha * (1 - 0.8 * abslean);
      const leftAlpha  = curr.lean >= 0 ? outsideAlpha : insideAlpha;
      const rightAlpha = curr.lean >= 0 ? insideAlpha  : outsideAlpha;

      // Left groove
      this.trailGfx.lineStyle(2, COLORS.TRAIL, leftAlpha);
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(curr.x - px, currScreenY - py);
      this.trailGfx.lineTo(next.x - px, nextScreenY - py);
      this.trailGfx.strokePath();

      // Right groove
      this.trailGfx.lineStyle(2, COLORS.TRAIL, rightAlpha);
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(curr.x + px, currScreenY + py);
      this.trailGfx.lineTo(next.x + px, nextScreenY + py);
      this.trailGfx.strokePath();
    }
  }


  // ---------------------------------------------------------------------------
  // Slope rendering
  // ---------------------------------------------------------------------------
  private drawSlope(offsetY: number): void {
    this.slopeGfx.clear();

    this.slopeGfx.fillStyle(COLORS.SNOW_LIGHT, 1);
    this.slopeGfx.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Subtle horizontal compression lines scrolling downward
    const spacing = 96;
    const count   = Math.ceil(GAME_HEIGHT / spacing) + 2;
    const phase   = offsetY % spacing;

    // Batch horizontal snow lines into a single path
    this.slopeGfx.lineStyle(1, COLORS.SNOW_SHADOW, 0.80);
    this.slopeGfx.beginPath();
    for (let i = 0; i < count; i++) {
      const y = i * spacing - phase;
      this.slopeGfx.moveTo(0, y);
      this.slopeGfx.lineTo(WORLD_WIDTH, y);
    }
    this.slopeGfx.strokePath();

    // Course boundary lines — scrolling dashed yellow verticals (batched per style)
    const mode        = this.session?.mode;
    const edgeX       = mode === GameMode.Slalom ? COURSE_EDGE_NARROW : COURSE_EDGE_WIDE;
    const boundaryXs  = [edgeX, WORLD_WIDTH - edgeX];
    const dashLen     = 42;
    const gapLen      = 21;
    const period      = dashLen + gapLen;
    const dashPhase   = offsetY % period;
    const dashCount   = Math.ceil(GAME_HEIGHT / period) + 2;

    this.slopeGfx.lineStyle(6, COLORS.BOUNDARY, 0.75);
    this.slopeGfx.beginPath();
    for (const bx of boundaryXs) {
      for (let i = 0; i < dashCount; i++) {
        const y0 = i * period - dashPhase;
        const y1 = y0 + dashLen;
        this.slopeGfx.moveTo(bx, y0);
        this.slopeGfx.lineTo(bx, y1);
      }
    }
    this.slopeGfx.strokePath();

    // Danger-zone lines — solid, at the snow/lighter-green boundary (~85% into forest depth)
    const dangerOffset = Math.round(edgeX * 0.85);
    const dangerXs     = [dangerOffset, WORLD_WIDTH - dangerOffset];

    this.slopeGfx.lineStyle(14, COLORS.HAZARD, 0.65);
    this.slopeGfx.beginPath();
    for (const dx of dangerXs) {
      this.slopeGfx.moveTo(dx, 0);
      this.slopeGfx.lineTo(dx, GAME_HEIGHT);
    }
    this.slopeGfx.strokePath();
  }

  private drawEdgeShadows(): void {
    this.edgeShadows.clear();
    this.edgeShadows.fillStyle(COLORS.TREE_DARK, 0.12);
    this.edgeShadows.fillRect(0, 0, 150, GAME_HEIGHT);
    this.edgeShadows.fillRect(WORLD_WIDTH - 150, 0, 150, GAME_HEIGHT);
    this.edgeShadows.fillStyle(COLORS.TREE_DARK, 0.25);
    this.edgeShadows.fillRect(0, 0, 18, GAME_HEIGHT);
    this.edgeShadows.fillRect(WORLD_WIDTH - 18, 0, 18, GAME_HEIGHT);
    this.edgeShadows.setDepth(DEPTH.TERRAIN);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  private buildHUD(): void {

    const mainScoreSize = 120;

    const isFreeSki = this.session.mode === GameMode.FreeSki;
    this.distanceText = this.add.text(WORLD_WIDTH / 2, 40, '0 m', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   mainScoreSize + 'px',
      fontStyle:  'bold',
      color:      '#c0c0c0',
      stroke:     '#000000',
      strokeThickness: 14,
      shadow: { offsetX: 2, offsetY: 2, color: '#00000066', blur: 4, fill: true },
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD).setVisible(isFreeSki);

    // const best    = HighScoreManager.getBest(this.session.mode);
    // const bestStr = (() => {
    //   if (!best) return '–';
    //   switch (this.session.mode) {
    //     case GameMode.FreeSki: return `${best.distance.toLocaleString()} m`;
    //     case GameMode.Slalom:  return best.timeMs !== undefined ? formatRaceTime(best.timeMs) : '–';
    //     case GameMode.Jump:    return `${best.score}`;
    //   }
    // })();
    // this.add.text(WORLD_WIDTH / 2, 130, `best: ${bestStr}`, {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize:   '60px',
    //   color:      COLORS.HUD_LABEL,
    //   stroke:     '#000000',
    //   strokeThickness: 6,
    //   shadow: { offsetX: 2, offsetY: 2, color: '#00000066', blur: 4, fill: true },
    // }).setOrigin(0.5, 0).setDepth(DEPTH.HUD);

    const isTimeTrial = this.session.mode === GameMode.Slalom && this.totalGatesInCourse > 0;

    this.timerText = this.add.text(WORLD_WIDTH / 2, 40, '0:00.0', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   mainScoreSize + 'px',
      fontStyle:  'bold',
      color:      '#c0c0c0',
      stroke:     '#000000',
      strokeThickness: 14,
      shadow: { offsetX: 2, offsetY: 2, color: '#00000066', blur: 4, fill: true },
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD).setVisible(isTimeTrial);

    const isJump = this.session.mode === GameMode.Jump;
    this.jumpScoreText = this.add.text(WORLD_WIDTH / 2, 40, 'score: 0', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   mainScoreSize + 'px',
      fontStyle:  'bold',
      color:      '#c0c0c0',
      stroke:     '#000000',
      strokeThickness: 14,
      shadow: { offsetX: 2, offsetY: 2, color: '#00000066', blur: 4, fill: true },
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD).setVisible(isJump);

    // Settings gear button — top-right corner
    this.buildGearButton();

    addVersionLabel(this, COLORS.VERSION_GAME);
    addUsernameLabel(this, COLORS.VERSION_GAME);
  }

  // ---------------------------------------------------------------------------
  // Gear / pause button (top-right)
  // ---------------------------------------------------------------------------
  private buildGearButton(): void {
    const btnSize = 150;
    const cx = WORLD_WIDTH - 84 - btnSize / 2;
    const cy = 24 + btnSize / 2;

    const container = this.add.container(cx, cy).setDepth(DEPTH.HUD);

    // Glow (shown on hover)
    const glowGfx = this.add.graphics();
    const GLOW_LAYERS = [
      { pad: 24, alpha: 0.04 },
      { pad: 16, alpha: 0.08 },
      { pad: 10, alpha: 0.13 },
      { pad:  5, alpha: 0.18 },
      { pad:  2, alpha: 0.24 },
    ] as const;

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(
          -btnSize / 2 - pad, -btnSize / 2 - pad,
          btnSize + pad * 2, btnSize + pad * 2, 15 + pad,
        );
      }
    };

    // Background
    const bg = this.add.graphics();
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 0.85);
      bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 15);
    };
    drawBg(false);

    // Gear icon — drawn with Graphics API
    const gear = this.add.graphics();
    this.drawGearIcon(gear, 0, 0, 42);

    container.add([glowGfx, bg, gear]);
    container.setAlpha(0.35);

    // Hit area — slightly oversized for easy tapping
    const hitSize = btnSize + 20;
    const hit = this.add.rectangle(cx, cy, hitSize, hitSize, 0xffffff, 0)
      .setDepth(DEPTH.HUD).setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => { container.setAlpha(1); drawGlow(true); drawBg(true); });
    hit.on('pointerout',  () => { container.setAlpha(0.35); drawGlow(false); drawBg(false); });
    hit.on('pointerdown', () => {
      // Click flash
      bg.clear();
      bg.fillStyle(COLORS.BTN_HOVER, 1);
      bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 15);
      this.tweens.add({
        targets: container,
        scaleX: 1.07, scaleY: 1.07,
        duration: 55, ease: 'Quad.easeOut', yoyo: true,
        onComplete: () => { drawBg(false); drawGlow(false); this.triggerPause(); },
      });
    });
  }

  private drawGearIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    const teeth     = 8;
    const outerR    = r;
    const innerR    = r * 0.72;
    const toothW    = Math.PI * 2 / teeth * 0.35; // angular half-width of each tooth

    // Gear body — alternating arcs of inner/outer radius
    g.fillStyle(0xffffff, 0.95);
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (Math.PI * 2 / teeth) * i;

      // Outer tooth edge
      g.lineTo(cx + Math.cos(a - toothW) * outerR, cy + Math.sin(a - toothW) * outerR);
      g.lineTo(cx + Math.cos(a + toothW) * outerR, cy + Math.sin(a + toothW) * outerR);

      // Inner valley
      const mid = a + Math.PI / teeth;
      g.lineTo(cx + Math.cos(mid - toothW) * innerR, cy + Math.sin(mid - toothW) * innerR);
      g.lineTo(cx + Math.cos(mid + toothW) * innerR, cy + Math.sin(mid + toothW) * innerR);
    }
    g.closePath();
    g.fillPath();

    // Outline
    g.lineStyle(2, 0xffffff, 0.4);
    g.strokePath();

    // Centre hole
    g.fillStyle(COLORS.BTN, 1);
    g.fillCircle(cx, cy, r * 0.3);

    // Inner ring highlight
    g.lineStyle(2, 0xffffff, 0.3);
    g.strokeCircle(cx, cy, r * 0.48);
  }

  // ---------------------------------------------------------------------------
  // Brief "+50" pop-up when a gate is scored
  // ---------------------------------------------------------------------------
  private showGateBonus(): void {
    const pop = this.add.text(this.player.x, PLAYER_SCREEN_Y - 60, `+${GATE_PASS_BONUS}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '33px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_BONUS,
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  pop,
      y:        pop.y - 54,
      alpha:    0,
      duration: 700,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Jump mode helpers
  // ---------------------------------------------------------------------------
  private buildFinishLine(): void {
    const sqSize = 48;
    const cols   = Math.ceil(WORLD_WIDTH / sqSize);
    const rows   = FINISH_LINE_H / sqSize; // = 2

    this.finishLineGfx = this.add.graphics().setDepth(DEPTH.GROUND);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const black = (row + col) % 2 === 0;
        this.finishLineGfx.fillStyle(black ? 0x000000 : 0xffffff, 1);
        this.finishLineGfx.fillRect(col * sqSize, row * sqSize, sqSize, sqSize);
      }
    }
    this.finishLineGfx.setY(GAME_HEIGHT + 200); // off-screen initially
  }

  // ---------------------------------------------------------------------------
  // Jump score tier progression: white → silver → gold (pulse) → rainbow (dance)
  // ---------------------------------------------------------------------------
  private checkSlalomTier(finishTimeMs: number): void {
    const txt = this.timerText;
    if (this.jumpScoreTier !== 'wr' && this.jumpWorldRecord > 0 && finishTimeMs < this.jumpWorldRecord) {
      this.jumpScoreTier = 'wr';
      this.upgradeToWorldRecord(txt);
      this.showTierBadge('WR', '#ff4444', true);
    } else if (this.jumpScoreTier !== 'wr' && this.jumpScoreTier !== 'best' && this.jumpPersonalBest > 0 && finishTimeMs < this.jumpPersonalBest) {
      this.jumpScoreTier = 'best';
      this.upgradeToPersonalBest(txt);
      this.showTierBadge('PB', COLORS.POPUP_GOLD);
    } else if (this.jumpScoreTier === 'normal' && this.jumpDailyBest > 0 && finishTimeMs < this.jumpDailyBest) {
      this.jumpScoreTier = 'daily';
      txt.setColor('#88ee88');
      this.showTierBadge('DB', '#88ee88');
    }
  }

  private checkScoreTier(value: number, txt: Phaser.GameObjects.Text): void {
    if (this.jumpScoreTier !== 'wr' && value > this.jumpWorldRecord) {
      this.jumpScoreTier = 'wr';
      this.upgradeToWorldRecord(txt);
      this.showTierBadge('WR', '#ff4444', true);
    } else if (this.jumpScoreTier !== 'wr' && this.jumpScoreTier !== 'best' && value > this.jumpPersonalBest) {
      this.jumpScoreTier = 'best';
      this.upgradeToPersonalBest(txt);
      this.showTierBadge('PB', COLORS.POPUP_GOLD);
    } else if (this.jumpScoreTier === 'normal' && value > this.jumpDailyBest) {
      this.jumpScoreTier = 'daily';
      txt.setColor('#88ee88');
      this.showTierBadge('DB', '#88ee88');
    }
  }

  private showTierBadge(label: string, color: string, rainbow = false): void {
    this.tierBadge?.destroy();

    const txt = this.getActiveHudText();
    const badgeY = txt.y + 8;

    this.tierBadge = this.add.text(0, badgeY, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '54px',
      fontStyle:  'bold',
      color,
      stroke:        '#000000',
      strokeThickness: 7,
      shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 3, fill: true },
    }).setOrigin(0, 0).setDepth(DEPTH.HUD);

    this.repositionTierBadge();

    // Pop-in animation
    this.tierBadge.setScale(0);
    this.tweens.add({
      targets:  this.tierBadge,
      scaleX:   1,
      scaleY:   1,
      duration: 300,
      ease:     'Back.easeOut',
    });

    if (rainbow) {
      const RAINBOW = ['#ff4444', '#ff8c00', '#ffee00', '#44ff88', '#44aaff', '#aa44ff', '#ff44cc'];
      let ri = 0;
      const badge = this.tierBadge;
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
  }

  private repositionTierBadge(): void {
    if (!this.tierBadge) return;
    const txt = this.getActiveHudText();
    this.tierBadge.x = txt.x + txt.displayWidth / 2 + 16;
  }

  private upgradeToPersonalBest(txt: Phaser.GameObjects.Text): void {
    txt.setColor(COLORS.POPUP_GOLD);
    this.tweens.add({
      targets:  txt,
      scaleX:   1.12,
      scaleY:   1.12,
      duration: 700,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  private upgradeToWorldRecord(txt: Phaser.GameObjects.Text): void {
    // Stop any existing tweens on this text
    this.tweens.killTweensOf(txt);
    txt.setScale(1);

    // Scale pulse (bigger than personal best)
    this.tweens.add({
      targets:  txt,
      scaleX:   1.15,
      scaleY:   1.15,
      duration: 380,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Gentle rotation rock
    const rockTween = this.tweens.add({
      targets:  txt,
      angle:    { from: -6, to: 6 },
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Occasional 720 spin
    const scheduleSpin = (): void => {
      this.wrSpinTimer = this.time.delayedCall(Phaser.Math.Between(2500, 5000), () => {
        if (!txt.active) return;
        rockTween.pause();
        txt.setAngle(0);
        this.tweens.add({
          targets:    txt,
          angle:      720,
          duration:   480,
          ease:       'Quad.easeInOut',
          onComplete: () => {
            txt.setAngle(0);
            rockTween.restart();
            scheduleSpin();
          },
        });
      });
    };
    scheduleSpin();

    // Rainbow color cycling
    const RAINBOW = ['#ff4444', '#ff8c00', '#ffee00', '#44ff88', '#44aaff', '#aa44ff', '#ff44cc'];
    let ri = 0;
    this.wrRainbowTimer?.destroy();
    this.wrRainbowTimer = this.time.addEvent({
      delay:    70,
      loop:     true,
      callback: () => {
        if (!txt.active) return;
        txt.setColor(RAINBOW[ri % RAINBOW.length]!);
        ri++;
      },
    });
  }

  private showCourseAnnouncement(): void {
    const mode = this.session.mode;
    const cfg  = GAME_MODE_CONFIGS[mode];
    const best = HighScoreManager.getBest(mode);
    const seed = getDailySeed();

    let bestStr: string;
    switch (mode) {
      case GameMode.FreeSki: bestStr = best ? `${best.distance.toLocaleString()} m` : '–'; break;
      case GameMode.Slalom:  bestStr = (best && best.timeMs !== undefined) ? formatRaceTime(best.timeMs) : '–'; break;
      case GameMode.Jump:    bestStr = best ? `${best.score}` : '–'; break;
    }

    const dailyBest = HighScoreManager.getDailyBest(mode);
    let dailyStr: string;
    switch (mode) {
      case GameMode.FreeSki: dailyStr = dailyBest ? `${dailyBest.distance.toLocaleString()} m` : '–'; break;
      case GameMode.Slalom:  dailyStr = (dailyBest && dailyBest.timeMs !== undefined) ? formatRaceTime(dailyBest.timeMs) : '–'; break;
      case GameMode.Jump:    dailyStr = dailyBest ? `${dailyBest.score}` : '–'; break;
    }

    const DB_COLOR = '#88ee88';
    const PB_COLOR = COLORS.POPUP_GOLD;
    const WR_COLOR = '#ff4444';

    const lines = [
      { text: `course: ${cfg.displayName}`,                                    size: '70px', fontStyle: 'bold',   underline: true,  color: COLORS.ANNOUNCEMENT, stroke: false },
      { text: `daily best: ${dailyStr}`,                                        size: '55px', fontStyle: 'normal', underline: false, color: DB_COLOR,             stroke: true  },
      { text: `personal best: ${bestStr}`,                                      size: '55px', fontStyle: 'normal', underline: false, color: PB_COLOR,             stroke: true  },
      { text: `world record: ...`,                                              size: '55px', fontStyle: 'normal', underline: false, color: WR_COLOR,             stroke: true  },
      { text: `seed: ${seed} (resets in ${formatTimeUntilMidnightUTC()})`,      size: '55px', fontStyle: 'normal', underline: false, color: COLORS.ANNOUNCEMENT, stroke: false },
    ];
    // lineH matches the marking-line spacing exactly so each text line stays
    // centred in one gap as the world scrolls.
    const lineH = 96;

    // announcementWorldY % 96 must equal 48 so the first line's centre lands
    // in the middle of a gap (gaps are centred at n*96 + 48 in world space).
    this.announcementWorldY = 912;
    const initScreenY = PLAYER_SCREEN_Y + this.announcementWorldY;

    this.announcementContainer = this.add.container(WORLD_WIDTH / 2, initScreenY).setDepth(DEPTH.GROUND).setAlpha(0.8);

    const textObjects: Phaser.GameObjects.Text[] = [];
    lines.forEach(({ text, size, fontStyle, underline, color, stroke }, i) => {
      const t = this.add.text(0, i * lineH, text, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   size,
        fontStyle,
        color,
        ...(stroke && { stroke: '#000000', strokeThickness: 14 }),
      }).setOrigin(0.5, 0.5);
      this.announcementContainer!.add(t);
      textObjects.push(t);

      if (underline) {
        const g = this.add.graphics();
        g.lineStyle(3, 0x222222, 1);  // matches COLORS.ANNOUNCEMENT
        g.beginPath();
        g.moveTo(-t.width / 2, i * lineH + t.height / 2 + 3);
        g.lineTo( t.width / 2, i * lineH + t.height / 2 + 3);
        g.strokePath();
        this.announcementContainer!.add(g);
      }
    });

    // Fill in world record asynchronously
    const wrText = textObjects[3]!;
    fetchTopScore(mode)
      .then(wr => {
        if (!wrText.active) return;
        if (wr === null) {
          wrText.setText('world record: –');
        } else {
          let wrStr: string;
          switch (mode) {
            case GameMode.FreeSki: wrStr = `${wr.toLocaleString()} m`; break;
            case GameMode.Slalom:  wrStr = formatRaceTime(wr); break;
            case GameMode.Jump:    wrStr = `${wr}`; break;
          }
          wrText.setText(`world record: ${wrStr}`);
        }
      })
      .catch(() => {
        if (wrText.active) wrText.setText('world record: –');
      });
  }

  private showJumpBonus(x: number, y: number): void {
    const pop = this.add.text(x, y, '+1', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '68px',
      fontStyle:  'bold',
      color:      COLORS.HUD_VALUE,
      stroke:     '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  pop,
      y:        y - 90,
      alpha:    0,
      duration: 900,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    });
  }

  private showTreeFlyoverBonus(x: number, y: number): void {
    const pop = this.add.text(x, y, '+1', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '68px',
      fontStyle:  'bold',
      color:      '#66bb6a',
      stroke:     '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  pop,
      y:        y - 90,
      alpha:    0,
      duration: 900,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    });
  }


  private triggerJumpCourseFinish(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    const msg = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'COURSE\nCOMPLETE', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '220px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 10,
      align:      'center',
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  msg,
      alpha:    0,
      duration: 600,
      delay:    800,
      onComplete: () => {
        msg.destroy();
        this.gotoGameOver(false, undefined, true);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  private triggerPause(): void {
    if (!this.gameActive) return;
    this.scene.pause();
    this.scene.launch(SceneKey.Pause, { callerKey: SceneKey.Game, session: this.session });
  }

  private bindPauseKey(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.triggerPause());
    this.input.keyboard?.on('keydown-P',   () => this.triggerPause());
    this.input.on('pointerdown', () => { this.pointerIsDown = true; });
    this.input.on('pointerup',   this.onWindowPointerUp);
    window.addEventListener('pointerup', this.onWindowPointerUp);

    if (DEBUG.cycleTiers) {
      this.input.keyboard?.on('keydown-T', () => this.debugCycleTier());
    }
  }

  private getActiveHudText(): Phaser.GameObjects.Text {
    switch (this.session.mode) {
      case GameMode.Slalom: return this.timerText;
      case GameMode.Jump:   return this.jumpScoreText;
      default:              return this.distanceText;
    }
  }

  private debugCycleTier(): void {
    const order: Array<'normal' | 'daily' | 'best' | 'wr'> = ['normal', 'daily', 'best', 'wr'];
    const idx  = order.indexOf(this.jumpScoreTier);
    const next = order[(idx + 1) % order.length]!;
    this.jumpScoreTier = next;

    const txt = this.getActiveHudText();
    this.tweens.killTweensOf(txt);
    txt.setScale(1).setAngle(0);
    this.wrRainbowTimer?.destroy();
    this.wrRainbowTimer = undefined;
    this.wrSpinTimer?.destroy();
    this.wrSpinTimer = undefined;

    this.tierBadge?.destroy();
    this.tierBadge = undefined;

    switch (next) {
      case 'normal':
        txt.setColor('#c0c0c0');
        break;
      case 'daily':
        txt.setColor('#88ee88');
        this.showTierBadge('DB', '#88ee88');
        break;
      case 'best':
        this.upgradeToPersonalBest(txt);
        this.showTierBadge('PB', COLORS.POPUP_GOLD);
        break;
      case 'wr':
        this.upgradeToWorldRecord(txt);
        this.showTierBadge('WR', '#ff4444', true);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Scene transition
  // ---------------------------------------------------------------------------
  private gotoGameOver(caughtByYeti: boolean, finishTimeMs?: number, courseComplete = false): void {
    const isJump     = this.session.mode === GameMode.Jump;
    const airBonus   = Math.floor(this.totalAirTimeMs / AIR_TIME_DIVISOR);
    const finalScore = isJump
      ? this.jumpScore
      : finishTimeMs !== undefined
        ? finishTimeMs
        : Math.floor(this.distancePx / PX_PER_METER) + this.bonusScore + airBonus;

    const isSlalom = this.session.mode === GameMode.Slalom;

    const data: GameOverData = {
      session:      this.session,
      distancePx:   this.distancePx,
      score:        finalScore,
      caughtByYeti,
      courseComplete,
      yetisEvaded:  this.yetiSystem.evadeCount,
      ...(finishTimeMs !== undefined && {
        finishTimeMs,
        penaltyMs:   this.penaltyMs,
        gatesPassed: this.gatesPassed,
        gatesMissed: this.gatesCompleted - this.gatesPassed,
      }),
      ...(isSlalom && finishTimeMs === undefined && {
        elapsedTimeMs:      this.elapsedMs,
        gatesPassed:        this.gatesPassed,
        totalGatesInCourse: this.totalGatesInCourse,
      }),
    };
    this.scene.start(SceneKey.GameOver, data);
  }

  // ---------------------------------------------------------------------------
  // Yeti warning overlay
  // ---------------------------------------------------------------------------
  private showYetiWarning(): void {
    const warn = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'THE YETI IS COMING !!', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '100px',
      fontStyle:  'bold',
      color:      COLORS.YETI_WARNING,
      stroke:     '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.POPUP);

    this.tweens.add({
      targets:  warn,
      alpha:    0,
      y:        warn.y - 45,
      duration: 2200,
      delay:    1000,
      ease:     'Power2',
      onComplete: () => warn.destroy(),
    });
  }

  shutdown(): void {
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    this.controls?.destroy();
    this.chunkManager?.destroy();
    this.yetiSystem?.destroy();
    this.player?.destroy();
    this.slopeGfx?.destroy();
    this.edgeShadows?.destroy();
    this.trailGfx?.destroy();
    this.finishLineGfx?.destroy();
  }
}
