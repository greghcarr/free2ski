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
} from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';
import { Player } from '@/entities/Player';
import { InputSystem } from '@/systems/InputSystem';
import { ChunkManager } from '@/world/ChunkManager';
import type { GameOverData } from '@/scenes/GameOverScene';

// Screen Y where the player is positioned (upper-centre area)
const PLAYER_SCREEN_Y = Math.floor(GAME_HEIGHT * 0.36);

export class GameScene extends Phaser.Scene {
  // --- State ---
  private naturalSpeed = BASE_SCROLL_SPEED;  // raw difficulty speed, always rising
  private worldOffsetY = 0;                  // total px scrolled (for chunk seeding)
  private distancePx   = 0;                  // px travelled (→ meters for display)
  private gameActive   = false;

  // --- Entities ---
  private player!:       Player;
  private controls!:     InputSystem;
  private chunkManager!: ChunkManager;

  // --- Visuals ---
  private slopeGfx!:   Phaser.GameObjects.Graphics;
  private edgeShadows!: Phaser.GameObjects.Graphics;

  // --- HUD ---
  private distanceText!: Phaser.GameObjects.Text;
  private speedText!:    Phaser.GameObjects.Text;

  // --- Session ---
  private session!: SessionConfig;

  constructor() {
    super({ key: SceneKey.Game });
  }

  init(data: { session?: SessionConfig }): void {
    this.session      = data.session ?? { mode: GameMode.FreeSki, seed: Date.now() };
    this.naturalSpeed = BASE_SCROLL_SPEED;
    this.worldOffsetY = 0;
    this.distancePx   = 0;
    this.gameActive   = true;
  }

  create(): void {
    // Layer order: slope → edge shadows → player (depth 10) → HUD (depth 20)
    this.slopeGfx    = this.add.graphics();
    this.edgeShadows = this.add.graphics();

    this.drawSlope(0);
    this.drawEdgeShadows();

    // Player starts horizontally centred
    this.player       = new Player(this, WORLD_WIDTH / 2, PLAYER_SCREEN_Y);
    this.controls     = new InputSystem(this);
    this.chunkManager = new ChunkManager(this, this.session.seed ?? Date.now());

    this.buildHUD();
    this.bindPauseKey();
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;

    const dt = delta / 1000;

    // --- Natural speed ramp (always increases regardless of steering) ---
    this.naturalSpeed = Math.min(this.naturalSpeed + SPEED_ACCEL_RATE * dt, MAX_SCROLL_SPEED);

    // --- Player update; returns a speed modifier based on angle / keys ---
    const speedMod      = this.player.update(this.controls.getState(), this.naturalSpeed, delta);
    const effectiveSpeed = this.naturalSpeed * speedMod;

    // --- Advance world ---
    this.worldOffsetY += effectiveSpeed * dt;
    this.distancePx   += effectiveSpeed * dt;

    // --- Update chunks + collision detection ---
    const crashed = this.chunkManager.update(this.worldOffsetY, this.player.x, this.player.screenY);
    if (crashed) {
      this.triggerCrash();
      return;
    }

    // --- Redraw scrolling slope ---
    this.drawSlope(this.worldOffsetY);

    // --- HUD ---
    this.distanceText.setText(`${Math.floor(this.distancePx / PX_PER_METER)} m`);
    this.speedText.setText(`${Math.floor(effectiveSpeed / 10)} km/h`);
  }

  // ---------------------------------------------------------------------------
  // Called by obstacle system (Phase 3) when player hits something
  // ---------------------------------------------------------------------------
  triggerCrash(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    this.player.crash(() => {
      this.time.delayedCall(300, () => this.gotoGameOver(false));
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

    // Snow base
    this.slopeGfx.fillStyle(COLORS.SNOW_LIGHT, 1);
    this.slopeGfx.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Subtle horizontal compression lines scrolling downward
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

    // Ski tracks following the player's path — two parallel lines
    this.drawSkiTracks(offsetY);
  }

  private drawSkiTracks(offsetY: number): void {
    const cx      = this.player?.x ?? WORLD_WIDTH / 2;
    const trackW  = 10;    // gap between the two parallel tracks
    const opacity = 0.22;

    this.slopeGfx.lineStyle(2, COLORS.SLOPE_TRACK, opacity);

    // Left track
    this.slopeGfx.beginPath();
    this.slopeGfx.moveTo(cx - trackW / 2, 0);
    this.slopeGfx.lineTo(cx - trackW / 2, GAME_HEIGHT);
    this.slopeGfx.strokePath();

    // Right track
    this.slopeGfx.beginPath();
    this.slopeGfx.moveTo(cx + trackW / 2, 0);
    this.slopeGfx.lineTo(cx + trackW / 2, GAME_HEIGHT);
    this.slopeGfx.strokePath();
  }

  private drawEdgeShadows(): void {
    // Static gradient-like edge darkening — trees/forest on sides
    this.edgeShadows.clear();
    this.edgeShadows.fillStyle(COLORS.TREE_DARK, 0.12);
    this.edgeShadows.fillRect(0, 0, 100, GAME_HEIGHT);
    this.edgeShadows.fillRect(WORLD_WIDTH - 100, 0, 100, GAME_HEIGHT);

    // Thin tree-line stripe at each edge
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
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#aaaacc',
    }).setDepth(21);

    this.distanceText = this.add.text(WORLD_WIDTH - 18, 13, '0 m', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(1, 0).setDepth(21);

    this.speedText = this.add.text(WORLD_WIDTH / 2, 13, '0 km/h', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#ccddff',
    }).setOrigin(0.5, 0).setDepth(21);

    this.add.text(WORLD_WIDTH / 2 + 130, 13, '  ESC: pause', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#666688',
    }).setOrigin(0, 0).setDepth(21);
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
    const data: GameOverData = {
      session:      this.session,
      distancePx:   this.distancePx,
      score:        Math.floor(this.distancePx / PX_PER_METER),
      caughtByYeti,
    };
    this.scene.start(SceneKey.GameOver, data);
  }

  shutdown(): void {
    this.controls?.destroy();
    this.chunkManager?.destroy();
    this.player?.destroy();
  }
}
