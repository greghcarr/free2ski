import { COLORS } from '@/data/constants';
// Pixels per second the yeti gains on the player when first spawned
const INITIAL_CHASE_SPEED = 85;
// How many additional px/s the yeti gains each second (escalating pressure)
const CHASE_ACCELERATION = 1.8;
// Max yeti speed so the catch never feels instant at ultra-high difficulty
const MAX_CHASE_SPEED = 280;
// Horizontal tracking strength (fraction of gap closed per second)
const HORIZONTAL_TRACK = 2.2;
// Vertical bob amplitude (px) and period (ms)
const BOB_AMP = 3.5;
const BOB_PERIOD = 380;
export class Yeti {
    constructor(scene, startX, startY) {
        /** Growing chase speed */
        this.chaseSpeed = INITIAL_CHASE_SPEED;
        this.elapsed = 0;
        this.screenX = startX;
        this.screenY = startY;
        const gfx = scene.add.graphics();
        this.drawYeti(gfx);
        this.container = scene.add.container(startX, startY, [gfx]);
        this.container.setDepth(8); // in front of obstacles (4) but behind player (10)
    }
    // ---------------------------------------------------------------------------
    // Per-frame update — called by YetiSystem
    // ---------------------------------------------------------------------------
    update(playerX, playerScreenY, delta) {
        const dt = delta / 1000;
        this.elapsed += delta;
        // Escalate chase speed over time
        this.chaseSpeed = Math.min(this.chaseSpeed + CHASE_ACCELERATION * dt, MAX_CHASE_SPEED);
        // Horizontal: smoothly track player X
        this.screenX += (playerX - this.screenX) * HORIZONTAL_TRACK * dt;
        // Vertical: move upward toward player
        this.screenY -= this.chaseSpeed * dt;
        // Running bob — simple sine offset on the visual (not the collision position)
        const bob = Math.sin((this.elapsed / BOB_PERIOD) * Math.PI * 2) * BOB_AMP;
        this.container.setPosition(this.screenX, this.screenY + bob);
    }
    /** Approximate radius for catch detection (yeti is large) */
    get hitRadius() {
        return 32;
    }
    destroy() {
        this.container.destroy();
    }
    // ---------------------------------------------------------------------------
    // Vector art — drawn entirely with the Graphics API
    // ---------------------------------------------------------------------------
    drawYeti(gfx) {
        // --- Drop shadow at feet ---
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(6, 38, 64, 18);
        // --- Arms (drawn before body so body occludes their inner edge) ---
        gfx.fillStyle(COLORS.YETI, 1);
        // Right arm: thick reaching-forward shape
        gfx.fillPoints([{ x: 14, y: -2 }, { x: 40, y: 14 }, { x: 32, y: 30 }, { x: 9, y: 14 }], true);
        // Left arm
        gfx.fillPoints([{ x: -14, y: -2 }, { x: -40, y: 14 }, { x: -32, y: 30 }, { x: -9, y: 14 }], true);
        // Arm shadow / depth
        gfx.fillStyle(COLORS.YETI_SHADOW, 0.3);
        gfx.fillPoints([{ x: 22, y: 6 }, { x: 38, y: 16 }, { x: 32, y: 30 }, { x: 18, y: 18 }], true);
        gfx.fillPoints([{ x: -22, y: 6 }, { x: -38, y: 16 }, { x: -32, y: 30 }, { x: -18, y: 18 }], true);
        // --- Torso ---
        gfx.fillStyle(COLORS.YETI, 1);
        gfx.fillEllipse(0, 8, 44, 52);
        // Torso fur depth (darker centre strip)
        gfx.fillStyle(COLORS.YETI_SHADOW, 0.22);
        gfx.fillEllipse(0, 12, 24, 40);
        // --- Head ---
        gfx.fillStyle(COLORS.YETI, 1);
        gfx.fillCircle(0, -28, 21);
        // Ear fur bumps
        gfx.fillCircle(-17, -40, 8);
        gfx.fillCircle(17, -40, 8);
        // Head shading
        gfx.fillStyle(COLORS.YETI_SHADOW, 0.22);
        gfx.fillCircle(-5, -28, 15);
        gfx.fillCircle(5, -28, 15);
        // --- Eyes — large, dark, menacing ---
        gfx.fillStyle(0x0a1828, 1);
        gfx.fillCircle(-8, -30, 6);
        gfx.fillCircle(9, -29, 6);
        // Angry eyebrow wedges (give it an aggressive look)
        gfx.fillStyle(0x0a1828, 1);
        gfx.fillTriangle(-14, -38, -2, -36, -6, -32); // left brow
        gfx.fillTriangle(15, -38, 3, -36, 7, -31); // right brow
        // Eye highlights
        gfx.fillStyle(0xffffff, 0.9);
        gfx.fillCircle(-6, -32, 2);
        gfx.fillCircle(11, -32, 2);
        // --- Mouth: open, showing fangs ---
        gfx.fillStyle(0x0a1828, 0.95);
        gfx.fillRect(-9, -20, 18, 7); // mouth gap
        // Fangs
        gfx.fillStyle(0xffffff, 1);
        gfx.fillTriangle(-7, -20, -2, -20, -4, -13); // left fang
        gfx.fillTriangle(2, -20, 7, -20, 4, -13); // right fang
    }
}
