import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { addVersionLabel } from '@/ui/versionLabel';
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

  // --- Jump mode ---
  private jumpScore         = 0;
  private finishLineCrossed = false;

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
  private yetiWarning!:   Phaser.GameObjects.Text;
  private jumpScoreText!: Phaser.GameObjects.Text;

  // --- Finish line (Jump mode) ---
  private finishLineGfx?: Phaser.GameObjects.Graphics;

  // --- Course announcement (world-space) ---
  private announcementContainer: Phaser.GameObjects.Container | undefined;
  private announcementWorldY     = 0;


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
    this.jumpScore        = 0;
    this.finishLineCrossed = false;
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

    this.buildHUD();
    this.showCourseAnnouncement();
    this.bindPauseKey();
    this.events.on('resume', () => { this.justResumed = true; });
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;

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
    this.naturalSpeed = Math.min(this.naturalSpeed + SPEED_ACCEL_RATE * dt, MAX_SCROLL_SPEED);

    // --- Player update ---
    const inputState = this.controls.getState();
    const pointer    = this.input.activePointer;
    if (pointer.isDown) {
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
    const effectiveSpeed = this.naturalSpeed * speedMod;

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
    );

    if (collision.crashed) {
      this.triggerCrash();
      return;
    }

    if (collision.rampHit) {
      this.player.hitRamp();
      if (this.session.mode === GameMode.Jump) {
        this.jumpScore++;
        this.jumpScoreText.setText(`score: ${this.jumpScore}`);
        this.showJumpBonus(this.player.x, PLAYER_SCREEN_Y - 15);
      }
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
        this.showPenalty(penaltyMs);
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
      this.showYetiEvaded();
    }
    if (yetiEvent === 'spawned') {
      this.showYetiWarning();
    }
    this.yetiWarning.setVisible(this.yetiSystem.isActive);

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
    this.distanceText.setText(`${Math.floor(this.distancePx / PX_PER_METER).toLocaleString()} m`);
    if (this.session.mode === GameMode.Slalom && this.totalGatesInCourse > 0) {
      this.elapsedMs = Math.round(_time - this.courseStartTimeMs) + this.penaltyMs;
      this.timerText.setText(formatRaceTime(this.elapsedMs));
    }

    // --- Course announcement (world-space scroll) ---
    if (this.announcementContainer) {
      const screenY = PLAYER_SCREEN_Y + (this.announcementWorldY - this.worldOffsetY);
      this.announcementContainer.setY(screenY);
      if (screenY < -240) {
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

    const msg = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'finish!', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '78px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 3,
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
    const pop = this.add.text(gateWorldX, PLAYER_SCREEN_Y - 90, '+1', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '60px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 2,
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

  private showPenalty(penaltyMs: number): void {
    const secs = penaltyMs / 1000;
    const pop  = this.add.text(WORLD_WIDTH / 2, PLAYER_SCREEN_Y - 90, `+${secs}s penalty`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '60px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_PENALTY,
      stroke:     '#000000',
      strokeThickness: 2,
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

    this.slopeGfx.lineStyle(1, COLORS.SNOW_SHADOW, 0.80);
    for (let i = 0; i < count; i++) {
      const y = i * spacing - phase;
      this.slopeGfx.beginPath();
      this.slopeGfx.moveTo(0, y);
      this.slopeGfx.lineTo(WORLD_WIDTH, y);
      this.slopeGfx.strokePath();
    }

    // Course boundary lines — scrolling dashed yellow verticals
    const mode        = this.session?.mode;
    const edgeX       = mode === GameMode.Slalom ? COURSE_EDGE_NARROW : COURSE_EDGE_WIDE;
    const boundaryXs  = [edgeX, WORLD_WIDTH - edgeX];
    const dashLen     = 42;
    const gapLen      = 21;
    const period      = dashLen + gapLen;
    const dashPhase   = offsetY % period;
    const dashCount   = Math.ceil(GAME_HEIGHT / period) + 2;

    this.slopeGfx.lineStyle(6, COLORS.BOUNDARY, 0.75);
    for (const bx of boundaryXs) {
      for (let i = 0; i < dashCount; i++) {
        const y0 = i * period - dashPhase;
        const y1 = y0 + dashLen;
        this.slopeGfx.beginPath();
        this.slopeGfx.moveTo(bx, y0);
        this.slopeGfx.lineTo(bx, y1);
        this.slopeGfx.strokePath();
      }
    }

    // Danger-zone lines — solid, at the snow/lighter-green boundary (~85% into forest depth)
    const dangerOffset = Math.round(edgeX * 0.85);
    const dangerXs     = [dangerOffset, WORLD_WIDTH - dangerOffset];

    this.slopeGfx.lineStyle(14, COLORS.HAZARD, 0.65);
    for (const dx of dangerXs) {
      this.slopeGfx.beginPath();
      this.slopeGfx.moveTo(dx, 0);
      this.slopeGfx.lineTo(dx, GAME_HEIGHT);
      this.slopeGfx.strokePath();
    }
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
    const hudBg = this.add.graphics().setDepth(DEPTH.HUD_BG);
    hudBg.fillStyle(COLORS.HUD_BG, 0.65);
    hudBg.fillRect(0, 0, WORLD_WIDTH, 150);

    const mainScoreSize = 80;

    // const modeLabel = this.session.mode.replace(/_/g, ' ');
    // this.add.text(70, 44, modeLabel, {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize:   70 + 'px',
    //   fontStyle:  '',
    //   color:      COLORS.HUD_UTILITY,
    // }).setDepth(DEPTH.HUD);

    const isFreeSki = this.session.mode === GameMode.FreeSki;
    this.distanceText = this.add.text(WORLD_WIDTH / 2, 20, '0 m', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   mainScoreSize + 'px',
      fontStyle:  'bold',
      color:      COLORS.HUD_VALUE,
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD).setVisible(isFreeSki);

    const best    = HighScoreManager.getBest(this.session.mode);
    const bestStr = (() => {
      if (!best) return '–';
      switch (this.session.mode) {
        case GameMode.FreeSki: return `${best.distance.toLocaleString()} m`;
        case GameMode.Slalom:  return best.timeMs !== undefined ? formatRaceTime(best.timeMs) : '–';
        case GameMode.Jump:    return `${best.score}`;
      }
    })();
    this.add.text(WORLD_WIDTH / 2, 95, `best: ${bestStr}`, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '45px',
      color:      COLORS.HUD_LABEL,
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD);

    const isTimeTrial = this.session.mode === GameMode.Slalom && this.totalGatesInCourse > 0;

    this.timerText = this.add.text(WORLD_WIDTH / 2, 20, '0:00.0', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   mainScoreSize + 'px',
      fontStyle:  'bold',
      color:      COLORS.HUD_VALUE,
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD).setVisible(isTimeTrial);

    const isJump = this.session.mode === GameMode.Jump;
    this.jumpScoreText = this.add.text(WORLD_WIDTH / 2, 20, 'score: 0', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   mainScoreSize + 'px',
      fontStyle:  'bold',
      color:      COLORS.HUD_VALUE,
    }).setOrigin(0.5, 0).setDepth(DEPTH.HUD).setVisible(isJump);

    this.yetiWarning = this.add.text(27, 20, '! YETI', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '24px',
      fontStyle:  'bold',
      color:      COLORS.YETI_WARNING,
    }).setDepth(DEPTH.HUD).setVisible(false);

    this.tweens.add({
      targets:  this.yetiWarning,
      alpha:    0.3,
      duration: 500,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Pause button — top-right corner, finger-friendly hit area
    const pauseBtn = this.add.text(WORLD_WIDTH - 57, 44, 'pause', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   70 + 'px',
      color:      COLORS.HUD_LABEL,
    }).setOrigin(1, 0).setDepth(DEPTH.HUD).setInteractive({ useHandCursor: true });

    // Invisible hit area larger than the glyph for easy tapping
    const pauseHit = this.add.rectangle(WORLD_WIDTH - 0, 0, 150, 150, 0xffffff, 0)
      .setOrigin(1, 0).setDepth(DEPTH.HUD).setInteractive();

    const openPause = () => this.triggerPause();
    pauseBtn.on('pointerdown', openPause);
    pauseHit.on('pointerdown', openPause);

    addVersionLabel(this, COLORS.VERSION_GAME);
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

    const lines = [
      { text: `course: ${cfg.displayName}`, size: '70px', fontStyle: 'bold',   underline: true  },
      { text: `personal best: ${bestStr}`,  size: '55px', fontStyle: 'normal', underline: false },
      { text: `seed: ${seed} (resets in ${formatTimeUntilMidnightUTC()})`, size: '55px', fontStyle: 'normal', underline: false },
    ];
    // lineH matches the marking-line spacing exactly so each text line stays
    // centred in one gap as the world scrolls.
    const lineH = 96;
    const color = COLORS.ANNOUNCEMENT;

    // announcementWorldY % 96 must equal 48 so the first line's centre lands
    // in the middle of a gap (gaps are centred at n*96 + 48 in world space).
    // 432 = 48 + 4*96, and puts all three lines on-screen at run start.
    this.announcementWorldY = 912;
    const initScreenY = PLAYER_SCREEN_Y + this.announcementWorldY;

    this.announcementContainer = this.add.container(WORLD_WIDTH / 2, initScreenY).setDepth(DEPTH.GROUND).setAlpha(0.8);

    lines.forEach(({ text, size, fontStyle, underline }, i) => {
      const t = this.add.text(0, i * lineH, text, {
        fontFamily: 'FoxwhelpFont',
        fontSize:   size,
        fontStyle,
        color,
      }).setOrigin(0.5, 0.5);
      this.announcementContainer!.add(t);

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
  }

  private showJumpBonus(x: number, y: number): void {
    const pop = this.add.text(x, y, '+1', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '42px',
      fontStyle:  'bold',
      color:      COLORS.HUD_VALUE,
      stroke:     '#000000',
      strokeThickness: 2,
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

  private showYetiEvaded(): void {
    const y = PLAYER_SCREEN_Y - 15;
    const pop = this.add.text(this.player.x, y, '+1', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '42px',
      fontStyle:  'bold',
      color:      COLORS.HUD_VALUE,
      stroke:     '#000000',
      strokeThickness: 2,
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

    const msg = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'COURSE COMPLETE', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '72px',
      fontStyle:  'bold',
      color:      COLORS.POPUP_GOLD,
      stroke:     '#000000',
      strokeThickness: 3,
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
    const warn = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2 - 105, '!! THE YETI IS COMING !!', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '100px',
      fontStyle:  'bold',
      color:      COLORS.YETI_WARNING,
      stroke:     '#000000',
      strokeThickness: 2,
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
