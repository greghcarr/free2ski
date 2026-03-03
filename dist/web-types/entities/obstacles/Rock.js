import { COLORS } from '@/data/constants';
import { ObstacleBase } from './ObstacleBase';
// Irregular rock silhouette (points are in local space, centred on 0,0)
const ROCK_POINTS_LARGE = [
    { x: 0, y: -13 },
    { x: 10, y: -9 },
    { x: 14, y: 0 },
    { x: 10, y: 9 },
    { x: 2, y: 12 },
    { x: -8, y: 10 },
    { x: -14, y: 2 },
    { x: -12, y: -8 },
    { x: -5, y: -13 },
];
const ROCK_HIGHLIGHT = [
    { x: -5, y: -12 },
    { x: 4, y: -12 },
    { x: 9, y: -5 },
    { x: 0, y: -5 },
];
export class Rock extends ObstacleBase {
    constructor(scene, worldX, worldY, variant = 'normal') {
        super(worldX, worldY);
        const s = variant === 'small' ? 0.65 : 1.0;
        this.hitRadius = variant === 'small' ? 8 : 11;
        const gfx = scene.add.graphics();
        this.drawRock(gfx, s);
        this.container = scene.add.container(worldX, 0, [gfx]);
        this.container.setDepth(4);
    }
    drawRock(gfx, s) {
        const scale = (pts) => pts.map(p => ({ x: (p.x ?? 0) * s, y: (p.y ?? 0) * s }));
        // Drop shadow
        gfx.fillStyle(0x000000, 0.18);
        gfx.fillPoints(scale(ROCK_POINTS_LARGE).map(p => ({ x: p.x + 4 * s, y: p.y + 5 * s })), true);
        // Main body
        gfx.fillStyle(COLORS.ROCK, 1);
        gfx.fillPoints(scale(ROCK_POINTS_LARGE), true);
        // Darker underside crease
        gfx.fillStyle(COLORS.ROCK_SHADOW, 1);
        gfx.fillRect(-8 * s, 4 * s, 16 * s, 6 * s);
        // Highlight (top-left catch light)
        gfx.fillStyle(0xb0b0c8, 0.75);
        gfx.fillPoints(scale(ROCK_HIGHLIGHT), true);
    }
}
