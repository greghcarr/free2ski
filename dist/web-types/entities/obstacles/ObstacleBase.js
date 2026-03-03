import { GAME_HEIGHT } from '@/data/constants';
// Vertical padding beyond screen edges before hiding the visual
const CULL_PADDING = 80;
export class ObstacleBase {
    constructor(worldX, worldY) {
        this.worldX = worldX;
        this.worldY = worldY;
    }
    /**
     * Called every frame by ChunkManager.
     * Repositions the visual and culls it when off-screen.
     */
    setScreenY(screenY) {
        this.container.y = screenY;
        // Hide when well off-screen to avoid unnecessary rendering
        this.container.setVisible(screenY > -CULL_PADDING && screenY < GAME_HEIGHT + CULL_PADDING);
    }
    destroy() {
        this.container.destroy();
    }
}
