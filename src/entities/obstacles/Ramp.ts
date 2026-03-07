import Phaser from 'phaser';
import { ObstacleBase } from './ObstacleBase';
import { DEPTH } from '@/data/constants';

// Top-down dimensions: wider than deep (horizontal platform)
const RAMP_W     = 70;   // px horizontal width
const RAMP_D     = 28;   // px vertical depth (screen-Y)
const HIT_RADIUS = 28;   // generous — ramp should be easy to trigger

// Corner radii for the platform shape
const CORNER = 7;

export class Ramp extends ObstacleBase {
  readonly hitRadius = HIT_RADIUS;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number) {
    super(worldX, worldY);

    const gfx   = scene.add.graphics();
    const hw    = RAMP_W / 2;
    const hd    = RAMP_D / 2;
    const lipH  = 7;   // thickness of the front launch-lip

    // --- Drop shadow cast downward (ramp is elevated) ---
    gfx.fillStyle(0x000000, 0.18);
    gfx.fillRoundedRect(-hw + 4, hd - 2, RAMP_W, 10, 4);

    // --- Main ramp platform (packed snow surface, viewed from above) ---
    gfx.fillStyle(0xd0dce8, 1);
    gfx.fillRoundedRect(-hw, -hd, RAMP_W, RAMP_D, CORNER);

    // --- Upper highlight — entry side looks lighter (gradual approach) ---
    gfx.fillStyle(0xeaf4ff, 0.70);
    gfx.fillRoundedRect(-hw + 4, -hd + 2, RAMP_W - 8, RAMP_D * 0.45, CORNER - 2);

    // --- Front launch lip — dark bar at the bottom edge ---
    // This is the raised edge the skier's skis catch to launch them
    gfx.fillStyle(0x6888a8, 1);
    gfx.fillRoundedRect(
      -hw, hd - lipH,
      RAMP_W, lipH,
      { tl: 0, tr: 0, bl: CORNER, br: CORNER },
    );

    // --- Yellow direction arrow — single polygon: shaft + arrowhead ---
    // "Down" = direction of travel, telling the player this is a launch ramp
    // Drawing as one closed path lets us fill and stroke it without junction gaps.
    const asx  = 3;           // shaft half-width
    const asy1 = -hd + 5;    // shaft top y   (= -9)
    const asy2 = -hd + 14;   // junction y    (=  0)
    const ahw  = 11;          // arrowhead half-width
    const atip = hd - lipH - 2; // tip y      (=  5)

    const drawArrow = (): void => {
      gfx.beginPath();
      gfx.moveTo(-asx, asy1);
      gfx.lineTo( asx, asy1);
      gfx.lineTo( asx, asy2);
      gfx.lineTo( ahw, asy2);
      gfx.lineTo(   0, atip);
      gfx.lineTo(-ahw, asy2);
      gfx.lineTo(-asx, asy2);
      gfx.closePath();
    };

    gfx.fillStyle(0xffee00, 0.92);
    drawArrow();
    gfx.fillPath();

    gfx.lineStyle(1.5, 0x000000, 0.80);
    drawArrow();
    gfx.strokePath();

    // --- Outline to define the platform boundary ---
    gfx.lineStyle(1.5, 0x8aaccc, 0.8);
    gfx.strokeRoundedRect(-hw, -hd, RAMP_W, RAMP_D, CORNER);

    this.container = scene.add.container(worldX, 9_999, [gfx]);
    this.container.setDepth(DEPTH.GROUND);
  }
}
