import Phaser from 'phaser';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { HighScoreManager } from '@/data/HighScoreManager';

export const APP_VERSION = 'v0.3.5.1-pre-alpha';

export function addVersionLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  scene.add.text(WORLD_WIDTH - 27, GAME_HEIGHT - 27, APP_VERSION, {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color,
  }).setOrigin(1, 1);
}

export function addUsernameLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  const claimed  = HighScoreManager.load().usernameClaimed ?? false;
  const dotColor = claimed ? '#4caf50' : '#888888';

  const dotText = scene.add.text(27, GAME_HEIGHT - 27, '● ', {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color:      dotColor,
  }).setOrigin(0, 1);

  scene.add.text(27 + dotText.displayWidth, GAME_HEIGHT - 27, HighScoreManager.getOrCreateUsername(), {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color,
  }).setOrigin(0, 1);
}
