import { CHUNK_HEIGHT, CHUNKS_AHEAD, CHUNKS_BEHIND, GATE_POLE_RADIUS } from '@/data/constants';
import { GAME_MODE_CONFIGS } from '@/config/GameModes';
import { spawnObstacles } from './ObstacleSpawner';
import { Tree } from '@/entities/obstacles/Tree';
import { Rock } from '@/entities/obstacles/Rock';
import { Ramp } from '@/entities/obstacles/Ramp';
import { SlalomGate } from '@/entities/obstacles/SlalomGate';
// Circular hit radius for the player body (torso, not ski tips)
const PLAYER_HIT_RADIUS = 12;
// Axis-aligned pre-check range before the full sqrt
const COLLISION_CHECK_RANGE = 80;
const NO_COLLISION = {
    crashed: false, gatePassed: false, gateMissed: false, rampHit: false,
};
export class ChunkManager {
    constructor(scene, baseSeed, mode) {
        this.chunks = new Map();
        this.scene = scene;
        this.baseSeed = baseSeed >>> 0;
        this.mode = mode;
    }
    /**
     * Called every frame from GameScene.update().
     *
     * - Ensures the right set of chunks is active.
     * - Scrolls all obstacle visuals to their current screen positions.
     * - Returns a CollisionResult describing what (if anything) happened.
     *
     * @param playerAirborne  When true, ground collision is skipped entirely.
     */
    update(worldOffsetY, playerX, playerScreenY, playerAirborne) {
        const currentChunk = Math.floor(worldOffsetY / CHUNK_HEIGHT);
        // --- Activate needed chunks ---
        const firstNeeded = Math.max(0, currentChunk - CHUNKS_BEHIND);
        const lastNeeded = currentChunk + CHUNKS_AHEAD;
        for (let i = firstNeeded; i <= lastNeeded; i++) {
            if (!this.chunks.has(i))
                this.activateChunk(i);
        }
        // --- Retire stale chunks ---
        for (const [index] of this.chunks) {
            if (index < firstNeeded - 1)
                this.retireChunk(index);
        }
        // --- Update screen positions + collision ---
        if (playerAirborne) {
            // Still update visuals so obstacles don't freeze, but skip all collision
            for (const chunk of this.chunks.values()) {
                for (const obs of chunk.obstacles) {
                    obs.setScreenY(playerScreenY + (obs.worldY - worldOffsetY));
                }
            }
            return { ...NO_COLLISION };
        }
        const result = { ...NO_COLLISION };
        for (const chunk of this.chunks.values()) {
            for (const obs of chunk.obstacles) {
                const screenY = playerScreenY + (obs.worldY - worldOffsetY);
                obs.setScreenY(screenY);
                // ---- Slalom gate ----
                if (obs instanceof SlalomGate) {
                    this.checkGate(obs, worldOffsetY, playerX, playerScreenY, result);
                    continue;
                }
                // ---- Ramp ----
                if (obs instanceof Ramp) {
                    if (!result.rampHit && !result.crashed) {
                        const dy = screenY - playerScreenY;
                        if (dy >= -COLLISION_CHECK_RANGE && dy <= COLLISION_CHECK_RANGE) {
                            const dx = obs.worldX - playerX;
                            if (dx >= -COLLISION_CHECK_RANGE && dx <= COLLISION_CHECK_RANGE) {
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist < PLAYER_HIT_RADIUS + obs.hitRadius) {
                                    result.rampHit = true;
                                }
                            }
                        }
                    }
                    continue;
                }
                // ---- Tree / Rock (normal crash) ----
                if (!result.crashed) {
                    const dy = screenY - playerScreenY;
                    if (dy < -COLLISION_CHECK_RANGE || dy > COLLISION_CHECK_RANGE)
                        continue;
                    const dx = obs.worldX - playerX;
                    if (dx < -COLLISION_CHECK_RANGE || dx > COLLISION_CHECK_RANGE)
                        continue;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < PLAYER_HIT_RADIUS + obs.hitRadius) {
                        result.crashed = true;
                    }
                }
            }
        }
        return result;
    }
    destroy() {
        for (const [index] of this.chunks)
            this.retireChunk(index);
        this.chunks.clear();
    }
    // ---------------------------------------------------------------------------
    // Gate logic — separated for clarity
    // ---------------------------------------------------------------------------
    checkGate(gate, worldOffsetY, playerX, playerScreenY, result) {
        // Pole collision — check each pole individually
        if (!result.crashed) {
            const screenY = playerScreenY + (gate.worldY - worldOffsetY);
            const dy = screenY - playerScreenY;
            if (dy >= -COLLISION_CHECK_RANGE && dy <= COLLISION_CHECK_RANGE) {
                const dxLeft = gate.leftPoleX - playerX;
                const dxRight = gate.rightPoleX - playerX;
                const hitLeft = Math.sqrt(dxLeft * dxLeft + dy * dy) < PLAYER_HIT_RADIUS + GATE_POLE_RADIUS;
                const hitRight = Math.sqrt(dxRight * dxRight + dy * dy) < PLAYER_HIT_RADIUS + GATE_POLE_RADIUS;
                if (hitLeft || hitRight) {
                    result.crashed = true;
                    return;
                }
            }
        }
        // Gate crossing — fires once when the gate worldY scrolls behind the player
        if (!gate.isPassed && gate.worldY < worldOffsetY) {
            gate.isPassed = true;
            const halfGap = gate.gapWidth / 2;
            const inGap = playerX >= gate.worldX - halfGap + PLAYER_HIT_RADIUS &&
                playerX <= gate.worldX + halfGap - PLAYER_HIT_RADIUS;
            if (inGap) {
                result.gatePassed = true;
            }
            else {
                result.gateMissed = true;
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Private chunk management
    // ---------------------------------------------------------------------------
    activateChunk(index) {
        const chunkSeed = (this.baseSeed ^ (index * 0x9e3779b9)) >>> 0;
        const modeCfg = GAME_MODE_CONFIGS[this.mode];
        const rampFreq = modeCfg.jumpConfig?.rampFrequency ?? 3;
        const spawnPoints = spawnObstacles(index, chunkSeed, this.mode, rampFreq);
        const obstacles = spawnPoints.map(pt => {
            switch (pt.kind) {
                case 'tree':
                    return new Tree(this.scene, pt.worldX, pt.worldY, pt.variant);
                case 'rock':
                    return new Rock(this.scene, pt.worldX, pt.worldY, pt.variant);
                case 'gate':
                    return new SlalomGate(this.scene, pt.worldX, pt.worldY, pt.variant);
                case 'ramp':
                    return new Ramp(this.scene, pt.worldX, pt.worldY);
            }
        });
        this.chunks.set(index, { index, obstacles });
    }
    retireChunk(index) {
        const chunk = this.chunks.get(index);
        if (!chunk)
            return;
        for (const obs of chunk.obstacles)
            obs.destroy();
        this.chunks.delete(index);
    }
}
