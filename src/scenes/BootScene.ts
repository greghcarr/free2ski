import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { DEFAULT_SETTINGS } from '@/config/GameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Boot });
  }

  create(): void {
    // Load saved settings from localStorage and store in registry
    const savedRaw = localStorage.getItem('skifree_settings');
    const settings = savedRaw ? JSON.parse(savedRaw) : { ...DEFAULT_SETTINGS };
    this.registry.set('settings', settings);

    this.scene.start(SceneKey.Preload);
  }
}
