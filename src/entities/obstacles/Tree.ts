import Phaser from 'phaser';
import { COLORS, DEPTH } from '@/data/constants';
import { ObstacleBase } from './ObstacleBase';

// Two size variants — small trees appear more frequently for density
export type TreeVariant = 'normal' | 'small';

export class Tree extends ObstacleBase {
  readonly hitRadius: number;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number, variant: TreeVariant = 'normal') {
    super(worldX, worldY);

    const s = variant === 'small' ? 0.72 : 1.0;
    this.hitRadius = variant === 'small' ? 14 : 20;

    const gfx = scene.add.graphics();
    this.drawTree(gfx, s);

    this.container = scene.add.container(worldX, 0, [gfx]);
    this.container.setDepth(DEPTH.OBSTACLES);
    this.container.setScale(1.5);
  }

  private drawTree(gfx: Phaser.GameObjects.Graphics, s: number): void {
    // --- Drop shadow beneath canopy ---
    gfx.fillStyle(0x000000, 0.12);
    gfx.fillEllipse(4 * s, 10 * s, 28 * s, 10 * s);

    // --- Trunk ---
    gfx.fillStyle(COLORS.TREE_TRUNK, 1);
    gfx.fillRect(-3 * s, 4 * s, 6 * s, 10 * s);

    // --- Base layer (widest, darkest green) ---
    gfx.fillStyle(COLORS.TREE_DARK, 1);
    gfx.fillTriangle(-15 * s, 8 * s, 15 * s, 8 * s, 0, -6 * s);

    // --- Mid layer ---
    gfx.fillStyle(COLORS.TREE_MID, 1);
    gfx.fillTriangle(-11 * s, 1 * s, 11 * s, 1 * s, 0, -16 * s);

    // --- Top layer (narrowest, lighter) ---
    gfx.fillStyle(COLORS.TREE_TOP, 1);
    gfx.fillTriangle(-7 * s, -7 * s, 7 * s, -7 * s, 0, -22 * s);

    // --- Snow cap ---
    gfx.fillStyle(COLORS.TREE_SNOW, 1);
    gfx.fillTriangle(-4 * s, -13 * s, 4 * s, -13 * s, 0, -26 * s);
  }
}
