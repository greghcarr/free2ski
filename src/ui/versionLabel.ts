import Phaser from 'phaser';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { HighScoreManager } from '@/data/HighScoreManager';

export const APP_VERSION = 'v0.3.0-pre-alpha';

export function addVersionLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  scene.add.text(WORLD_WIDTH - 27, GAME_HEIGHT - 27, APP_VERSION, {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color,
  }).setOrigin(1, 1);
}

export function addUsernameLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  scene.add.text(27, GAME_HEIGHT - 27, HighScoreManager.getOrCreateUsername(), {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color,
  }).setOrigin(0, 1);
}
