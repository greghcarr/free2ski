import Phaser from 'phaser';
import { ObstacleBase } from './ObstacleBase';
import { COLORS, DEPTH, GATE_GAP_WIDTH, GATE_POLE_RADIUS, GAME_HEIGHT } from '@/data/constants';

const POLE_H       = 64;   // visual height of each pole
const BANNER_H     = 14;   // horizontal flag/banner thickness
const CULL_PADDING = 80;

export type GateColor = 'red' | 'blue';

export class SlalomGate extends ObstacleBase {
  /** Gap between the inner edges of the two poles */
  readonly gapWidth: number = GATE_GAP_WIDTH;

  readonly color: GateColor;

  /** True once the player has scrolled past this gate's worldY */
  isPassed = false;

  readonly hitRadius = GATE_POLE_RADIUS;

  get leftPoleX():  number { return this.worldX - this.gapWidth / 2; }
  get rightPoleX(): number { return this.worldX + this.gapWidth / 2; }

  // Separate container for the banner so it renders below the player
  private bannerContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number, color: GateColor, isFinish?: boolean, gateNumber?: number) {
    super(worldX, worldY);
    this.color = color;

    const halfGap  = this.gapWidth / 2;
    const halfPole = GATE_POLE_RADIUS;

    // --- Banner layer (renders below the player) ---
    const bannerGfx = scene.add.graphics();

    if (isFinish) {
      const cellW = 20;
      const cols  = Math.floor(this.gapWidth / cellW);
      for (let c = 0; c < cols; c++) {
        bannerGfx.fillStyle(c % 2 === 0 ? 0x111111 : 0xffffff, 1);
        bannerGfx.fillRect(-halfGap + c * cellW, -BANNER_H / 2, cellW, BANNER_H);
      }
    } else {
      const colorVal = color === 'red' ? COLORS.GATE_LEFT : COLORS.GATE_RIGHT;
      bannerGfx.fillStyle(colorVal, 0.80);
      bannerGfx.fillRect(-halfGap, -BANNER_H / 2, this.gapWidth, BANNER_H);
      bannerGfx.fillStyle(0xffffff, 0.50);
      bannerGfx.fillRect(-halfGap + 8, -3, this.gapWidth - 16, 6);
    }

    this.bannerContainer = scene.add.container(worldX, 9_999, [bannerGfx]);
    this.bannerContainer.setDepth(DEPTH.GROUND);

    // --- Poles layer (renders above the player) ---
    const poleGfx = scene.add.graphics();

    // Drop shadows just below the gate line
    poleGfx.fillStyle(0x000000, 0.12);
    poleGfx.fillEllipse(-halfGap, BANNER_H / 2 + 4, halfPole * 4, 8);
    poleGfx.fillEllipse( halfGap, BANNER_H / 2 + 4, halfPole * 4, 8);

    if (isFinish) {
      const stripeH = POLE_H / 4;
      for (let i = 0; i < 4; i++) {
        poleGfx.fillStyle(i % 2 === 0 ? 0x111111 : 0xffffff, 1);
        const y = -POLE_H + i * stripeH;
        poleGfx.fillRect(-halfGap - halfPole, y, halfPole * 2, stripeH);
        poleGfx.fillRect( halfGap - halfPole, y, halfPole * 2, stripeH);
      }
    } else {
      const colorVal = color === 'red' ? COLORS.GATE_LEFT : COLORS.GATE_RIGHT;
      poleGfx.fillStyle(colorVal, 1);
      poleGfx.fillRect(-halfGap - halfPole, -POLE_H, halfPole * 2, POLE_H);
      poleGfx.fillRect( halfGap - halfPole, -POLE_H, halfPole * 2, POLE_H);
      poleGfx.fillStyle(0xffffff, 1);
      poleGfx.fillRect(-halfGap - halfPole, -POLE_H + 4, halfPole * 2, 10);
      poleGfx.fillRect( halfGap - halfPole, -POLE_H + 4, halfPole * 2, 10);
    }

    const poleChildren: Phaser.GameObjects.GameObject[] = [poleGfx];

    if (gateNumber !== undefined) {
      const numStr = String(gateNumber);
      const style = { fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#222222' };
      const labelY = -POLE_H / 2;
      poleChildren.push(
        scene.add.text(-halfGap, labelY, numStr, style).setOrigin(0.5, 0.5).setAlpha(0.55),
        scene.add.text( halfGap, labelY, numStr, style).setOrigin(0.5, 0.5).setAlpha(0.55),
      );
    }

    this.container = scene.add.container(worldX, 9_999, poleChildren);
    this.container.setDepth(DEPTH.OBSTACLES);
  }

  override setScreenY(screenY: number): void {
    const visible = screenY > -CULL_PADDING && screenY < GAME_HEIGHT + CULL_PADDING;
    this.container.y = screenY;
    this.container.setVisible(visible);
    this.bannerContainer.y = screenY;
    this.bannerContainer.setVisible(visible);
  }

  override destroy(): void {
    this.container.destroy();
    this.bannerContainer.destroy();
  }
}
