import { ObstacleBase } from './ObstacleBase';
import { COLORS, GATE_GAP_WIDTH, GATE_POLE_RADIUS } from '@/data/constants';
const POLE_H = 64; // visual height of each pole
const BANNER_H = 14; // horizontal flag/banner thickness
export class SlalomGate extends ObstacleBase {
    // World-space X of each pole centre
    get leftPoleX() { return this.worldX - this.gapWidth / 2; }
    get rightPoleX() { return this.worldX + this.gapWidth / 2; }
    constructor(scene, worldX, worldY, color) {
        super(worldX, worldY);
        /** Gap between the inner edges of the two poles */
        this.gapWidth = GATE_GAP_WIDTH;
        /** True once the player has scrolled past this gate's worldY */
        this.isPassed = false;
        // Each pole is treated as a separate point for collision.
        // hitRadius is used for the pole cylinders.
        this.hitRadius = GATE_POLE_RADIUS;
        this.color = color;
        const gfx = scene.add.graphics();
        const colorVal = color === 'red' ? COLORS.GATE_LEFT : COLORS.GATE_RIGHT;
        const halfGap = this.gapWidth / 2;
        const halfPole = GATE_POLE_RADIUS;
        // Drop shadows under poles
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(-halfGap, POLE_H / 2 + 4, halfPole * 4, 8);
        gfx.fillEllipse(halfGap, POLE_H / 2 + 4, halfPole * 4, 8);
        // Left pole body
        gfx.fillStyle(colorVal, 1);
        gfx.fillRect(-halfGap - halfPole, -POLE_H / 2, halfPole * 2, POLE_H);
        // Right pole body
        gfx.fillRect(halfGap - halfPole, -POLE_H / 2, halfPole * 2, POLE_H);
        // White stripe on each pole (decorative)
        gfx.fillStyle(0xffffff, 1);
        gfx.fillRect(-halfGap - halfPole, -POLE_H / 2 + 4, halfPole * 2, 10);
        gfx.fillRect(halfGap - halfPole, -POLE_H / 2 + 4, halfPole * 2, 10);
        // Horizontal banner connecting the poles
        gfx.fillStyle(colorVal, 0.80);
        gfx.fillRect(-halfGap, -BANNER_H / 2, this.gapWidth, BANNER_H);
        // Banner centre stripe (white) for visibility
        gfx.fillStyle(0xffffff, 0.50);
        gfx.fillRect(-halfGap + 8, -3, this.gapWidth - 16, 6);
        this.container = scene.add.container(worldX, 9999, [gfx]);
        this.container.setDepth(3);
    }
}
