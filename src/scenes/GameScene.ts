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

export class GameScene extends Phaser.Scene {
  // --- State ---
  private naturalSpeed  = BASE_SCROLL_SPEED;
  private worldOffsetY  = 0;
  private distancePx    = 0;
  private gameActive    = false;

  // --- Bonus scoring ---
  private gatesPassed      = 0;
  private bonusScore        = 0;
  private totalAirTimeMs    = 0;

  // --- Entities ---
  private player!:       Player;
  private controls!:     InputSystem;
  private chunkManager!: ChunkManager;
  private yetiSystem!:   YetiSystem;

  // --- Visuals ---
  private slopeGfx!:    Phaser.GameObjects.Graphics;
  private edgeShadows!: Phaser.GameObjects.Graphics;

  // --- HUD ---
  private distanceText!:  Phaser.GameObjects.Text;
  private speedText!:     Phaser.GameObjects.Text;
  private yetiWarning!:   Phaser.GameObjects.Text;
  private gateText!:      Phaser.GameObjects.Text;   // Slalom / TreeSlalom only

  // --- Session ---
  private session!: SessionConfig;

  constructor() {
    super({ key: SceneKey.Game });
  }

  init(data: { session?: SessionConfig }): void {
    this.session         = data.session ?? { mode: GameMode.FreeSki, seed: Date.now() };
    this.naturalSpeed    = BASE_SCROLL_SPEED;
    this.worldOffsetY    = 0;
    this.distancePx      = 0;
    this.gameActive      = true;
    this.gatesPassed     = 0;
    this.bonusScore      = 0;
    this.totalAirTimeMs  = 0;
  }

  create(): void {
    this.slopeGfx    = this.add.graphics();
    this.edgeShadows = this.add.graphics();

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
      // Slalom mode: missing a gate ends the run
      if (this.session.mode === GameMode.Slalom) {
        this.triggerGateMiss();
        return;
      }
      // Other modes: no penalty
    }

    // --- Yeti ---
    const yetiEnabled = GAME_MODE_CONFIGS[this.session.mode].yetiEnabled;
    const yetiEvent   = this.yetiSystem.update(
      this.distancePx, this.player.x, this.player.screenY, delta, yetiEnabled,
    );
    if (yetiEvent === 'caught') {
      this.triggerCaughtByYeti();
      return;
    }
    if (yetiEvent === 'spawned') {
      this.showYetiWarning();
    }
    this.yetiWarning.setVisible(this.yetiSystem.isActive);

    // --- Redraw slope ---
    this.drawSlope(this.worldOffsetY);

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

    // Flash red "MISSED GATE" text then end run
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
  // Visual helpers
  // ---------------------------------------------------------------------------
  private drawSlope(offsetY: number): void {
    this.slopeGfx.clear();

    this.slopeGfx.fillStyle(COLORS.SNOW_LIGHT, 1);
    this.slopeGfx.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    const spacing = 64;
    const count   = Math.ceil(GAME_HEIGHT / spacing) + 2;
    const phase   = offsetY % spacing;

    this.slopeGfx.lineStyle(1, COLORS.SLOPE_TRACK, 0.35);
    for (let i = 0; i < count; i++) {
      const y = i * spacing - phase;
      this.slopeGfx.beginPath();
      this.slopeGfx.moveTo(0, y);
      this.slopeGfx.lineTo(WORLD_WIDTH, y);
      this.slopeGfx.strokePath();
    }

    this.drawSkiTracks(offsetY);
  }

  private drawSkiTracks(_offsetY: number): void {
    const cx     = this.player?.x ?? WORLD_WIDTH / 2;
    const trackW = 10;

    this.slopeGfx.lineStyle(2, COLORS.SLOPE_TRACK, 0.22);

    this.slopeGfx.beginPath();
    this.slopeGfx.moveTo(cx - trackW / 2, 0);
    this.slopeGfx.lineTo(cx - trackW / 2, GAME_HEIGHT);
    this.slopeGfx.strokePath();

    this.slopeGfx.beginPath();
    this.slopeGfx.moveTo(cx + trackW / 2, 0);
    this.slopeGfx.lineTo(cx + trackW / 2, GAME_HEIGHT);
    this.slopeGfx.strokePath();
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

    // Gate counter — visible in Slalom / TreeSlalom
    const showGates = this.session.mode === GameMode.Slalom ||
                      this.session.mode === GameMode.TreeSlalom;
    this.gateText = this.add.text(WORLD_WIDTH / 2 - 60, 13, 'Gates: 0', {
      fontFamily: 'sans-serif',
      fontSize:   '17px',
      fontStyle:  'bold',
      color:      '#ffdd88',
    }).setDepth(21).setVisible(showGates);

    // Yeti warning indicator
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
    const x   = this.player.x;
    const pop = this.add.text(x, PLAYER_SCREEN_Y - 40, `+${GATE_PASS_BONUS}`, {
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
    // Final score = distance metres + bonus from gates + bonus from air time
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
  }
}
