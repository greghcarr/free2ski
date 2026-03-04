import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import {
  WORLD_WIDTH,
  GAME_HEIGHT,
  COLORS,
  BASE_SCROLL_SPEED,
  MAX_SCROLL_SPEED,
  SPEED_ACCEL_RATE,
  PX_PER_METER,
  GATE_PASS_BONUS,
  AIR_TIME_DIVISOR,
  COURSE_EDGE_WIDE,
  COURSE_EDGE_NARROW,
} from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { PlayerState, Player } from '@/entities/Player';
import { InputSystem } from '@/systems/InputSystem';
import { ChunkManager } from '@/world/ChunkManager';
import { YetiSystem } from '@/systems/YetiSystem';
import type { GameOverData } from '@/scenes/GameOverScene';

// Screen Y where the player is positioned (upper-centre area)
const PLAYER_SCREEN_Y = Math.floor(GAME_HEIGHT * 0.36);

// Trail configuration
const TRAIL_SAMPLE_INTERVAL = 8;   // world-px between samples
const TRAIL_MAX_WORLD_PX    = 600; // how far back the trail extends
const TRAIL_TRACK_HW        = 5;   // half-distance between left and right ski grooves
const TRAIL_MAX_ALPHA       = 0.45;

interface TrailSample {
  x:      number;
  worldY: number; // worldOffsetY at time of recording
  angle:  number; // player angle (degrees) at time of recording
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
  private speedText!:     Phaser.GameObjects.Text;
  private yetiWarning!:   Phaser.GameObjects.Text;
  private gateText!:      Phaser.GameObjects.Text;

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
    this.trailSamples     = [];
    this.lastSampleWorldY = 0;
    this.prevPlayerState  = PlayerState.Skiing;
  }

  create(): void {
    this.slopeGfx    = this.add.graphics();
    this.edgeShadows = this.add.graphics();
    // Trail sits above the snow but below obstacles (depth 4) and player (depth 10)
    this.trailGfx    = this.add.graphics().setDepth(2);

    this.drawSlope(0);
    this.drawEdgeShadows();

    this.player       = new Player(this, WORLD_WIDTH / 2, PLAYER_SCREEN_Y);
    this.controls     = new InputSystem(this);
    this.chunkManager = new ChunkManager(this, this.session.seed ?? Date.now(), this.session.mode);
    this.yetiSystem   = new YetiSystem(this);

    this.buildHUD();
    this.bindPauseKey();
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;

    const dt = delta / 1000;

    // --- Natural speed ramp ---
    this.naturalSpeed = Math.min(this.naturalSpeed + SPEED_ACCEL_RATE * dt, MAX_SCROLL_SPEED);

    // --- Player update ---
    const speedMod       = this.player.update(this.controls.getState(), this.naturalSpeed, delta);
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
      this.trailSamples.unshift({ x: this.player.x, worldY: this.worldOffsetY, angle: this.player.angle });

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
    }

    if (collision.gatePassed) {
      this.gatesPassed++;
      this.bonusScore += GATE_PASS_BONUS;
      this.showGateBonus();
    }

    if (collision.gateMissed) {
      if (this.session.mode === GameMode.Slalom) {
        this.triggerGateMiss();
        return;
      }
    }

    // --- Yeti ---
    const modeCfg   = GAME_MODE_CONFIGS[this.session.mode];
    const yetiEvent = this.yetiSystem.update(
      this.distancePx, this.player.x, this.player.screenY, delta,
      modeCfg.yetiEnabled, modeCfg.yetiSpawnDistance,
    );
    if (yetiEvent === 'caught') {
      this.triggerCaughtByYeti();
      return;
    }
    if (yetiEvent === 'spawned') {
      this.showYetiWarning();
    }
    this.yetiWarning.setVisible(this.yetiSystem.isActive);

    // --- Redraw slope + trail ---
    this.drawSlope(this.worldOffsetY);
    this.drawTrail();

    // --- HUD ---
    this.distanceText.setText(`${Math.floor(this.distancePx / PX_PER_METER)} m`);
    this.speedText.setText(`${Math.floor(effectiveSpeed / 10)} km/h`);
    if (this.gateText.visible) {
      this.gateText.setText(`Gates: ${this.gatesPassed}`);
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

  private triggerGateMiss(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    const warn = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'MISSED GATE!', {
      fontFamily: 'sans-serif',
      fontSize: '38px',
      fontStyle: 'bold',
      color: '#ff2222',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: warn,
      alpha: 0,
      duration: 600,
      delay: 500,
      onComplete: () => {
        warn.destroy();
        this.gotoGameOver(false);
      },
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

      this.trailGfx.lineStyle(1.5, 0x7aaabf, alpha);

      // Left groove
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(curr.x - px, currScreenY - py);
      this.trailGfx.lineTo(next.x - px, nextScreenY - py);
      this.trailGfx.strokePath();

      // Right groove
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
    const spacing = 64;
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
    const edgeX       = (mode === GameMode.Slalom || mode === GameMode.TreeSlalom)
      ? COURSE_EDGE_NARROW
      : COURSE_EDGE_WIDE;
    const boundaryXs  = [edgeX, WORLD_WIDTH - edgeX];
    const dashLen     = 28;
    const gapLen      = 14;
    const period      = dashLen + gapLen;
    const dashPhase   = offsetY % period;
    const dashCount   = Math.ceil(GAME_HEIGHT / period) + 2;

    this.slopeGfx.lineStyle(2, 0xffdd00, 0.55);
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

    this.slopeGfx.lineStyle(9, 0xff2200, 0.65);
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
    this.edgeShadows.fillRect(0, 0, 100, GAME_HEIGHT);
    this.edgeShadows.fillRect(WORLD_WIDTH - 100, 0, 100, GAME_HEIGHT);
    this.edgeShadows.fillStyle(COLORS.TREE_DARK, 0.25);
    this.edgeShadows.fillRect(0, 0, 12, GAME_HEIGHT);
    this.edgeShadows.fillRect(WORLD_WIDTH - 12, 0, 12, GAME_HEIGHT);
    this.edgeShadows.setDepth(1);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  private buildHUD(): void {
    const hudBg = this.add.graphics().setDepth(20);
    hudBg.fillStyle(COLORS.HUD_BG, 0.65);
    hudBg.fillRect(0, 0, WORLD_WIDTH, 46);

    const modeLabel = this.session.mode.replace(/_/g, ' ').toUpperCase();
    this.add.text(18, 13, modeLabel, {
      fontFamily: 'sans-serif',
      fontSize:   '17px',
      fontStyle:  'bold',
      color:      '#aaaacc',
    }).setDepth(21);

    this.distanceText = this.add.text(WORLD_WIDTH - 18, 13, '0 m', {
      fontFamily: 'sans-serif',
      fontSize:   '18px',
      fontStyle:  'bold',
      color:      '#ffffff',
    }).setOrigin(1, 0).setDepth(21);

    this.speedText = this.add.text(WORLD_WIDTH / 2, 13, '0 km/h', {
      fontFamily: 'sans-serif',
      fontSize:   '17px',
      color:      '#ccddff',
    }).setOrigin(0.5, 0).setDepth(21);

    this.add.text(WORLD_WIDTH / 2 + 130, 13, '  ESC: pause', {
      fontFamily: 'sans-serif',
      fontSize:   '13px',
      color:      '#666688',
    }).setOrigin(0, 0).setDepth(21);

    const showGates = this.session.mode === GameMode.Slalom ||
                      this.session.mode === GameMode.TreeSlalom;
    this.gateText = this.add.text(WORLD_WIDTH / 2 - 60, 13, 'Gates: 0', {
      fontFamily: 'sans-serif',
      fontSize:   '17px',
      fontStyle:  'bold',
      color:      '#ffdd88',
    }).setDepth(21).setVisible(showGates);

    this.yetiWarning = this.add.text(18, 13, '⚠ YETI', {
      fontFamily: 'sans-serif',
      fontSize:   '16px',
      fontStyle:  'bold',
      color:      '#c8ddf0',
    }).setDepth(21).setVisible(false);

    this.tweens.add({
      targets:  this.yetiWarning,
      alpha:    0.3,
      duration: 500,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Brief "+50" pop-up when a gate is scored
  // ---------------------------------------------------------------------------
  private showGateBonus(): void {
    const pop = this.add.text(this.player.x, PLAYER_SCREEN_Y - 40, `+${GATE_PASS_BONUS}`, {
      fontFamily: 'sans-serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#ffdd44',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets:  pop,
      y:        pop.y - 36,
      alpha:    0,
      duration: 700,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  private bindPauseKey(): void {
    this.input.keyboard?.on('keydown-ESC', () => {  // Phaser's Scene.input.keyboard
      if (!this.gameActive) return;
      this.scene.pause();
      this.scene.launch(SceneKey.Pause, { callerKey: SceneKey.Game });
    });
  }

  // ---------------------------------------------------------------------------
  // Scene transition
  // ---------------------------------------------------------------------------
  private gotoGameOver(caughtByYeti: boolean): void {
    const airBonus   = Math.floor(this.totalAirTimeMs / AIR_TIME_DIVISOR);
    const finalScore = Math.floor(this.distancePx / PX_PER_METER) + this.bonusScore + airBonus;

    const data: GameOverData = {
      session:      this.session,
      distancePx:   this.distancePx,
      score:        finalScore,
      caughtByYeti,
    };
    this.scene.start(SceneKey.GameOver, data);
  }

  // ---------------------------------------------------------------------------
  // Yeti warning overlay
  // ---------------------------------------------------------------------------
  private showYetiWarning(): void {
    const warn = this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT / 2 - 70, '⚠  THE YETI IS COMING  ⚠', {
      fontFamily: 'sans-serif',
      fontSize:   '30px',
      fontStyle:  'bold',
      color:      '#c8ddf0',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets:  warn,
      alpha:    0,
      y:        warn.y - 30,
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
  }
}
