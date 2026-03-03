import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, PX_PER_METER } from '@/data/constants';
import type { SessionConfig } from '@/config/GameConfig';
import { GameMode } from '@/config/GameModes';

export interface GameOverData {
  session: SessionConfig;
  distancePx: number;
  score: number;
  caughtByYeti: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.GameOver });
  }

  init(data: Partial<GameOverData>): void {
    const distanceM = Math.floor((data.distancePx ?? 0) / PX_PER_METER);
    const session = data.session ?? { mode: GameMode.FreeSki };
    const score = data.score ?? 0;
    const caughtByYeti = data.caughtByYeti ?? false;

    this.buildUI(distanceM, score, session, caughtByYeti);
  }

  create(): void {}

  private buildUI(
    distanceM: number,
    score: number,
    session: SessionConfig,
    caughtByYeti: boolean,
  ): void {
    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1a2a, 0x0a1a2a, 0x1a2a3a, 0x1a2a3a, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    const headline = caughtByYeti ? 'THE YETI GOT YOU' : 'WIPEOUT';
    this.add.text(WORLD_WIDTH / 2, 140, headline, {
      fontFamily: 'sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: caughtByYeti ? '#d8e8f8' : '#e63030',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, 240, `Distance: ${distanceM} m`, {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(WORLD_WIDTH / 2, 296, `Score: ${score.toLocaleString()}`, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#aaddff',
    }).setOrigin(0.5);

    this.createButton(WORLD_WIDTH / 2, 400, 'PLAY AGAIN', () => {
      this.scene.start(SceneKey.Game, { session });
    });

    this.createButton(WORLD_WIDTH / 2, 476, 'MAIN MENU', () => {
      this.scene.start(SceneKey.MainMenu);
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btnW = 260;
    const btnH = 54;
    const bg = this.add.graphics();
    const draw = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? 0x3a6ae8 : 0x2a5ab8, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
    };
    draw(false);
    this.add.text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);
  }
}
