import { COLORS } from '@/data/constants';
import { ObstacleBase } from './ObstacleBase';
export class Tree extends ObstacleBase {
    constructor(scene, worldX, worldY, variant = 'normal') {
        super(worldX, worldY);
        const s = variant === 'small' ? 0.72 : 1.0;
        this.hitRadius = variant === 'small' ? 9 : 13;
        const gfx = scene.add.graphics();
        this.drawTree(gfx, s);
        this.container = scene.add.container(worldX, 0, [gfx]);
        this.container.setDepth(4);
    }
    drawTree(gfx, s) {
        // --- Drop shadow beneath canopy ---
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(4 * s, 10 * s, 28 * s, 10 * s);
        // --- Trunk ---
        gfx.fillStyle(0x5c3a1e, 1);
        gfx.fillRect(-3 * s, 4 * s, 6 * s, 10 * s);
        // --- Base layer (widest, darkest green) ---
        gfx.fillStyle(COLORS.TREE_DARK, 1);
        gfx.fillTriangle(-15 * s, 8 * s, 15 * s, 8 * s, 0, -6 * s);
        // --- Mid layer ---
        gfx.fillStyle(COLORS.TREE_MID, 1);
        gfx.fillTriangle(-11 * s, 1 * s, 11 * s, 1 * s, 0, -16 * s);
        // --- Top layer (narrowest, lighter) ---
        gfx.fillStyle(0x4c9040, 1);
        gfx.fillTriangle(-7 * s, -7 * s, 7 * s, -7 * s, 0, -22 * s);
        // --- Snow cap ---
        gfx.fillStyle(COLORS.TREE_SNOW, 1);
        gfx.fillTriangle(-4 * s, -13 * s, 4 * s, -13 * s, 0, -26 * s);
    }
}
