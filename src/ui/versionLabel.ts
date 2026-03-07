import Phaser from 'phaser';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';

export const APP_VERSION = 'v0.1.1-pre-alpha';

export function addVersionLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  scene.add.text(WORLD_WIDTH - 12, GAME_HEIGHT - 12, APP_VERSION, {
    fontFamily: 'sans-serif',
    fontSize:   '12px',
    color,
  }).setOrigin(1, 1);
}
