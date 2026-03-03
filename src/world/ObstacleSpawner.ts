import { SeededRandom } from '@/utils/SeededRandom';
import { WORLD_WIDTH, CHUNK_HEIGHT, COURSE_EDGE_WIDE, COURSE_EDGE_NARROW } from '@/data/constants';
import { GameMode } from '@/config/GameModes';
import type { TreeVariant } from '@/entities/obstacles/Tree';
import type { RockVariant } from '@/entities/obstacles/Rock';
import type { GateColor } from '@/entities/obstacles/SlalomGate';

export type ObstacleKind = 'tree' | 'rock' | 'gate' | 'ramp';
export type ObstacleVariant = TreeVariant | RockVariant | GateColor | 'normal';

export interface ObstacleSpawnPoint {
  kind:        ObstacleKind;
  variant:     ObstacleVariant;
  worldX:      number;
  worldY:      number; // absolute world Y
  renderDepth?: number; // overrides the entity's default depth when set
}

// Horizontal margins (course obstacles)
const X_MIN = 90;
const X_MAX = WORLD_WIDTH - 90;

// Forest border
// Wide: FreeSki / Jump — push the "hug the edge" exploit out as far as possible.
// Narrow: Slalom / TreeSlalom — keep clear of gate poles (worst-case left pole ≈ x 135).
const FOREST_DEPTH_WIDE   = COURSE_EDGE_WIDE;
const FOREST_DEPTH_NARROW = COURSE_EDGE_NARROW;
const FOREST_ROW_HEIGHT   = 60;   // px between sample rows
const FOREST_CANDS        = 8;    // candidates tested per row per side
const FOREST_MIN_SPACING  = 16;   // tight spacing for dense packing
const FOREST_GRACE_Y      = 100;  // px from chunk top before forest begins

// Minimum distance between obstacles (prevents total overlap)
const MIN_SPACING = 40;

// Y offset into the chunk before first obstacle
const CHUNK_GRACE_Y = 120;

// Slalom gate layout constants
const GATE_SPACING    = 380;   // px between consecutive gates
const GATE_X_LEFT     = 300;   // centre X for left-side gates
const GATE_X_RIGHT    = 980;   // centre X for right-side gates
const GATE_X_JITTER   = 55;    // ±px random offset from the centre line

// TreeSlalom half-gap (tree pair centre ± this = tree X positions)
const TREE_PAIR_HALF_GAP = 110;

/**
 * Sigmoid density curve → [0, 1] rising smoothly over ~4 km.
 */
function densityFactor(worldYStart: number): number {
  const t = worldYStart / 20_000;
  return 1 / (1 + Math.exp(-10 * (t - 0.3)));
}

/** Add a point, enforcing minimum spacing. Returns true if added. */
function tryAdd(
  points: ObstacleSpawnPoint[],
  candidate: ObstacleSpawnPoint,
): boolean {
  const tooClose = points.some(
    p => Math.abs(p.worldX - candidate.worldX) < MIN_SPACING &&
         Math.abs(p.worldY - candidate.worldY) < MIN_SPACING,
  );
  if (tooClose) return false;
  points.push(candidate);
  return true;
}

// ---------------------------------------------------------------------------
// Free Ski — random trees and rocks, density rising with distance
// ---------------------------------------------------------------------------
function spawnFreeSki(
  chunkIndex: number,
  chunkSeed: number,
): ObstacleSpawnPoint[] {
  const rng         = new SeededRandom(chunkSeed);
  const worldYStart = chunkIndex * CHUNK_HEIGHT;
  const density     = densityFactor(worldYStart);
  const count       = Math.floor(8 + density * 22);

  const points: ObstacleSpawnPoint[] = [];
  let attempts = 0;

  while (points.length < count && attempts < count * 4) {
    attempts++;
    const worldX = rng.range(X_MIN, X_MAX);
    const worldY = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);

    let kind:    ObstacleKind;
    let variant: ObstacleVariant;
    const roll = rng.next();
    if (roll < 0.55)      { kind = 'tree'; variant = 'normal'; }
    else if (roll < 0.70) { kind = 'tree'; variant = 'small'; }
    else if (roll < 0.88) { kind = 'rock'; variant = 'normal'; }
    else                  { kind = 'rock'; variant = 'small'; }

    tryAdd(points, { kind, variant, worldX, worldY });
  }
  points.sort((a, b) => a.worldY - b.worldY);
  return points;
}

// ---------------------------------------------------------------------------
// Slalom — alternating left/right gates, no random obstacles
// ---------------------------------------------------------------------------
function spawnSlalom(
  chunkIndex: number,
  chunkSeed: number,
): ObstacleSpawnPoint[] {
  const rng         = new SeededRandom(chunkSeed);
  const worldYStart = chunkIndex * CHUNK_HEIGHT;
  const points: ObstacleSpawnPoint[] = [];

  const gatesInChunk = Math.floor((CHUNK_HEIGHT - CHUNK_GRACE_Y * 2) / GATE_SPACING);

  for (let g = 0; g < gatesInChunk; g++) {
    const absGateIndex     = chunkIndex * gatesInChunk + g;
    const isLeft           = (absGateIndex % 2) === 0;
    const color: GateColor = isLeft ? 'red' : 'blue';
    const centreX          = isLeft ? GATE_X_LEFT : GATE_X_RIGHT;
    const worldX           = centreX + rng.range(-GATE_X_JITTER, GATE_X_JITTER);
    const worldY           = worldYStart + CHUNK_GRACE_Y + g * GATE_SPACING + rng.range(-30, 30);
    points.push({ kind: 'gate', variant: color, worldX, worldY });
  }

  points.sort((a, b) => a.worldY - b.worldY);
  return points;
}

// ---------------------------------------------------------------------------
// Tree Slalom — alternating tree pairs as natural gates + random hazards
// ---------------------------------------------------------------------------
function spawnTreeSlalom(
  chunkIndex: number,
  chunkSeed: number,
): ObstacleSpawnPoint[] {
  const rng         = new SeededRandom(chunkSeed);
  const worldYStart = chunkIndex * CHUNK_HEIGHT;
  const points: ObstacleSpawnPoint[] = [];

  const pairsInChunk = Math.floor((CHUNK_HEIGHT - CHUNK_GRACE_Y * 2) / GATE_SPACING);

  for (let p = 0; p < pairsInChunk; p++) {
    const absPairIndex = chunkIndex * pairsInChunk + p;
    const isLeft       = (absPairIndex % 2) === 0;
    const pairCentreX  = isLeft ? GATE_X_LEFT : GATE_X_RIGHT;
    const worldY       = worldYStart + CHUNK_GRACE_Y + p * GATE_SPACING + rng.range(-30, 30);
    const cx           = pairCentreX + rng.range(-GATE_X_JITTER, GATE_X_JITTER);
    tryAdd(points, { kind: 'tree', variant: 'normal', worldX: cx - TREE_PAIR_HALF_GAP, worldY });
    tryAdd(points, { kind: 'tree', variant: 'normal', worldX: cx + TREE_PAIR_HALF_GAP, worldY });
  }

  // Extra random hazards
  const density  = densityFactor(worldYStart);
  const extras   = Math.floor(4 + density * 8);
  let   attempts = 0;

  while (points.length < pairsInChunk * 2 + extras && attempts < extras * 5) {
    attempts++;
    const worldX             = rng.range(X_MIN, X_MAX);
    const worldY             = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);
    const roll               = rng.next();
    const kind: ObstacleKind = roll < 0.6 ? 'tree' : 'rock';
    const variant: ObstacleVariant = roll < 0.4 ? 'normal' : 'small';
    tryAdd(points, { kind, variant, worldX, worldY });
  }

  points.sort((a, b) => a.worldY - b.worldY);
  return points;
}

// ---------------------------------------------------------------------------
// Jump — ramps + moderate trees, fewer rocks
// ---------------------------------------------------------------------------
function spawnJump(
  chunkIndex: number,
  chunkSeed: number,
  rampFrequency: number,
): ObstacleSpawnPoint[] {
  if (chunkIndex === 0) return [];

  const rng         = new SeededRandom(chunkSeed);
  const worldYStart = chunkIndex * CHUNK_HEIGHT;
  const density     = densityFactor(worldYStart);
  const points: ObstacleSpawnPoint[] = [];

  // Ramps — evenly spaced with jitter
  const rampSpacing = Math.floor(CHUNK_HEIGHT / (rampFrequency + 1));
  for (let r = 0; r < rampFrequency; r++) {
    const worldX = rng.range(X_MIN + 60, X_MAX - 60);
    const worldY = worldYStart + rampSpacing * (r + 1) + rng.range(-60, 60);
    tryAdd(points, { kind: 'ramp', variant: 'normal', worldX, worldY });
  }

  // Trees around/between ramps
  const treeCount = Math.floor(5 + density * 14);
  let   attempts  = 0;
  while (points.length < rampFrequency + treeCount && attempts < treeCount * 4) {
    attempts++;
    const worldX             = rng.range(X_MIN, X_MAX);
    const worldY             = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);
    const variant: ObstacleVariant = rng.next() < 0.65 ? 'normal' : 'small';
    tryAdd(points, { kind: 'tree', variant, worldX, worldY });
  }

  points.sort((a, b) => a.worldY - b.worldY);
  return points;
}

// ---------------------------------------------------------------------------
// Forest border — appears in every mode, independent of course obstacles
// ---------------------------------------------------------------------------
// Density falls off from the screen edge inward using a power curve.
// distFrac = 0 at the edge (dense), 1 at the inner boundary (empty).
// Exponent 1.4 gives dense packing near the screen edge that tapers
// quickly so the course centre stays clear.
function spawnForestBorder(
  chunkIndex: number,
  chunkSeed:  number,
  mode:       GameMode,
): ObstacleSpawnPoint[] {
  // XOR with a large prime so forest positions are independent of course positions
  const rng   = new SeededRandom(chunkSeed ^ 0xC0FFEE17);
  const depth = (mode === GameMode.Slalom || mode === GameMode.TreeSlalom)
    ? FOREST_DEPTH_NARROW
    : FOREST_DEPTH_WIDE;

  const worldYStart = chunkIndex * CHUNK_HEIGHT;
  const numRows     = Math.ceil((CHUNK_HEIGHT - FOREST_GRACE_Y) / FOREST_ROW_HEIGHT);
  const points: ObstacleSpawnPoint[] = [];

  for (let row = 0; row < numRows; row++) {
    const baseY = worldYStart + FOREST_GRACE_Y + row * FOREST_ROW_HEIGHT;

    for (let side = 0; side < 2; side++) {
      for (let c = 0; c < FOREST_CANDS; c++) {
        // Pick an X in the forest zone for this side
        const rawX = rng.range(10, depth);
        const worldX = side === 0 ? rawX : WORLD_WIDTH - rawX;

        // Probability: 1 at the screen edge, 0 at the inner boundary.
        // Exponent 0.8 gives a gentler falloff so the forest stays dense further in.
        const distFrac = rawX / depth;
        const prob     = Math.pow(1 - distFrac, 0.8);
        if (rng.next() > prob) continue;

        const worldY = baseY + rng.range(0, FOREST_ROW_HEIGHT);
        // Size gradient: far edge (distFrac ≈ 0) → almost always 'normal' (old-growth);
        //               inner fringe (distFrac ≈ 1) → almost always 'small' (recently cleared).
        const variant: ObstacleVariant = rng.next() < (1 - distFrac) ? 'normal' : 'small';

        const tooClose = points.some(
          p => Math.abs(p.worldX - worldX) < FOREST_MIN_SPACING &&
               Math.abs(p.worldY - worldY)  < FOREST_MIN_SPACING,
        );
        if (!tooClose) points.push({ kind: 'tree', variant, worldX, worldY, renderDepth: 3 });
      }
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Returns spawn points for one chunk, adapted to the active game mode.
 */
export function spawnObstacles(
  chunkIndex: number,
  chunkSeed: number,
  mode: GameMode,
  rampFrequency = 3,
): ObstacleSpawnPoint[] {
  let course: ObstacleSpawnPoint[];
  switch (mode) {
    case GameMode.Slalom:
      course = spawnSlalom(chunkIndex, chunkSeed);
      break;
    case GameMode.TreeSlalom:
      course = chunkIndex === 0 ? [] : spawnTreeSlalom(chunkIndex, chunkSeed);
      break;
    case GameMode.Jump:
      course = spawnJump(chunkIndex, chunkSeed, rampFrequency);
      break;
    default: // FreeSki
      course = chunkIndex === 0 ? [] : spawnFreeSki(chunkIndex, chunkSeed);
      break;
  }

  const forest = spawnForestBorder(chunkIndex, chunkSeed, mode);
  return [...course, ...forest].sort((a, b) => a.worldY - b.worldY);
}
