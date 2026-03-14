import Phaser from 'phaser';
import { ObstacleBase } from './ObstacleBase';
import { COLORS, DEPTH, GATE_GAP_WIDTH, GATE_POLE_RADIUS, GAME_HEIGHT } from '@/data/constants';

const WIRE_H       = 144;  // visual height of each wire
const WIRE_W       = 3;    // thickness of the wire line
const FLAG_W       = 72;   // width of the triangular flag
const FLAG_H       = 56;   // height of the triangular flag
const FLAG_Y       = -WIRE_H + 12; // top of the flag (near top of wire)
const BANNER_H     = 21;   // horizontal banner thickness
const CULL_PADDING = 120;

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

    if (isFinish) {
      // Thin black wire
      poleGfx.fillStyle(0x111111, 1);
      poleGfx.fillRect(-halfGap - WIRE_W / 2, -WIRE_H, WIRE_W, WIRE_H);
      poleGfx.fillRect( halfGap - WIRE_W / 2, -WIRE_H, WIRE_W, WIRE_H);

      // Black flags facing inward
      poleGfx.fillStyle(0x111111, 1);
      poleGfx.beginPath();
      poleGfx.moveTo(-halfGap, FLAG_Y);
      poleGfx.lineTo(-halfGap + FLAG_W, FLAG_Y + FLAG_H / 2);
      poleGfx.lineTo(-halfGap, FLAG_Y + FLAG_H);
      poleGfx.closePath();
      poleGfx.fillPath();
      poleGfx.beginPath();
      poleGfx.moveTo(halfGap, FLAG_Y);
      poleGfx.lineTo(halfGap - FLAG_W, FLAG_Y + FLAG_H / 2);
      poleGfx.lineTo(halfGap, FLAG_Y + FLAG_H);
      poleGfx.closePath();
      poleGfx.fillPath();
    } else {
      const colorVal = color === 'red' ? COLORS.GATE_LEFT : COLORS.GATE_RIGHT;

      // Thin black wire
      poleGfx.fillStyle(0x111111, 1);
      poleGfx.fillRect(-halfGap - WIRE_W / 2, -WIRE_H, WIRE_W, WIRE_H);
      poleGfx.fillRect( halfGap - WIRE_W / 2, -WIRE_H, WIRE_W, WIRE_H);

      // Flags facing inward — left flag points right, right flag points left
      poleGfx.fillStyle(colorVal, 1);
      // Left pole flag (points right toward gap)
      poleGfx.beginPath();
      poleGfx.moveTo(-halfGap, FLAG_Y);
      poleGfx.lineTo(-halfGap + FLAG_W, FLAG_Y + FLAG_H / 2);
      poleGfx.lineTo(-halfGap, FLAG_Y + FLAG_H);
      poleGfx.closePath();
      poleGfx.fillPath();
      // Right pole flag (points left toward gap)
      poleGfx.beginPath();
      poleGfx.moveTo(halfGap, FLAG_Y);
      poleGfx.lineTo(halfGap - FLAG_W, FLAG_Y + FLAG_H / 2);
      poleGfx.lineTo(halfGap, FLAG_Y + FLAG_H);
      poleGfx.closePath();
      poleGfx.fillPath();
    }

    const poleChildren: Phaser.GameObjects.GameObject[] = [poleGfx];

    if (gateNumber !== undefined) {
      const numStr = String(gateNumber);
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: 'sans-serif', fontSize: '44px', fontStyle: 'bold', color: '#ffffff',
      };
      const labelY = FLAG_Y + FLAG_H / 2;
      // Offset labels inward onto the flags
      poleChildren.push(
        scene.add.text(-halfGap + FLAG_W * 0.4, labelY, numStr, style).setOrigin(0.5, 0.5),
        scene.add.text( halfGap - FLAG_W * 0.4, labelY, numStr, style).setOrigin(0.5, 0.5),
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
