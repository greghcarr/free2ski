import Phaser from 'phaser';
import { GAME_HEIGHT } from '@/data/constants';

// Vertical padding beyond screen edges before hiding the visual
const CULL_PADDING = 120;

export abstract class ObstacleBase {
  /** Fixed world-space X (equals screen X — no horizontal camera pan) */
  readonly worldX: number;

  /** Fixed world-space Y — converts to screen Y each frame */
  readonly worldY: number;

  /** Radius used for circular collision detection */
  abstract readonly hitRadius: number;

  /** The Phaser Container holding all visual parts */
  protected container!: Phaser.GameObjects.Container;

  constructor(worldX: number, worldY: number) {
    this.worldX = worldX;
    this.worldY = worldY;
  }

  /**
   * Called every frame by ChunkManager.
   * Repositions the visual and culls it when off-screen.
   */
  setScreenY(screenY: number): void {
    this.container.y = screenY;
    // Hide when well off-screen to avoid unnecessary rendering
    this.container.setVisible(screenY > -CULL_PADDING && screenY < GAME_HEIGHT + CULL_PADDING);
  }

  setRenderDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  destroy(): void {
    this.container.destroy();
  }
}
