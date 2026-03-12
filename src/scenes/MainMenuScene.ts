import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, MAIN_MENU_BADGE_TEXT } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';
import { fetchTotalRuns } from '@/services/LeaderboardService';

const BADGE_PHRASES = [
  'skis freed',
  'runs runned',
  'slaloms slalomed',
  'yetis outrun',
  'wipeouts wiped',
  'mountains descended',
  'slopes shredded',
  'chairlifts skipped',
  'spines compressed',
  'hot chocolates earned',
  'ankles twisted',
  'ski pants worn',
  'goggles fogged',
  'lodge fireplaces deserved',
  'snow eaten facefirst',
  'ski instructors disappointed',
  'lift tickets wasted',
  'moguls mogulled',
  'black diamonds survived',
  'avalanches not caused',
  'trees narrowly avoided',
  'poles abandoned mid-slope',
  'bindings blamed',
  'beers justified',
  "pizza wedges pizza'd",
];

interface SnowFlake {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  alpha: number;
}

export class MainMenuScene extends Phaser.Scene {
  private snowGfx!: Phaser.GameObjects.Graphics;
  private flakes: SnowFlake[] = [];

  constructor() {
    super({ key: SceneKey.MainMenu });
  }

  create(): void {
    this.flakes = [];
    this.buildBackground();

    // Snow layer — drawn above background art, below UI text
    this.snowGfx = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      this.flakes.push({
        x:     Math.random() * WORLD_WIDTH,
        y:     Math.random() * GAME_HEIGHT,
        r:     Math.random() * 2 + 0.5,
        speed: Math.random() * 50 + 20,
        drift: (Math.random() - 0.5) * 15,
        alpha: Math.random() * 0.4 + 0.3,
      });
    }

    // Title — slides in from above, then floats
    const title = this.add.text(WORLD_WIDTH / 2, -260, 'free2ski', {
      fontFamily:      'FoxwhelpFont',
      fontSize:        '280px',
      fontStyle:       'bold',
      color:           '#ffffff',
      stroke:          '#1a3a8a',
      strokeThickness: 14,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets:  title,
      y:        420,
      alpha:    1,
      duration: 900,
      ease:     'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets:  title,
          y:        430,
          duration: 3000,
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        });
      },
    });

    // Badge
    const badge = this.add.text(1300, 320, '', {
      fontFamily:      'FoxwhelpFont',
      fontSize:        '72px',
      fontStyle:       'bold',
      color:           '#FFD700',
      stroke:          '#001a6e',
      strokeThickness: 10,
    }).setOrigin(0.5).setAngle(12).setScale(0.01);

    const revealBadge = (text: string): void => {
      badge.setText(text);
      this.tweens.add({
        targets:  badge,
        scaleX:   1,
        scaleY:   1,
        duration: 400,
        ease:     'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets:  badge,
            scaleX:   1.15,
            scaleY:   1.15,
            duration: 700,
            yoyo:     true,
            repeat:   -1,
            ease:     'Sine.easeInOut',
          });
        },
      });
    };

    const phrase = BADGE_PHRASES[Math.floor(Math.random() * BADGE_PHRASES.length)]!;
    fetchTotalRuns()
      .then(n  => revealBadge(`${phrase}: ${n.toLocaleString()}`))
      .catch(() => revealBadge(MAIN_MENU_BADGE_TEXT));

    // Buttons — staggered slide + fade entrance
    let nav: MenuNav | undefined;
    const playItem        = this.createButton(WORLD_WIDTH / 2, 610, 650, 145, 'play',         100, 'bold', () => { this.scene.start(SceneKey.ModeSelect); },   () => nav?.hoverAt(0), 150);
    const leaderboardItem = this.createButton(WORLD_WIDTH / 2, 750, 410, 105, 'leaderboard',   50, 'bold', () => { this.scene.start(SceneKey.Leaderboard); }, () => nav?.hoverAt(1), 260);
    const settingsItem    = this.createButton(WORLD_WIDTH / 2, 880, 410,  105, 'settings',      60, 'bold', () => { this.scene.start(SceneKey.Settings); },    () => nav?.hoverAt(2), 370);
    const patchNotesItem  = this.createButton(WORLD_WIDTH / 2, 1010, 410,  105, 'patch notes',   44, 'bold', () => { this.scene.start(SceneKey.PatchNotes); }, () => nav?.hoverAt(3), 480);
    nav = new MenuNav(this, [playItem, leaderboardItem, settingsItem, patchNotesItem]);

    addVersionLabel(this);
    addUsernameLabel(this);
  }

  update(_time: number, delta: number): void {
    if (!this.snowGfx?.active) return;
    const dt = delta / 1000;
    this.snowGfx.clear();
    for (const f of this.flakes) {
      f.y += f.speed * dt;
      f.x += f.drift * dt;
      if (f.y > GAME_HEIGHT + 8) { f.y = -8; f.x = Math.random() * WORLD_WIDTH; }
      if (f.x < -8)              f.x = WORLD_WIDTH + 8;
      if (f.x > WORLD_WIDTH + 8) f.x = -8;
      this.snowGfx.fillStyle(0xffffff, f.alpha);
      this.snowGfx.fillCircle(f.x, f.y, f.r);
    }
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Sky: deep navy at top → horizon blue at bottom
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x1e3d6e, 0x1e3d6e, 0x6a9ecc, 0x6a9ecc, 1);
    sky.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Far mountains (lighter, tall peaks)
    const farMtn = this.add.graphics();
    farMtn.fillStyle(0x8ab0cc, 0.85);
    this.fillMountainPath(farMtn, [
      [0, 770], [320, 180], [620, 400], [960, 100], [1300, 350], [1600, 160], [1920, 770],
    ], 775);

    // Snow caps on far mountain peaks
    const farCaps = this.add.graphics();
    farCaps.fillStyle(0xeef4fc, 0.95);
    for (const [px, py, cw] of [[320, 180, 85], [960, 100, 105], [1600, 160, 90]] as [number, number, number][]) {
      farCaps.fillTriangle(px, py, px - cw, py + cw * 0.65, px + cw, py + cw * 0.65);
    }

    // Near mountains (darker, lower peaks — in front of far layer)
    const nearMtn = this.add.graphics();
    nearMtn.fillStyle(0x3d6a88, 1);
    this.fillMountainPath(nearMtn, [
      [0, 810], [220, 490], [520, 590], [840, 430], [1120, 545], [1420, 465], [1700, 550], [1920, 810],
    ], 820);

    // Snowy ground
    const ground = this.add.graphics();
    ground.fillGradientStyle(0xc8dde8, 0xc8dde8, 0xe8f4fc, 0xe8f4fc, 1);
    ground.fillRect(0, 820, WORLD_WIDTH, GAME_HEIGHT - 820);
    ground.lineStyle(1, 0xffffff, 0.4);
    ground.lineBetween(0, 820, WORLD_WIDTH, 820);

    // Trees — left cluster
    this.drawMenuTree( 40,  895, 0.80);
    this.drawMenuTree(120,  870, 1.05);
    this.drawMenuTree(210,  898, 0.90);
    this.drawMenuTree(285,  882, 0.65);

    // Trees — right cluster
    this.drawMenuTree(WORLD_WIDTH -  40, 895, 0.80);
    this.drawMenuTree(WORLD_WIDTH - 120, 870, 1.05);
    this.drawMenuTree(WORLD_WIDTH - 210, 898, 0.90);
    this.drawMenuTree(WORLD_WIDTH - 285, 882, 0.65);

    // v0.3.5 — star on the tallest left tree
    this.drawTreeStar(120, 870, 1.05);

    // Campfire scene — skier sitting in the snow on the right side
    this.drawLodgeScene();
  }

  /** Fill a mountain silhouette as a series of quads between consecutive peak points. */
  private fillMountainPath(
    g: Phaser.GameObjects.Graphics,
    pts: [number, number][],
    baseY: number,
  ): void {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      g.fillTriangle(ax, baseY, ax, ay, bx, by);
      g.fillTriangle(ax, baseY, bx, by, bx, baseY);
    }
  }

  /** Glowing star perched on the tip of a tree (matches drawMenuTree geometry). */
  private drawTreeStar(cx: number, baseY: number, scale: number): void {
    const tipY   = baseY - 160 * scale;
    const cy     = tipY - 14;
    const outerR = 13;
    const innerR = 5;

    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * (Math.PI / 5);
      const r     = i % 2 === 0 ? outerR : innerR;
      pts.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
    }

    const glow = this.add.graphics().setPosition(cx, cy);
    glow.fillStyle(0xffff99, 0.35);
    glow.fillCircle(0, 0, 22);
    this.tweens.add({
      targets: glow, alpha: 0,
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const star = this.add.graphics().setPosition(cx, cy);
    star.fillStyle(0xFFE44D, 1);
    star.fillPoints(pts, true);
    this.tweens.add({
      targets: star, alpha: 0.55,
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 350,
    });
  }

  /** Draw a simple layered pine tree centred at (cx, baseY). */
  private drawMenuTree(cx: number, baseY: number, scale: number): void {
    const g = this.add.graphics();
    const h  = 160 * scale;
    const tipY = baseY - h;

    // Trunk
    g.fillStyle(COLORS.TREE_TRUNK, 1);
    g.fillRect(cx - 7 * scale, baseY - 22 * scale, 14 * scale, 22 * scale);

    // Canopy layers — each drawn on top of the previous
    const layers: [number, number, number][] = [
      [0.00, h * 0.50, COLORS.TREE_DARK],
      [0.28, h * 0.36, COLORS.TREE_MID],
      [0.54, h * 0.24, COLORS.TREE_TOP],
    ];
    for (const [yFrac, hw, color] of layers) {
      const layerBase = baseY - h * yFrac;
      g.fillStyle(color, 1);
      g.fillTriangle(cx, tipY, cx - hw, layerBase, cx + hw, layerBase);
      // Snow cap on upper ~28% of layer
      const snowBase = Phaser.Math.Linear(tipY, layerBase, 0.28);
      g.fillStyle(COLORS.TREE_SNOW, 0.85);
      g.fillTriangle(cx, tipY, cx - hw * 0.28, snowBase, cx + hw * 0.28, snowBase);
    }
  }

  /**
   * Draws a campfire scene in the lower-right snow area:
   *   crossed skis  →  skier sitting  →  campfire
   * All elements are purely vector Graphics with tween-based fire animation.
   */
  private drawLodgeScene(): void {
    const sX   = 1430;   // skier horizontal anchor
    const fX   = 1594;   // fire horizontal anchor
    const gndY = 983;    // shared ground level

    /** Fill a rotated rectangle centred at (cx, cy). */
    const rr = (
      g: Phaser.GameObjects.Graphics,
      cx: number, cy: number,
      len: number, w: number,
      angle: number,
    ): void => {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const hl = len / 2,         hw  = w / 2;
      g.fillPoints([
        { x: cx + hl * cos - hw * sin, y: cy + hl * sin + hw * cos },
        { x: cx + hl * cos + hw * sin, y: cy + hl * sin - hw * cos },
        { x: cx - hl * cos + hw * sin, y: cy - hl * sin - hw * cos },
        { x: cx - hl * cos - hw * sin, y: cy - hl * sin + hw * cos },
      ], true);
    };

    // ─── Warm fire glow (drawn first, behind everything) ─────────────────────
    const warmGlow = this.add.graphics();
    warmGlow.fillStyle(0xff6600, 0.13);
    warmGlow.fillEllipse(fX, gndY - 42, 230, 110);
    this.tweens.add({
      targets: warmGlow, alpha: 0.5,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ─── Ground shadow beneath skier ─────────────────────────────────────────
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000020, 0.18);
    shadow.fillEllipse(sX + 20, gndY - 2, 155, 18);

    // ─── Skis planted upright in snow ────────────────────────────────────────
    const skiCX = sX - 168;
    // At angle 1.1 rad, sin≈0.891 × hl 90 = 80 px vertical reach,
    // so skiCY = gndY - 80 puts the tails exactly at the snow surface.
    const skiCY = gndY - 80;
    const ski1A =  1.1;   // leans top-left / tail enters snow to the right
    const ski2A = -1.1;   // mirror
    const skiHL = 90;
    const skis  = this.add.graphics();

    // Ski 1 body (behind ski 2)
    skis.fillStyle(0x0e0e18, 1);
    rr(skis, skiCX, skiCY, skiHL * 2, 11, ski1A);
    // Ski 2 body (in front, covers the crossing)
    rr(skis, skiCX, skiCY, skiHL * 2, 11, ski2A);

    // Coloured tips — top ends sticking up out of the snow
    // Ski 1 tip is in the negative direction (top-left)
    skis.fillStyle(COLORS.PLAYER, 1);
    rr(skis,
      skiCX - (skiHL - 15) * Math.cos(ski1A),
      skiCY - (skiHL - 15) * Math.sin(ski1A),
      30, 11, ski1A);
    // Ski 2 tip is in the positive direction (top-right)
    rr(skis,
      skiCX + (skiHL - 15) * Math.cos(ski2A),
      skiCY + (skiHL - 15) * Math.sin(ski2A),
      30, 11, ski2A);

    // Binding highlight at the crossing point
    skis.fillStyle(COLORS.PLAYER_SUIT, 1);
    skis.fillRect(skiCX - 9, skiCY - 6, 18, 12);

    // ─── Log the skier is sitting on ─────────────────────────────────────────
    const sitLog = this.add.graphics();
    // Shadow under log
    sitLog.fillStyle(0x000020, 0.14);
    sitLog.fillEllipse(sX - 10, gndY - 1, 210, 14);
    // Log body (bottom at gndY, top at gndY-32 — matches hip height)
    sitLog.fillStyle(COLORS.TREE_TRUNK, 1);
    sitLog.fillRoundedRect(sX - 112, gndY - 32, 202, 32, 5);
    // Grain highlight along the top surface
    sitLog.fillStyle(0x7a5232, 1);
    sitLog.fillRoundedRect(sX - 112, gndY - 32, 202, 9, 4);
    // Left end — visible cross-section
    sitLog.fillStyle(0x3a2010, 1);
    sitLog.fillEllipse(sX - 112, gndY - 16, 25, 32);
    // Annual rings
    sitLog.lineStyle(2, 0x5c3a1e, 0.65);
    sitLog.strokeEllipse(sX - 112, gndY - 16, 17, 22);
    sitLog.strokeEllipse(sX - 112, gndY - 16, 9, 11);
    sitLog.fillStyle(0x5c3a1e, 1);
    sitLog.fillCircle(sX - 112, gndY - 16, 3);

    // ─── Legs — pants & boots ────────────────────────────────────────────────
    const legs = this.add.graphics();
    legs.fillStyle(0x2a2a3a, 1);
    rr(legs, sX + 18, gndY - 32, 90, 25, 0.12);   // upper thigh (forward)
    rr(legs, sX + 55, gndY - 10, 36, 21, 0.52);   // lower leg (bent down)
    // Boots
    legs.fillStyle(0x16161e, 1);
    legs.fillRoundedRect(sX + 42, gndY - 22, 42, 22, 5);

    // ─── Jacket & torso ──────────────────────────────────────────────────────
    const jacket = this.add.graphics();
    jacket.fillStyle(COLORS.PLAYER_SUIT, 1);
    // Torso quad (leaning back slightly)
    jacket.fillPoints([
      { x: sX - 15, y: gndY - 79 },   // left shoulder
      { x: sX + 29, y: gndY - 71 },   // right shoulder
      { x: sX + 25, y: gndY - 29 },   // right hip
      { x: sX - 17, y: gndY - 33 },   // left hip
    ], true);
    // Left arm (resting, barely visible behind torso)
    rr(jacket, sX - 23, gndY - 53, 44, 16, 1.12);
    // Right arm (extended, holding cup toward fire)
    rr(jacket, sX + 47, gndY - 63, 60, 16, -0.17);

    // ─── Glove on right hand ─────────────────────────────────────────────────
    jacket.fillStyle(0x16161e, 1);
    jacket.fillCircle(sX + 68, gndY - 67, 10);

    // ─── Head & helmet ───────────────────────────────────────────────────────
    const head = this.add.graphics();
    // Helmet
    head.fillStyle(COLORS.PLAYER, 1);
    head.fillCircle(sX - 2, gndY - 98, 29);
    // Helmet brim
    head.fillStyle(0xcc2020, 1);
    head.fillEllipse(sX - 2, gndY - 78, 54, 17);
    // Goggle frame (right / front side of helmet in profile)
    head.fillStyle(0x1a1a2a, 1);
    head.fillEllipse(sX + 12, gndY - 97, 32, 20);
    // Goggle lens (blue-tinted)
    head.fillStyle(0x4a8ab0, 0.75);
    head.fillEllipse(sX + 13, gndY - 98, 24, 14);

    // ─── Coffee cup ──────────────────────────────────────────────────────────
    const cup = this.add.graphics();
    // Cup body (cream)
    cup.fillStyle(0xfaf0e0, 1);
    cup.fillRoundedRect(sX + 70, gndY - 81, 25, 23, 4);
    // Dark coffee visible at the rim
    cup.fillStyle(0x3a1c00, 1);
    cup.fillRect(sX + 72, gndY - 80, 21, 8);
    // Handle — right-side arc
    cup.lineStyle(5, 0xcdb89a, 1);
    cup.beginPath();
    cup.arc(sX + 95, gndY - 70, 8, -Math.PI / 2, Math.PI / 2);
    cup.strokePath();

    // ─── Steam (tween: rises and fades, then repeats) ────────────────────────
    const steam = this.add.graphics();
    steam.fillStyle(0xffffff, 0.55);
    steam.fillEllipse(sX + 76, gndY - 89, 6, 5);
    steam.fillEllipse(sX + 83, gndY - 96, 5, 4);
    steam.fillEllipse(sX + 79, gndY - 103, 5, 4);
    this.tweens.add({
      targets: steam, y: -10, alpha: 0,
      duration: 2400, repeat: -1, ease: 'Quad.easeOut',
    });

    // ─── Campfire logs ───────────────────────────────────────────────────────
    const logs = this.add.graphics();
    logs.fillStyle(COLORS.TREE_TRUNK, 1);
    rr(logs, fX, gndY - 12, 122, 15, -0.50);
    rr(logs, fX, gndY - 12, 110, 15,  0.45);
    // Darker cross-section at log tips
    logs.fillStyle(0x3a2510, 1);
    rr(logs, fX + 54, gndY - 12 - 27, 20, 15, -0.50);
    rr(logs, fX + 50, gndY - 12 + 22, 20, 15,  0.45);
    // Glowing coals
    logs.fillStyle(0xff2200, 0.95);
    logs.fillEllipse(fX, gndY - 9, 52, 15);
    logs.fillStyle(0xff7700, 0.8);
    logs.fillEllipse(fX, gndY - 12, 30, 8);

    // ─── Animated flames ─────────────────────────────────────────────────────
    // Outer flame (wide, orange)
    const flameOuter = this.add.graphics();
    flameOuter.fillStyle(0xff4400, 1);
    flameOuter.fillTriangle(fX - 30, gndY - 8, fX + 30, gndY - 8, fX - 5, gndY - 93);
    flameOuter.fillTriangle(fX - 20, gndY - 8, fX + 26, gndY - 8, fX + 10, gndY - 86);
    this.tweens.add({
      targets: flameOuter, alpha: 0.70,
      duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Mid flame (brighter orange)
    const flameMid = this.add.graphics();
    flameMid.fillStyle(0xff8800, 1);
    flameMid.fillTriangle(fX - 18, gndY - 8, fX + 18, gndY - 8, fX - 2, gndY - 110);
    this.tweens.add({
      targets: flameMid, alpha: 0.65,
      duration: 270, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 90,
    });

    // Inner flame (yellow)
    const flameInner = this.add.graphics();
    flameInner.fillStyle(0xffdd00, 1);
    flameInner.fillTriangle(fX - 10, gndY - 10, fX + 10, gndY - 10, fX, gndY - 120);
    this.tweens.add({
      targets: flameInner, alpha: 0.72,
      duration: 190, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 40,
    });

    // Bright white-yellow core
    const flameCore = this.add.graphics();
    flameCore.fillStyle(0xffffff, 0.88);
    flameCore.fillTriangle(fX - 4, gndY - 10, fX + 4, gndY - 10, fX, gndY - 92);
    this.tweens.add({
      targets: flameCore, alpha: 0.38,
      duration: 155, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 20,
    });
  }

  // ─── Button ──────────────────────────────────────────────────────────────────

  private createButton(
    x: number, y: number, w: number, h: number,
    label: string, fontSize: number, fontStyle: string,
    onClick: () => void,
    onHover?: () => void,
    entranceDelay = 0,
  ): MenuNavItem {
    // Container allows the whole button to slide + fade as one unit
    const container = this.add.container(x, y + 55).setAlpha(0);

    const bg = new Phaser.GameObjects.Graphics(this);
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 15);
    };
    drawBg(false);

    const labelText = new Phaser.GameObjects.Text(this, 0, 0, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize:   fontSize + 'px',
      fontStyle,
      color:      '#ffffff',
    }).setOrigin(0.5);

    const hitArea = new Phaser.GameObjects.Rectangle(this, 0, 0, w, h)
      .setInteractive({ useHandCursor: true });

    container.add([bg, labelText, hitArea]);

    hitArea.on('pointerover', () => { onHover?.(); drawBg(true);  labelText.setText(`~ ${label} ~`); });
    hitArea.on('pointerout',  () => {               drawBg(false); labelText.setText(label); });
    hitArea.on('pointerdown', onClick);

    this.tweens.add({
      targets:  container,
      y:        y,
      alpha:    1,
      duration: 400,
      delay:    entranceDelay,
      ease:     'Quad.easeOut',
    });

    return {
      setFocus: (f) => { drawBg(f); labelText.setText(f ? `~ ${label} ~` : label); },
      activate: onClick,
    };
  }
}
