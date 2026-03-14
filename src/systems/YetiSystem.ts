import Phaser from 'phaser';
import { Yeti } from '@/entities/Yeti';
import {
  GAME_HEIGHT,
  WORLD_WIDTH,
  PX_PER_METER,
  YETI_WAVE_INTERVAL_M,
  YETI_INITIAL_WAVE_SPEED,
  YETI_SPEED_PER_WAVE,
  YETI_INITIAL_SPEED_CAP,
} from '@/data/constants';

// Player hit radius for catch detection (must match Player.ts)
const PLAYER_HIT_RADIUS = 27;

// Yeti is considered evaded when its centre clears the top of the screen
const EVADE_SCREEN_TOP = -225;

export type YetiEvent = 'none' | 'spawned' | 'caught' | 'evaded';

export class YetiSystem {
  private scene:        Phaser.Scene;
  private yeti:         Yeti | null = null;
  private yetisEvaded   = 0;
  private nextSpawnM    = YETI_WAVE_INTERVAL_M;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isActive(): boolean {
    return this.yeti !== null;
  }

  get evadeCount(): number {
    return this.yetisEvaded;
  }

  // ---------------------------------------------------------------------------
  // Called every frame from GameScene.update()
  //
  // Returns:
  //   'spawned'  — yeti just appeared this frame (show warning)
  //   'caught'   — yeti caught the player this frame (trigger game over)
  //   'evaded'   — yeti passed the player and flew off screen (show +1)
  //   'none'     — nothing notable
  // ---------------------------------------------------------------------------
  update(
    distancePx:    number,
    playerX:       number,
    playerScreenY: number,
    delta:         number,
    yetiEnabled:   boolean,
    playerAirborne = false,
  ): YetiEvent {
    const distanceM = distancePx / PX_PER_METER;

    // --- Spawn next wave ---
    if (!this.yeti && yetiEnabled && distanceM >= this.nextSpawnM) {
      const initSpeed = Math.min(
        YETI_INITIAL_WAVE_SPEED + this.yetisEvaded * YETI_SPEED_PER_WAVE,
        YETI_INITIAL_SPEED_CAP,
      );
      this.spawn(playerX, playerScreenY, initSpeed);
      return 'spawned';
    }

    if (!this.yeti) return 'none';

    // --- Chase ---
    this.yeti.update(playerX, playerScreenY, delta);

    // --- Catch detection ---
    const dx   = this.yeti.screenX - playerX;
    const dy   = this.yeti.screenY - playerScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!playerAirborne && dist < PLAYER_HIT_RADIUS + this.yeti.hitRadius) {
      return 'caught';
    }

    // --- Evasion: yeti scrolled off the top of the screen ---
    if (this.yeti.screenY < EVADE_SCREEN_TOP) {
      this.yeti.destroy();
      this.yeti = null;
      this.yetisEvaded++;
      this.nextSpawnM += YETI_WAVE_INTERVAL_M;
      return 'evaded';
    }

    return 'none';
  }

  /** Debug-only: spawn the yeti immediately regardless of distance. */
  forceSpawn(playerX: number, playerScreenY: number): void {
    if (this.yeti) return;
    this.spawn(playerX, playerScreenY, YETI_INITIAL_WAVE_SPEED);
  }

  destroy(): void {
    this.yeti?.destroy();
    this.yeti    = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private spawn(playerX: number, _playerScreenY: number, initialSpeed: number): void {
    const startX = Phaser.Math.Clamp(playerX + Phaser.Math.Between(-180, 180), 225, WORLD_WIDTH - 225);
    const startY = GAME_HEIGHT + 202;
    this.yeti = new Yeti(this.scene, startX, startY, initialSpeed);
  }
}
