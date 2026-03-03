import Phaser from 'phaser';
import { CHUNK_HEIGHT, CHUNKS_AHEAD, CHUNKS_BEHIND } from '@/data/constants';
import { spawnObstacles } from './ObstacleSpawner';
import { Tree } from '@/entities/obstacles/Tree';
import { Rock } from '@/entities/obstacles/Rock';
import type { ObstacleBase } from '@/entities/obstacles/ObstacleBase';

// Circular hit radius assumed for the player body (skier torso, not ski tips)
const PLAYER_HIT_RADIUS = 12;

// Only run full distance collision check when obstacle is within this many px on each axis
const COLLISION_CHECK_RANGE = 80;

interface ActiveChunk {
  index: number;
  obstacles: ObstacleBase[];
}

export class ChunkManager {
  private scene: Phaser.Scene;
  private baseSeed: number;
  private chunks = new Map<number, ActiveChunk>();

  constructor(scene: Phaser.Scene, baseSeed: number) {
    this.scene = scene;
    this.baseSeed = baseSeed >>> 0;
  }

  /**
   * Called every frame from GameScene.update().
   *
   * - Ensures the right set of chunks is active.
   * - Scrolls all obstacle visuals to their current screen positions.
   * - Returns true if the player has collided with any obstacle.
   */
  update(worldOffsetY: number, playerX: number, playerScreenY: number): boolean {
    const currentChunk = Math.floor(worldOffsetY / CHUNK_HEIGHT);

    // --- Activate needed chunks ---
    const firstNeeded = Math.max(0, currentChunk - CHUNKS_BEHIND);
    const lastNeeded  = currentChunk + CHUNKS_AHEAD;

    for (let i = firstNeeded; i <= lastNeeded; i++) {
      if (!this.chunks.has(i)) {
        this.activateChunk(i);
      }
    }

    // --- Retire stale chunks ---
    for (const [index] of this.chunks) {
      if (index < firstNeeded - 1) {
        this.retireChunk(index);
      }
    }

    // --- Update screen positions + collision ---
    let collided = false;

    for (const chunk of this.chunks.values()) {
      for (const obstacle of chunk.obstacles) {
        const screenY = playerScreenY + (obstacle.worldY - worldOffsetY);
        obstacle.setScreenY(screenY);

        if (collided) continue; // keep updating positions but stop checking

        // Cheap axis-aligned pre-check before the sqrt
        const dy = screenY - playerScreenY;
        if (dy < -COLLISION_CHECK_RANGE || dy > COLLISION_CHECK_RANGE) continue;
        const dx = obstacle.worldX - playerX;
        if (dx < -COLLISION_CHECK_RANGE || dx > COLLISION_CHECK_RANGE) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PLAYER_HIT_RADIUS + obstacle.hitRadius) {
          collided = true;
        }
      }
    }

    return collided;
  }

  destroy(): void {
    for (const [index] of this.chunks) {
      this.retireChunk(index);
    }
    this.chunks.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private activateChunk(index: number): void {
    // Derive a unique deterministic seed for this chunk
    const chunkSeed = (this.baseSeed ^ (index * 0x9e3779b9)) >>> 0;
    const spawnPoints = spawnObstacles(index, chunkSeed);

    const obstacles: ObstacleBase[] = spawnPoints.map(pt => {
      if (pt.kind === 'tree') {
        return new Tree(this.scene, pt.worldX, pt.worldY, pt.variant as 'normal' | 'small');
      }
      return new Rock(this.scene, pt.worldX, pt.worldY, pt.variant as 'normal' | 'small');
    });

    this.chunks.set(index, { index, obstacles });
  }

  private retireChunk(index: number): void {
    const chunk = this.chunks.get(index);
    if (!chunk) return;
    for (const obstacle of chunk.obstacles) {
      obstacle.destroy();
    }
    this.chunks.delete(index);
  }
}
