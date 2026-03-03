import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { GameMode, GAME_MODE_CONFIGS } from '@/config/GameModes';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';

const MODES = [GameMode.FreeSki, GameMode.Slalom, GameMode.TreeSlalom, GameMode.Jump];

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.ModeSelect });
  }

  create(): void {
    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.add.text(WORLD_WIDTH / 2, 60, 'SELECT MODE', {
      fontFamily: 'sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#1a3a8a',
    }).setOrigin(0.5);

    const cardW = 240;
    const cardH = 260;
    const spacing = 20;
    const totalW = MODES.length * cardW + (MODES.length - 1) * spacing;
    const startX = (WORLD_WIDTH - totalW) / 2 + cardW / 2;

    MODES.forEach((mode, i) => {
      const cfg = GAME_MODE_CONFIGS[mode];
      const cx = startX + i * (cardW + spacing);
      const cy = GAME_HEIGHT / 2 + 30;
      this.createModeCard(cx, cy, cardW, cardH, cfg.displayName, cfg.description, () => {
        const session: SessionConfig = { mode, seed: Date.now() };
        this.scene.start(SceneKey.Game, { session });
      });
    });

    // Back button
    this.add.text(60, GAME_HEIGHT - 50, '← Back', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#1a3a8a',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu));
  }

  private createModeCard(
    cx: number,
    cy: number,
    w: number,
    h: number,
    title: string,
    desc: string,
    onClick: () => void,
  ): void {
    const bg = this.add.graphics();
    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? 0xd0dcec : 0xe8f0f8, 1);
      bg.lineStyle(2, 0x2a5ab8, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    };
    draw(false);

    this.add.text(cx, cy - h / 2 + 36, title, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#1a3a8a',
    }).setOrigin(0.5);

    this.add.text(cx, cy - h / 2 + 80, desc, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#3a5a9a',
      wordWrap: { width: w - 24 },
      align: 'center',
    }).setOrigin(0.5, 0);

    const hit = this.add.rectangle(cx, cy, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);
  }
}
