import Phaser from 'phaser';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';

export const APP_VERSION = 'v0.2.0-pre-alpha';

export function addVersionLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  scene.add.text(WORLD_WIDTH - 27, GAME_HEIGHT - 27, APP_VERSION, {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color,
  }).setOrigin(1, 1);
}
