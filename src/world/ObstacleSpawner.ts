import { SeededRandom } from '@/utils/SeededRandom';
import { WORLD_WIDTH, CHUNK_HEIGHT } from '@/data/constants';
import type { TreeVariant } from '@/entities/obstacles/Tree';
import type { RockVariant } from '@/entities/obstacles/Rock';

export type ObstacleKind = 'tree' | 'rock';

export interface ObstacleSpawnPoint {
  kind: ObstacleKind;
  variant: TreeVariant | RockVariant;
  worldX: number;
  worldY: number; // absolute world Y
}

// Horizontal margins — obstacles never spawn right at the edge
const X_MIN = 90;
const X_MAX = WORLD_WIDTH - 90;

// Minimum distance between any two obstacles (prevents total overlap)
const MIN_SPACING = 40;

// Minimum Y from chunk start before first obstacle (intra-chunk grace distance)
const CHUNK_GRACE_Y = 120;

/**
 * Sigmoid density curve: returns a value in [0, 1] that increases
 * smoothly from ~0 at worldY=0 to ~1 at worldY=20_000 (≈4 km).
 */
function densityFactor(worldYStart: number): number {
  const t = worldYStart / 20_000;
  return 1 / (1 + Math.exp(-10 * (t - 0.3)));
}

/**
 * Generates obstacle spawn points for a single chunk.
 * Chunk 0 is intentionally left empty as the opening grace zone.
 */
export function spawnObstacles(chunkIndex: number, chunkSeed: number): ObstacleSpawnPoint[] {
  // First chunk: no obstacles — gives the player a few seconds to orient
  if (chunkIndex === 0) return [];

  const rng = new SeededRandom(chunkSeed);
  const worldYStart = chunkIndex * CHUNK_HEIGHT;
  const density = densityFactor(worldYStart);

  // 8 obstacles at minimum density, up to 30 at maximum
  const count = Math.floor(8 + density * 22);

  const points: ObstacleSpawnPoint[] = [];
  let attempts = 0;

  while (points.length < count && attempts < count * 4) {
    attempts++;

    const worldX = rng.range(X_MIN, X_MAX);
    const worldY = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);

    // Reject if too close to an existing point (basic spacing enforcement)
    const tooClose = points.some(
      p => Math.abs(p.worldX - worldX) < MIN_SPACING && Math.abs(p.worldY - worldY) < MIN_SPACING,
    );
    if (tooClose) continue;

    // Type: 70% trees (further split into normal/small), 30% rocks
    let kind: ObstacleKind;
    let variant: TreeVariant | RockVariant;

    const roll = rng.next();
    if (roll < 0.55) {
      kind = 'tree';
      variant = 'normal';
    } else if (roll < 0.70) {
      kind = 'tree';
      variant = 'small';
    } else if (roll < 0.88) {
      kind = 'rock';
      variant = 'normal';
    } else {
      kind = 'rock';
      variant = 'small';
    }

    points.push({ kind, variant, worldX, worldY });
  }

  // Sort by worldY so ChunkManager can early-exit collision checks efficiently
  points.sort((a, b) => a.worldY - b.worldY);
  return points;
}
