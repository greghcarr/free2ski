import { ObstacleBase } from './ObstacleBase';
import { COLORS } from '@/data/constants';
const RAMP_W = 72; // px wide at base
const RAMP_H = 28; // px tall at lip
const HIT_RADIUS = 28; // generous — ramp should be easy to trigger
export class Ramp extends ObstacleBase {
    constructor(scene, worldX, worldY) {
        super(worldX, worldY);
        this.hitRadius = HIT_RADIUS;
        const gfx = scene.add.graphics();
        const halfW = RAMP_W / 2;
        // Ground shadow
        gfx.fillStyle(0x000000, 0.14);
        gfx.fillEllipse(4, RAMP_H / 2 + 6, RAMP_W + 16, 12);
        // Main ramp wedge — rises from left to right
        // Points: bottom-left, bottom-right, top-right (lip)
        gfx.fillStyle(COLORS.RAMP, 1);
        gfx.fillTriangle(-halfW, RAMP_H / 2, halfW, RAMP_H / 2, halfW, -RAMP_H / 2);
        // Top highlight
        gfx.fillStyle(0xf0f6fc, 0.65);
        gfx.fillTriangle(-halfW + 10, RAMP_H / 2 - 3, halfW - 4, RAMP_H / 2 - 3, halfW - 4, -RAMP_H / 2 + 8);
        // Lip edge line
        gfx.lineStyle(2, 0x8898aa, 1);
        gfx.beginPath();
        gfx.moveTo(-halfW, RAMP_H / 2);
        gfx.lineTo(halfW, -RAMP_H / 2);
        gfx.strokePath();
        // Vertical face at lip
        gfx.lineStyle(2, 0x8898aa, 0.7);
        gfx.beginPath();
        gfx.moveTo(halfW, -RAMP_H / 2);
        gfx.lineTo(halfW, RAMP_H / 2);
        gfx.strokePath();
        this.container = scene.add.container(worldX, 9999, [gfx]);
        this.container.setDepth(4);
    }
}
