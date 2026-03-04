import Phaser from 'phaser';
import { ObstacleBase } from './ObstacleBase';
import { COLORS, GATE_GAP_WIDTH, GATE_POLE_RADIUS } from '@/data/constants';

const POLE_H       = 64;   // visual height of each pole
const BANNER_H     = 14;   // horizontal flag/banner thickness

export type GateColor = 'red' | 'blue';

export class SlalomGate extends ObstacleBase {
  /** Gap between the inner edges of the two poles */
  readonly gapWidth: number = GATE_GAP_WIDTH;

  readonly color: GateColor;

  /** True once the player has scrolled past this gate's worldY */
  isPassed = false;

  // Each pole is treated as a separate point for collision.
  // hitRadius is used for the pole cylinders.
  readonly hitRadius = GATE_POLE_RADIUS;

  // World-space X of each pole centre
  get leftPoleX():  number { return this.worldX - this.gapWidth / 2; }
  get rightPoleX(): number { return this.worldX + this.gapWidth / 2; }

  constructor(scene: Phaser.Scene, worldX: number, worldY: number, color: GateColor, isFinish?: boolean) {
    super(worldX, worldY);
    this.color = color;

    const gfx      = scene.add.graphics();
    const halfGap  = this.gapWidth / 2;
    const halfPole = GATE_POLE_RADIUS;

    // Drop shadows under poles
    gfx.fillStyle(0x000000, 0.12);
    gfx.fillEllipse(-halfGap, POLE_H / 2 + 4, halfPole * 4, 8);
    gfx.fillEllipse( halfGap, POLE_H / 2 + 4, halfPole * 4, 8);

    if (isFinish) {
      // Finish gate: black-and-white striped poles
      const stripeH = POLE_H / 4;
      for (let i = 0; i < 4; i++) {
        gfx.fillStyle(i % 2 === 0 ? 0x111111 : 0xffffff, 1);
        const y = -POLE_H / 2 + i * stripeH;
        gfx.fillRect(-halfGap - halfPole, y, halfPole * 2, stripeH);
        gfx.fillRect( halfGap - halfPole, y, halfPole * 2, stripeH);
      }

      // Checkered banner
      const cellW = 20;
      const cellH = BANNER_H;
      const cols  = Math.floor(this.gapWidth / cellW);
      for (let c = 0; c < cols; c++) {
        gfx.fillStyle(c % 2 === 0 ? 0x111111 : 0xffffff, 1);
        gfx.fillRect(-halfGap + c * cellW, -cellH / 2, cellW, cellH);
      }
    } else {
      const colorVal = color === 'red' ? COLORS.GATE_LEFT : COLORS.GATE_RIGHT;

      // Left pole body
      gfx.fillStyle(colorVal, 1);
      gfx.fillRect(-halfGap - halfPole, -POLE_H / 2, halfPole * 2, POLE_H);

      // Right pole body
      gfx.fillRect(halfGap - halfPole, -POLE_H / 2, halfPole * 2, POLE_H);

      // White stripe on each pole (decorative)
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(-halfGap - halfPole, -POLE_H / 2 + 4, halfPole * 2, 10);
      gfx.fillRect( halfGap - halfPole, -POLE_H / 2 + 4, halfPole * 2, 10);

      // Horizontal banner connecting the poles
      gfx.fillStyle(colorVal, 0.80);
      gfx.fillRect(-halfGap, -BANNER_H / 2, this.gapWidth, BANNER_H);

      // Banner centre stripe (white) for visibility
      gfx.fillStyle(0xffffff, 0.50);
      gfx.fillRect(-halfGap + 8, -3, this.gapWidth - 16, 6);
    }

    this.container = scene.add.container(worldX, 9_999, [gfx]);
    this.container.setDepth(3);
  }
}
