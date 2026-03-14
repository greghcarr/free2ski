import Phaser from 'phaser';
import { DEPTH } from '@/data/constants';
import { ObstacleBase } from './ObstacleBase';

const LIGHTNING_RADIUS = 18;
const BOLT_COLOR       = 0xffdd00;
const GLOW_COLOR       = 0x44ddff;

export class Lightning extends ObstacleBase {
  readonly hitRadius = LIGHTNING_RADIUS;
  private collected  = false;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number) {
    super(worldX, worldY);

    const gfx = scene.add.graphics();
    this.drawBolt(gfx);

    this.container = scene.add.container(worldX, 0, [gfx]);
    this.container.setDepth(DEPTH.OBSTACLES);
    this.container.setScale(1.5);

    // Electric pulse
    scene.tweens.add({
      targets:  this.container,
      scaleX:   1.7,
      scaleY:   1.7,
      duration: 400,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
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

  private drawBolt(g: Phaser.GameObjects.Graphics): void {
    // Glow layers
    const GLOW_LAYERS = [
      { pad: 16, alpha: 0.06 },
      { pad: 10, alpha: 0.10 },
      { pad:  5, alpha: 0.16 },
      { pad:  2, alpha: 0.22 },
    ] as const;
    for (const { pad, alpha } of GLOW_LAYERS) {
      g.fillStyle(GLOW_COLOR, alpha);
      g.fillCircle(0, 0, LIGHTNING_RADIUS + pad);
    }

    // Lightning bolt shape — classic zigzag
    g.fillStyle(BOLT_COLOR, 1);
    g.beginPath();
    g.moveTo(-2, -18);   // top
    g.lineTo(6, -18);
    g.lineTo(1, -4);     // first zag right
    g.lineTo(8, -4);
    g.lineTo(-3, 18);    // bottom point
    g.lineTo(0, 2);      // zag back left
    g.lineTo(-7, 2);
    g.closePath();
    g.fillPath();

    // Bright inner highlight
    g.fillStyle(0xffff88, 0.6);
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(4, -14);
    g.lineTo(1, -4);
    g.lineTo(4, -4);
    g.lineTo(-1, 10);
    g.lineTo(1, 2);
    g.lineTo(-3, 2);
    g.closePath();
    g.fillPath();

    // Outline
    g.lineStyle(1.5, 0xcc9900, 1);
    g.beginPath();
    g.moveTo(-2, -18);
    g.lineTo(6, -18);
    g.lineTo(1, -4);
    g.lineTo(8, -4);
    g.lineTo(-3, 18);
    g.lineTo(0, 2);
    g.lineTo(-7, 2);
    g.closePath();
    g.strokePath();
  }
}
