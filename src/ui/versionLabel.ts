import Phaser from 'phaser';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { HighScoreManager } from '@/data/HighScoreManager';
import { DEBUG_ENABLED } from '@/data/DebugConfig';

export const APP_VERSION = 'v0.4.0.2-pre-alpha';

export function addVersionLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  const label = scene.add.text(WORLD_WIDTH - 27, GAME_HEIGHT - 27, APP_VERSION, {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color,
  }).setOrigin(1, 1).setDepth(2);

  if (DEBUG_ENABLED) {
    scene.add.text(WORLD_WIDTH - 27, GAME_HEIGHT - 27 - label.height - 4, '⚠ DEBUG', {
      fontFamily: 'monospace',
      fontSize:   '26px',
      color:      '#ff2222',
    }).setOrigin(1, 1).setDepth(2);
  }
}

export function addUsernameLabel(scene: Phaser.Scene, color: string = COLORS.VERSION_DEFAULT): void {
  const name     = HighScoreManager.getDisplayName();
  const dotColor = name ? '#4caf50' : '#888888';

  const dotText = scene.add.text(27, GAME_HEIGHT - 27, '● ', {
    fontFamily: 'monospace',
    fontSize:   '26px',
    color:      dotColor,
  }).setOrigin(0, 1).setDepth(2).setStroke(color, 4);

  if (name) {
    scene.add.text(27 + dotText.displayWidth, GAME_HEIGHT - 27, name, {
      fontFamily: 'monospace',
      fontSize:   '26px',
      color,
    }).setOrigin(0, 1).setDepth(2);
  }
}
