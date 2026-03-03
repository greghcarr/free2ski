import { SeededRandom } from '@/utils/SeededRandom';
import { WORLD_WIDTH, CHUNK_HEIGHT } from '@/data/constants';
import { GameMode } from '@/config/GameModes';
// Horizontal margins
const X_MIN = 90;
const X_MAX = WORLD_WIDTH - 90;
// Minimum distance between obstacles (prevents total overlap)
const MIN_SPACING = 40;
// Y offset into the chunk before first obstacle
const CHUNK_GRACE_Y = 120;
// Slalom gate layout constants
const GATE_SPACING = 380; // px between consecutive gates
const GATE_X_LEFT = 300; // centre X for left-side gates
const GATE_X_RIGHT = 980; // centre X for right-side gates
const GATE_X_JITTER = 55; // ±px random offset from the centre line
// TreeSlalom half-gap (tree pair centre ± this = tree X positions)
const TREE_PAIR_HALF_GAP = 110;
/**
 * Sigmoid density curve → [0, 1] rising smoothly over ~4 km.
 */
function densityFactor(worldYStart) {
    const t = worldYStart / 20000;
    return 1 / (1 + Math.exp(-10 * (t - 0.3)));
}
/** Add a point, enforcing minimum spacing. Returns true if added. */
function tryAdd(points, candidate) {
    const tooClose = points.some(p => Math.abs(p.worldX - candidate.worldX) < MIN_SPACING &&
        Math.abs(p.worldY - candidate.worldY) < MIN_SPACING);
    if (tooClose)
        return false;
    points.push(candidate);
    return true;
}
// ---------------------------------------------------------------------------
// Free Ski — random trees and rocks, density rising with distance
// ---------------------------------------------------------------------------
function spawnFreeSki(chunkIndex, chunkSeed) {
    const rng = new SeededRandom(chunkSeed);
    const worldYStart = chunkIndex * CHUNK_HEIGHT;
    const density = densityFactor(worldYStart);
    const count = Math.floor(8 + density * 22);
    const points = [];
    let attempts = 0;
    while (points.length < count && attempts < count * 4) {
        attempts++;
        const worldX = rng.range(X_MIN, X_MAX);
        const worldY = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);
        let kind;
        let variant;
        const roll = rng.next();
        if (roll < 0.55) {
            kind = 'tree';
            variant = 'normal';
        }
        else if (roll < 0.70) {
            kind = 'tree';
            variant = 'small';
        }
        else if (roll < 0.88) {
            kind = 'rock';
            variant = 'normal';
        }
        else {
            kind = 'rock';
            variant = 'small';
        }
        tryAdd(points, { kind, variant, worldX, worldY });
    }
    points.sort((a, b) => a.worldY - b.worldY);
    return points;
}
// ---------------------------------------------------------------------------
// Slalom — alternating left/right gates, no random obstacles
// ---------------------------------------------------------------------------
function spawnSlalom(chunkIndex, chunkSeed) {
    const rng = new SeededRandom(chunkSeed);
    const worldYStart = chunkIndex * CHUNK_HEIGHT;
    const points = [];
    const gatesInChunk = Math.floor((CHUNK_HEIGHT - CHUNK_GRACE_Y * 2) / GATE_SPACING);
    for (let g = 0; g < gatesInChunk; g++) {
        const absGateIndex = chunkIndex * gatesInChunk + g;
        const isLeft = (absGateIndex % 2) === 0;
        const color = isLeft ? 'red' : 'blue';
        const centreX = isLeft ? GATE_X_LEFT : GATE_X_RIGHT;
        const worldX = centreX + rng.range(-GATE_X_JITTER, GATE_X_JITTER);
        const worldY = worldYStart + CHUNK_GRACE_Y + g * GATE_SPACING + rng.range(-30, 30);
        points.push({ kind: 'gate', variant: color, worldX, worldY });
    }
    points.sort((a, b) => a.worldY - b.worldY);
    return points;
}
// ---------------------------------------------------------------------------
// Tree Slalom — alternating tree pairs as natural gates + random hazards
// ---------------------------------------------------------------------------
function spawnTreeSlalom(chunkIndex, chunkSeed) {
    const rng = new SeededRandom(chunkSeed);
    const worldYStart = chunkIndex * CHUNK_HEIGHT;
    const points = [];
    const pairsInChunk = Math.floor((CHUNK_HEIGHT - CHUNK_GRACE_Y * 2) / GATE_SPACING);
    for (let p = 0; p < pairsInChunk; p++) {
        const absPairIndex = chunkIndex * pairsInChunk + p;
        const isLeft = (absPairIndex % 2) === 0;
        const pairCentreX = isLeft ? GATE_X_LEFT : GATE_X_RIGHT;
        const worldY = worldYStart + CHUNK_GRACE_Y + p * GATE_SPACING + rng.range(-30, 30);
        const cx = pairCentreX + rng.range(-GATE_X_JITTER, GATE_X_JITTER);
        tryAdd(points, { kind: 'tree', variant: 'normal', worldX: cx - TREE_PAIR_HALF_GAP, worldY });
        tryAdd(points, { kind: 'tree', variant: 'normal', worldX: cx + TREE_PAIR_HALF_GAP, worldY });
    }
    // Extra random hazards
    const density = densityFactor(worldYStart);
    const extras = Math.floor(4 + density * 8);
    let attempts = 0;
    while (points.length < pairsInChunk * 2 + extras && attempts < extras * 5) {
        attempts++;
        const worldX = rng.range(X_MIN, X_MAX);
        const worldY = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);
        const roll = rng.next();
        const kind = roll < 0.6 ? 'tree' : 'rock';
        const variant = roll < 0.4 ? 'normal' : 'small';
        tryAdd(points, { kind, variant, worldX, worldY });
    }
    points.sort((a, b) => a.worldY - b.worldY);
    return points;
}
// ---------------------------------------------------------------------------
// Jump — ramps + moderate trees, fewer rocks
// ---------------------------------------------------------------------------
function spawnJump(chunkIndex, chunkSeed, rampFrequency) {
    if (chunkIndex === 0)
        return [];
    const rng = new SeededRandom(chunkSeed);
    const worldYStart = chunkIndex * CHUNK_HEIGHT;
    const density = densityFactor(worldYStart);
    const points = [];
    // Ramps — evenly spaced with jitter
    const rampSpacing = Math.floor(CHUNK_HEIGHT / (rampFrequency + 1));
    for (let r = 0; r < rampFrequency; r++) {
        const worldX = rng.range(X_MIN + 60, X_MAX - 60);
        const worldY = worldYStart + rampSpacing * (r + 1) + rng.range(-60, 60);
        tryAdd(points, { kind: 'ramp', variant: 'normal', worldX, worldY });
    }
    // Trees around/between ramps
    const treeCount = Math.floor(5 + density * 14);
    let attempts = 0;
    while (points.length < rampFrequency + treeCount && attempts < treeCount * 4) {
        attempts++;
        const worldX = rng.range(X_MIN, X_MAX);
        const worldY = worldYStart + CHUNK_GRACE_Y + rng.range(0, CHUNK_HEIGHT - CHUNK_GRACE_Y * 2);
        const variant = rng.next() < 0.65 ? 'normal' : 'small';
        tryAdd(points, { kind: 'tree', variant, worldX, worldY });
    }
    points.sort((a, b) => a.worldY - b.worldY);
    return points;
}
// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
/**
 * Returns spawn points for one chunk, adapted to the active game mode.
 */
export function spawnObstacles(chunkIndex, chunkSeed, mode, rampFrequency = 3) {
    switch (mode) {
        case GameMode.Slalom:
            return spawnSlalom(chunkIndex, chunkSeed);
        case GameMode.TreeSlalom:
            if (chunkIndex === 0)
                return [];
            return spawnTreeSlalom(chunkIndex, chunkSeed);
        case GameMode.Jump:
            return spawnJump(chunkIndex, chunkSeed, rampFrequency);
        default: // FreeSki
            if (chunkIndex === 0)
                return [];
            return spawnFreeSki(chunkIndex, chunkSeed);
    }
}
