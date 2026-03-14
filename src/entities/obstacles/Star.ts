import Phaser from 'phaser';
import { DEPTH } from '@/data/constants';
import { ObstacleBase } from './ObstacleBase';

const STAR_RADIUS = 18;
const STAR_COLOR  = 0xffd700;
const GLOW_COLOR  = 0xffee44;

export class Star extends ObstacleBase {
  readonly hitRadius = STAR_RADIUS;
  private collected  = false;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number) {
    super(worldX, worldY);

    const gfx = scene.add.graphics();
    this.drawStar(gfx);

    this.container = scene.add.container(worldX, 0, [gfx]);
    this.container.setDepth(DEPTH.OBSTACLES);
    this.container.setScale(1.5);

    // Yellow glow pulse
    scene.tweens.add({
      targets:  this.container,
      scaleX:   1.7,
      scaleY:   1.7,
      duration: 600,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Slow rotation
    scene.tweens.add({
      targets:  this.container,
      angle:    360,
      duration: 3000,
      repeat:   -1,
      ease:     'Linear',
    });
  }

  isCollected(): boolean { return this.collected; }

  collect(): void {
    this.collected = true;
    this.container.destroy();
  }

  override setScreenY(screenY: number): void {
    if (this.collected) return;
    super.setScreenY(screenY);
  }

  override destroy(): void {
    if (!this.collected) super.destroy();
  }

  private drawStar(g: Phaser.GameObjects.Graphics): void {
    const outerR = 16;
    const innerR = 7;
    const points = 5;

    // Glow layers
    const GLOW_LAYERS = [
      { pad: 18, alpha: 0.06 },
      { pad: 12, alpha: 0.10 },
      { pad:  6, alpha: 0.16 },
      { pad:  2, alpha: 0.22 },
    ] as const;
    for (const { pad, alpha } of GLOW_LAYERS) {
      g.fillStyle(GLOW_COLOR, alpha);
      g.fillCircle(0, 0, outerR + pad);
    }

    // Star body
    g.fillStyle(STAR_COLOR, 1);
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r     = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / 2 * 3) + (Math.PI / points) * i;
      const px    = Math.cos(angle) * r;
      const py    = Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else         g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();

    // Star outline
    g.lineStyle(1.5, 0xcc9900, 1);
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r     = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / 2 * 3) + (Math.PI / points) * i;
      const px    = Math.cos(angle) * r;
      const py    = Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else         g.lineTo(px, py);
    }
    g.closePath();
    g.strokePath();

    // Smiley face
    // Eyes
    g.fillStyle(0x000000, 1);
    g.fillCircle(-4, -2, 1.8);
    g.fillCircle( 4, -2, 1.8);

    // Smile arc
    g.lineStyle(1.5, 0x000000, 1);
    g.beginPath();
    g.arc(0, 0, 5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    g.strokePath();
  }
}
