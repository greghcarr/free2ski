import Phaser from 'phaser';
import { Yeti } from '@/entities/Yeti';
import { YETI_SPAWN_DISTANCE, YETI_CATCH_DISTANCE, GAME_HEIGHT, WORLD_WIDTH, PX_PER_METER } from '@/data/constants';

// Player hit radius for catch detection (must match Player.ts)
const PLAYER_HIT_RADIUS = 12;

export type YetiEvent = 'none' | 'spawned' | 'caught';

export class YetiSystem {
  private scene:   Phaser.Scene;
  private yeti:    Yeti | null = null;
  private spawned: boolean     = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isActive(): boolean {
    return this.spawned;
  }

  // ---------------------------------------------------------------------------
  // Called every frame from GameScene.update()
  //
  // Returns:
  //   'spawned'  — yeti just appeared this frame (show warning)
  //   'caught'   — yeti caught the player this frame (trigger game over)
  //   'none'     — nothing notable
  // ---------------------------------------------------------------------------
  update(
    distancePx:    number,
    playerX:       number,
    playerScreenY: number,
    delta:         number,
    yetiEnabled:   boolean,
  ): YetiEvent {
    const distanceM = distancePx / PX_PER_METER;

    // --- Spawn ---
    if (!this.spawned && yetiEnabled && distanceM >= YETI_SPAWN_DISTANCE) {
      this.spawn(playerX, playerScreenY);
      return 'spawned';
    }

    if (!this.yeti) return 'none';

    // --- Chase ---
    this.yeti.update(playerX, playerScreenY, delta);

    // --- Catch detection ---
    const dx   = this.yeti.screenX - playerX;
    const dy   = this.yeti.screenY - playerScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PLAYER_HIT_RADIUS + this.yeti.hitRadius) {
      return 'caught';
    }

    return 'none';
  }

  destroy(): void {
    this.yeti?.destroy();
    this.yeti    = null;
    this.spawned = false;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private spawn(playerX: number, playerScreenY: number): void {
    this.spawned = true;

    // Start at bottom-centre of screen, slightly offset from player X
    const startX = Phaser.Math.Clamp(playerX + Phaser.Math.Between(-80, 80), 100, WORLD_WIDTH - 100);
    const startY = GAME_HEIGHT + 90;

    this.yeti = new Yeti(this.scene, startX, startY);
  }
}
