import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, MAIN_MENU_BADGE_TEXT } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { type MenuNavItem } from '@/ui/MenuNav';
import { fetchTotalRuns } from '@/services/LeaderboardService';
import { DEBUG } from '@/data/DebugConfig';

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
  private snowGfx!:         Phaser.GameObjects.Graphics;
  private flakes:           SnowFlake[] = [];
  private skyLayer:         Phaser.GameObjects.Container | null = null;
  private mountainTintGfx:  Phaser.GameObjects.Graphics  | null = null;
  private debugPanelEl:     HTMLDivElement | null = null;
  private sunContainer:     Phaser.GameObjects.Container | null = null;
  private moonContainer:    Phaser.GameObjects.Container | null = null;

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
    }).setOrigin(0.5).setAlpha(0).setDepth(2);

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
    }).setOrigin(0.5).setAngle(12).setScale(0.01).setDepth(2);

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
    // Layout: Play (hero, centered) → Leaderboard + Settings (side by side) → Patch Notes (small, centered)
    // Title sits at y≈420 with a 280px font; buttons start below it at ~640.
    const SEC_W   = 460;
    const SEC_H   = 108;
    const SEC_GAP = 24;
    const SEC_Y   = 810;
    const SEC_L_X = WORLD_WIDTH / 2 - SEC_W / 2 - SEC_GAP / 2;
    const SEC_R_X = WORLD_WIDTH / 2 + SEC_W / 2 + SEC_GAP / 2;

    // 2D keyboard nav — layout:
    //        [0: play]
    // [1: leaderboard]  [2: settings]
    //     [3: patch notes]
    const navItems: MenuNavItem[] = [];
    let focusIdx   = -1;  // -1 = no keyboard focus
    let lastMidIdx =  1;  // which of leaderboard(1)/settings(2) was last visited

    const setNavFocus = (idx: number): void => {
      if (focusIdx >= 0) navItems[focusIdx]!.setFocus(false);
      focusIdx = idx;
      navItems[focusIdx]!.setFocus(true);
      if (focusIdx === 1 || focusIdx === 2) lastMidIdx = focusIdx;
    };
    const clearNavFocus = (hoverIdx: number): void => {
      if (focusIdx >= 0) navItems[focusIdx]!.setFocus(false);
      focusIdx = -1;
      if (hoverIdx === 1 || hoverIdx === 2) lastMidIdx = hoverIdx;
    };

    type NavDir = 'up' | 'down' | 'left' | 'right';
    const NAV: Record<number, Partial<Record<NavDir, number | (() => number)>>> = {
      0: { up: 3, down: () => lastMidIdx, left: 1, right: 2 },
      1: { up: 0, right: 2, down: 3                         },
      2: { up: 0, left:  1, down: 3                         },
      3: { up: () => lastMidIdx, down: 0, left: 1, right: 2 },
    };
    const handleNavKey = (dir: NavDir): void => {
      if (focusIdx < 0) { setNavFocus(0); return; }
      const dest = NAV[focusIdx]?.[dir];
      if (dest !== undefined) setNavFocus(typeof dest === 'function' ? dest() : dest);
    };
    const kb = this.input.keyboard!;
    kb.on('keydown-UP',    () => handleNavKey('up'));
    kb.on('keydown-DOWN',  () => handleNavKey('down'));
    kb.on('keydown-LEFT',  () => handleNavKey('left'));
    kb.on('keydown-RIGHT', () => handleNavKey('right'));
    kb.on('keydown-SPACE', () => { if (focusIdx >= 0) navItems[focusIdx]!.activate(); });
    kb.on('keydown-ENTER', () => { if (focusIdx >= 0) navItems[focusIdx]!.activate(); });

    const playItem        = this.createButton(WORLD_WIDTH / 2, 650,    730, 150, 'play',        100, 'bold', () => { this.scene.launch(SceneKey.ModeSelect); this.scene.pause(); },   () => clearNavFocus(0), 150);
    const leaderboardItem = this.createButton(SEC_L_X,         SEC_Y,  SEC_W, SEC_H, 'leaderboard', 58, 'bold', () => { this.scene.start(SceneKey.Leaderboard); }, () => clearNavFocus(1), 260);
    const settingsItem    = this.createButton(SEC_R_X,         SEC_Y,  SEC_W, SEC_H, 'settings',    58, 'bold', () => { this.scene.start(SceneKey.Settings); },    () => clearNavFocus(2), 260);
    const patchNotesItem  = this.createButton(WORLD_WIDTH / 2, 940,    360,   85,   'patch notes',  50, 'bold', () => { this.scene.start(SceneKey.PatchNotes); }, () => clearNavFocus(3), 370);
    navItems.push(playItem, leaderboardItem, settingsItem, patchNotesItem);

    // Hide/show UI when ModeSelect is layered on top
    const setUiVisible = (v: boolean): void => {
      title.setVisible(v);
      badge.setVisible(v);
      navItems.forEach(item => item.setVisible?.(v));
    };
    const onPause  = () => setUiVisible(false);
    const onResume = () => setUiVisible(true);
    this.events.on('pause',  onPause);
    this.events.on('resume', onResume);
    this.events.once('shutdown', () => {
      this.events.off('pause',  onPause);
      this.events.off('resume', onResume);
    });

    // Rebuild sky gradient + star brightness every 5 min (handles period transitions).
    // Sun/moon positions are updated every frame in update() so this is only needed
    // for color/style changes (sunrise→day, day→golden, etc.).
    this.time.addEvent({
      delay:    5 * 60 * 1000,
      callback: () => {
        if (!DEBUG.skyDebugHour) {
          const d = new Date();
          this.rebuildSkyForHour(d.getHours() + d.getMinutes() / 60);
        }
      },
      loop: true,
    });

    addVersionLabel(this, COLORS.VERSION_MENU);
    addUsernameLabel(this, COLORS.VERSION_MENU);
    if (DEBUG.skyDebugHour) this.buildDebugSlider();
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

    // Smoothly reposition sun/moon in real time (skip when debug slider is active)
    if (!DEBUG.skyDebugHour) {
      const d    = new Date();
      const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      if (this.sunContainer?.active) {
        const p = this.sunPosForHour(hour);
        if (p) this.sunContainer.setPosition(p.x, p.y);
      }
      if (this.moonContainer?.active) {
        const p = this.moonPosForHour(hour);
        if (p) this.moonContainer.setPosition(p.x, p.y);
      }
    }
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const now  = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    this.buildSky(hour);

    // Far mountains (lighter, tall peaks)
    const farMtn = this.add.graphics();
    farMtn.fillStyle(0x8ab0cc, 1);
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

    this.addMountainTint(hour);

    // Snowy ground
    const ground = this.add.graphics();
    ground.fillGradientStyle(0xc8dde8, 0xc8dde8, 0xe8f4fc, 0xe8f4fc, 1);
    ground.fillRect(0, 820, WORLD_WIDTH, GAME_HEIGHT - 820);
    ground.lineStyle(1, 0xffffff, 0.4);
    ground.lineBetween(0, 820, WORLD_WIDTH, 820);

    // Ski lifts — drawn before trees so they sit behind the foreground clusters
    this.drawSkiLifts();

    // Trees — back layer (trees 2, 4, 5, 7), drawn first so front trees overlap them
    this.drawMenuTree(120,              870, 1.05);  // 2
    this.drawMenuTree(285,              882, 0.65);  // 4
    this.drawMenuTree(WORLD_WIDTH - 285, 882, 0.65); // 5
    this.drawMenuTree(WORLD_WIDTH - 120, 870, 1.05); // 7

    // Humorous "YETI XING" crossing sign — between layers so it sits behind front trees
    this.drawYetiXingSign(WORLD_WIDTH - 1700, 898);

    // Trees — front layer (trees 1, 3, 6, 8), drawn after so they appear in front
    this.drawMenuTree( 40,              895, 0.80);  // 1
    this.drawMenuTree(210,              898, 0.90);  // 3
    this.drawMenuTree(WORLD_WIDTH - 210, 898, 0.90); // 6
    this.drawMenuTree(WORLD_WIDTH -  40, 895, 0.80); // 8

    // v0.3.5 — star on the tallest left tree
    this.drawTreeStar(1800, 870, 1.05);

    // Sleeping cat — left side, opposite the campfire scene
    this.drawSleepingCat();

    // Campfire scene — skier sitting in the snow on the right side
    this.drawLodgeScene(hour);
  }

  // ─── Sky helpers ─────────────────────────────────────────────────────────────

  private buildSky(hour: number): void {
    // All sky graphics go into a container at depth -10 so they always render
    // behind mountains (depth 0) even when rebuilt after scene creation.
    this.skyLayer = this.add.container(0, 0).setDepth(-10);

    // Pick gradient end-points based on time of day
    let topC = 0x1e3d6e;
    let botC = 0x6a9ecc;
    const lh = this.lerpHex.bind(this);
    if      (hour >= 22 || hour < 5)  { topC = 0x03081a; botC = 0x0c1535; }
    else if (hour < 6)  { const t = hour - 5;        topC = lh(0x03081a, 0x0d1535, t); botC = lh(0x0c1535, 0x3a1208, t); }
    else if (hour < 7.5){ const t = (hour-6)/1.5;    topC = lh(0x0d1535, 0x1a2e6e, t); botC = lh(0x3a1208, 0xe87020, t); }
    else if (hour < 10) { const t = (hour-7.5)/2.5;  topC = lh(0x1a2e6e, 0x1a4a8a, t); botC = lh(0xe87020, 0x78bce0, t); }
    else if (hour < 15) { topC = 0x1565c0; botC = 0x7ab8f0; }
    else if (hour < 17) { const t = (hour-15)/2;     topC = lh(0x1565c0, 0x1e3d6e, t); botC = lh(0x7ab8f0, 0x6a9ecc, t); }
    else if (hour < 18.5){ const t = (hour-17)/1.5;  topC = lh(0x1e3d6e, 0x1a237e, t); botC = lh(0x6a9ecc, 0xfb8c00, t); }
    else if (hour < 20) { const t = (hour-18.5)/1.5; topC = lh(0x1a237e, 0x4a0e8f, t); botC = lh(0xfb8c00, 0xe64010, t); }
    else if (hour < 21.5){ const t = (hour-20)/1.5;  topC = lh(0x4a0e8f, 0x0e0a2e, t); botC = lh(0xe64010, 0x6a1a7e, t); }
    else                { const t = (hour-21.5)/0.5; topC = lh(0x0e0a2e, 0x060818, t); botC = lh(0x6a1a7e, 0x1a1235, t); }

    const sky = new Phaser.GameObjects.Graphics(this);
    sky.fillGradientStyle(topC, topC, botC, botC, 1);
    sky.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.skyLayer.add(sky);

    // Warm horizon glow during sunrise / golden hour / sunset
    if ((hour >= 6 && hour < 9) || (hour >= 17 && hour < 21)) {
      let glowAlpha = 0;
      if      (hour < 7)   glowAlpha = (hour - 6)  * 0.28;
      else if (hour < 8)   glowAlpha = 0.28 - (hour - 7) * 0.14;
      else if (hour < 9)   glowAlpha = 0.14 - (hour - 8) * 0.14;
      else if (hour < 18)  glowAlpha = (hour - 17) * 0.28;
      else if (hour < 19)  glowAlpha = 0.28;
      else if (hour < 20)  glowAlpha = 0.28 - (hour - 19) * 0.14;
      else                 glowAlpha = 0.14 - (hour - 20) * 0.14;
      const glowColor = hour < 12 ? 0xff6600 : 0xff4400;
      const hg = new Phaser.GameObjects.Graphics(this);
      hg.fillStyle(glowColor, Math.max(0, glowAlpha));
      hg.fillRect(0, 580, WORLD_WIDTH, 240);
      this.skyLayer.add(hg);
    }

    // Stars
    const starAlpha = this.starAlphaForHour(hour);
    if (starAlpha > 0.02) this.drawMenuStars(starAlpha);

    // Sun
    const sunPos = this.sunPosForHour(hour);
    if (sunPos) {
      const style: 'day' | 'golden' | 'sunrise' =
        (hour < 8 || hour >= 18.5) ? 'sunrise' :
        (hour >= 17)               ? 'golden'  : 'day';
      this.sunContainer = this.drawMenuSun(style);
      this.sunContainer.setPosition(sunPos.x, sunPos.y);
    }

    // Moon
    const moonAlpha = this.moonAlphaForHour(hour);
    const moonPos   = moonAlpha > 0.02 ? this.moonPosForHour(hour) : null;
    if (moonPos) {
      this.moonContainer = this.drawMenuMoon(moonAlpha);
      this.moonContainer.setPosition(moonPos.x, moonPos.y);
    }
  }

  private starAlphaForHour(hour: number): number {
    if (hour >= 22 || hour < 5)  return 1.0;
    if (hour < 6)                return 1.0 - (hour - 5);
    if (hour >= 21.5)            return (hour - 21.5) / 0.5;
    if (hour >= 20)              return (hour - 20) / 1.5 * 0.6;
    if (hour >= 19)              return (hour - 19) * 0.2;
    return 0;
  }

  private moonAlphaForHour(hour: number): number {
    if (hour >= 22 || hour < 5)  return 1.0;
    if (hour < 6)                return 1.0 - (hour - 5);
    if (hour >= 20)              return (hour - 20) / 2;
    return 0;
  }

  private drawMenuStars(opacity: number): void {
    let seed = 0xdeadbeef;
    const rand = (): number => {
      seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
      return (seed >>> 0) / 0xffffffff;
    };
    const g = new Phaser.GameObjects.Graphics(this);
    for (let i = 0; i < 120; i++) {
      const x  = rand() * WORLD_WIDTH;
      const y  = rand() * 740;
      const r  = rand() * 1.5 + 0.4;
      const br = rand() * 0.5 + 0.5;
      g.fillStyle(0xffffff, br * opacity);
      g.fillCircle(x, y, r);
    }
    this.skyLayer!.add(g);
    // A handful of brighter twinkling stars with cross-sparkles
    for (let i = 0; i < 10; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * 580;
      const s = new Phaser.GameObjects.Graphics(this);
      s.fillStyle(0xffffff, opacity);
      s.fillCircle(x, y, 2);
      s.lineStyle(1, 0xffffff, opacity * 0.5);
      s.lineBetween(x - 6, y, x + 6, y);
      s.lineBetween(x, y - 6, x, y + 6);
      this.skyLayer!.add(s);
      this.tweens.add({
        targets: s, alpha: 0.08,
        duration: 1200 + i * 380, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 250,
      });
    }
  }

  private sunPosForHour(hour: number): { x: number; y: number } | null {
    if (hour < 6.5 || hour >= 19.5) return null;
    const t = (hour - 6) / 12;
    return { x: 250 + t * (WORLD_WIDTH - 500), y: 580 - Math.sin(t * Math.PI) * 530 };
  }

  private moonPosForHour(hour: number): { x: number; y: number } | null {
    if (this.moonAlphaForHour(hour) <= 0.02) return null;
    const mh = hour >= 20 ? hour - 20 : hour + 4;
    const t  = mh / 12;
    if (t < 0 || t > 1) return null;
    return { x: WORLD_WIDTH - 250 - t * (WORLD_WIDTH - 500), y: 580 - Math.sin(t * Math.PI) * 530 };
  }

  private drawMenuSun(style: 'day' | 'golden' | 'sunrise'): Phaser.GameObjects.Container {
    const c = new Phaser.GameObjects.Container(this, 0, 0);
    const g = new Phaser.GameObjects.Graphics(this);
    if (style === 'sunrise' || style === 'golden') {
      const hue = style === 'sunrise' ? 0xff7700 : 0xffaa00;
      g.fillStyle(hue,      0.06); g.fillCircle(0, 0, 100);
      g.fillStyle(hue,      0.13); g.fillCircle(0, 0, 72);
      g.fillStyle(0xff5500, 0.38); g.fillCircle(0, 0, 46);
      g.fillStyle(0xffcc44, 0.90); g.fillCircle(0, 0, 32);
      g.fillStyle(0xffffff, 0.80); g.fillCircle(0, 0, 17);
    } else {
      g.fillStyle(0xfff5cc, 0.12); g.fillCircle(0, 0, 62);
      g.fillStyle(0xffeedd, 0.25); g.fillCircle(0, 0, 48);
      g.fillStyle(0xffe066, 1.00); g.fillCircle(0, 0, 36);
      g.fillStyle(0xfff9dd, 1.00); g.fillCircle(0, 0, 26);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineStyle(2.5, 0xffe066, 0.45);
        g.lineBetween(Math.cos(a) * 40, Math.sin(a) * 40, Math.cos(a) * 56, Math.sin(a) * 56);
      }
    }
    c.add(g);
    this.skyLayer!.add(c);
    return c;
  }

  private drawMenuMoon(alpha: number): Phaser.GameObjects.Container {
    const c = new Phaser.GameObjects.Container(this, 0, 0);
    const g = new Phaser.GameObjects.Graphics(this);
    g.setAlpha(alpha);
    g.fillStyle(0x8899cc, 0.10); g.fillCircle(0,   0,  52);
    g.fillStyle(0xaabbdd, 0.18); g.fillCircle(0,   0,  38);
    g.fillStyle(0xe0e8f5, 1.00); g.fillCircle(0,   0,  26);
    g.fillStyle(0x060818, 0.94); g.fillCircle(10, -3,  22);   // crescent shadow
    g.fillStyle(0x8899aa, 0.50);
    g.fillEllipse(-7,  5, 11, 7);
    g.fillEllipse(-12,-3,  7, 5);
    g.fillEllipse(-5, -9,  5, 4);
    c.add(g);
    this.skyLayer!.add(c);
    return c;
  }

  private addMountainTint(hour: number): void {
    let tintColor = 0;
    let tintAlpha = 0;
    if      (hour >= 22 || hour < 5)           { tintColor = 0x0a1535; tintAlpha = 0.50; }
    else if (hour < 6)                         { tintColor = 0x0a1535; tintAlpha = 0.50 - (hour - 5) * 0.30; }
    else if (hour < 8)                         { tintColor = 0xff4400; tintAlpha = (hour - 6) / 2 * 0.15; }
    else if (hour >= 17 && hour < 18.5)        { tintColor = 0xff8800; tintAlpha = (hour - 17) / 1.5 * 0.12; }
    else if (hour >= 18.5 && hour < 20)        { tintColor = 0xff2200; tintAlpha = 0.12 + (hour - 18.5) / 1.5 * 0.12; }
    else if (hour >= 20 && hour < 21.5)        { tintColor = 0x4a0a8f; tintAlpha = 0.24 + (hour - 20) / 1.5 * 0.15; }
    else if (hour >= 21.5)                     { tintColor = 0x08082a; tintAlpha = 0.39; }
    if (tintAlpha <= 0.01) return;
    const tint = this.add.graphics();
    tint.setDepth(1);
    tint.fillStyle(tintColor, tintAlpha);
    tint.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.mountainTintGfx = tint;
  }

  private rebuildSkyForHour(hour: number): void {
    this.skyLayer?.destroy(true);
    this.skyLayer      = null;
    this.sunContainer  = null;
    this.moonContainer = null;
    this.mountainTintGfx?.destroy();
    this.mountainTintGfx = null;
    this.buildSky(hour);
    this.addMountainTint(hour);
  }

  private buildDebugSlider(): void {
    const canvas = this.game.canvas;
    const bounds = canvas.getBoundingClientRect();

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:       'fixed',
      left:           bounds.left + 'px',
      top:            bounds.top  + 'px',
      width:          bounds.width + 'px',
      height:         bounds.height + 'px',
      display:        'flex',
      alignItems:     'flex-end',
      justifyContent: 'center',
      paddingBottom:  '18px',
      pointerEvents:  'none',
      zIndex:         '99999',
      boxSizing:      'border-box',
    });

    const inner = document.createElement('div');
    Object.assign(inner.style, {
      display:       'flex',
      alignItems:    'center',
      gap:           '12px',
      padding:       '8px 18px',
      background:    'rgba(0,0,0,0.65)',
      borderRadius:  '8px',
      pointerEvents: 'auto',
    });

    const now      = new Date();
    const initHour = now.getHours() + now.getMinutes() / 60;

    const formatHour = (h: number): string => {
      const hh = Math.floor(h % 24);
      const mm = Math.round((h % 1) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const title = document.createElement('span');
    title.style.color      = '#88aaff';
    title.style.fontFamily = 'monospace';
    title.style.fontSize   = '13px';
    title.textContent      = 'sky debug:';

    const slider = document.createElement('input');
    slider.type  = 'range';
    slider.min   = '0';
    slider.max   = '24';
    slider.step  = '0.25';
    slider.value = String(initHour);
    Object.assign(slider.style, { width: '420px', cursor: 'pointer' });

    const label = document.createElement('span');
    Object.assign(label.style, {
      color:      '#ffffff',
      fontFamily: 'monospace',
      fontSize:   '13px',
      minWidth:   '44px',
    });
    label.textContent = formatHour(initHour);

    slider.addEventListener('input', () => {
      const h = parseFloat(slider.value) % 24;
      label.textContent = formatHour(h);
      this.rebuildSkyForHour(h);
    });

    inner.append(title, slider, label);
    panel.appendChild(inner);
    document.body.appendChild(panel);

    this.debugPanelEl = panel;
    this.events.once('shutdown', () => panel.remove());
    this.events.once('destroy',  () => panel.remove());
  }

  private lerpHex(a: number, b: number, t: number): number {
    const r0 = (a >> 16) & 0xff, g0 = (a >> 8) & 0xff, b0 = a & 0xff;
    const r1 = (b >> 16) & 0xff, g1 = (b >> 8) & 0xff, b1 = b & 0xff;
    return (
      (Math.round(r0 + (r1 - r0) * t) << 16) |
      (Math.round(g0 + (g1 - g0) * t) <<  8) |
      (Math.round(b0 + (b1 - b0) * t))
    );
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

  /** Two ski lifts going up the near-mountain slopes. */
  private drawSkiLifts(): void {
    // Lift endpoints sit on consecutive near-mountain path vertices so the
    // cable follows the slope exactly and never dips through the silhouette.
    const LIFTS = [
      { ax: 525, ay: 590, bx: 838, by: 432 },   // centre-left slope → centre peak
      { ax: 525, ay: 590, bx: 220, by: 490 },   // centre-left slope → left peak
      { ax: 1122, ay: 546, bx: 1418, by: 466 },  // centre-right slope
    ] as const;
    const CABLE_LIFT = 48;   // px the cable sits above the slope surface
    const NUM_CHAIRS = 3;
    const TRIP_MS    = 14_000;

    for (const { ax, ay, bx, by } of LIFTS) {
      const dx  = bx - ax;
      const dy  = by - ay;
      const cay = ay - CABLE_LIFT;   // cable y at bottom terminal
      const cby = by - CABLE_LIFT;   // cable y at top terminal

      // ── Animated chairs (added first → rendered below cable) ─────────────
      for (let i = 0; i < NUM_CHAIRS; i++) {
        const t0    = i / NUM_CHAIRS;
        const chairGfx = new Phaser.GameObjects.Graphics(this);
        // Suspension rope
        chairGfx.lineStyle(1.5, 0x1a2a3a, 1);
        chairGfx.beginPath();
        chairGfx.moveTo(0, 0);
        chairGfx.lineTo(0, 18);
        chairGfx.strokePath();
        // Gondola body
        chairGfx.fillStyle(0x3a6ab8, 1);
        chairGfx.fillRoundedRect(-10, 18, 20, 12, 2);
        // Window strip
        chairGfx.fillStyle(0xaaccee, 0.75);
        chairGfx.fillRect(-7, 20, 14, 5);

        const chair = this.add.container(ax + dx * t0, cay + dy * t0, [chairGfx]);

        // Phase 1: travel from staggered start to top terminal
        this.tweens.add({
          targets:  chair,
          x:        bx,
          y:        cby,
          duration: TRIP_MS * (1 - t0),
          ease:     'Linear',
          onComplete: () => {
            // Phase 2: loop from bottom to top indefinitely
            this.tweens.add({
              targets:  chair,
              x:        { from: ax, to: bx },
              y:        { from: cay, to: cby },
              duration: TRIP_MS,
              repeat:   -1,
              ease:     'Linear',
            });
          },
        });
      }

      // ── Towers + cable (added after chairs → renders on top) ─────────────
      const g = this.add.graphics();

      // Support towers — each CABLE_LIFT px tall (slope and cable are parallel)
      for (const t of [0.25, 0.5, 0.75]) {
        const tx   = Math.round(ax + dx * t);
        const topY = Math.round(cay + dy * t);   // cable level = tower top
        g.fillStyle(0x8899aa, 1);
        g.fillRect(tx - 3, topY, 6, CABLE_LIFT + 2);  // pole down to slope
        g.fillRect(tx - 14, topY - 4, 28, 5);          // crossbar
        g.fillStyle(0x334455, 1);
        g.fillCircle(tx - 7, topY - 2, 3);             // pulleys
        g.fillCircle(tx + 7, topY - 2, 3);
      }

      // Main cable
      g.lineStyle(2, 0x1a2a3a, 0.9);
      g.beginPath();
      g.moveTo(ax, cay);
      g.lineTo(bx, cby);
      g.strokePath();

      // Return cable — parallel, offset ~5px toward the downslope side
      const clen  = Math.sqrt(dx * dx + dy * dy);
      const perpX = (-dy / clen) * 5;
      const perpY = ( dx / clen) * 5;
      g.lineStyle(1.5, 0x1a2a3a, 0.5);
      g.beginPath();
      g.moveTo(ax + perpX, cay + perpY);
      g.lineTo(bx + perpX, cby + perpY);
      g.strokePath();

      // Terminal buildings — drawn last, mask chairs at load/unload zones
      for (const [tx, ty] of [[ax, ay], [bx, by]] as [number, number][]) {
        const tw = 32; const th = 26;
        g.fillStyle(0x6688aa, 1);
        g.fillRoundedRect(tx - tw / 2, ty - th, tw, th, 4);
        g.fillStyle(0x4a6688, 1);
        g.fillTriangle(tx - tw / 2 - 4, ty - th, tx, ty - th - 16, tx + tw / 2 + 4, ty - th);
        g.fillStyle(0x2a3a4a, 1);
        g.fillRect(tx - 5, ty - 13, 10, 13);
      }
    }
  }

  /** Humorous "YETI XING" crossing sign planted next to a tree. */
  private drawYetiXingSign(treeCx: number, baseY: number): void {
    const postX = treeCx + 52;
    const gndY  = baseY;
    const postH = 68;
    const signW = 86;
    const signH = 46;
    const signCY = gndY - postH - signH / 2;

    // Post
    const g = this.add.graphics();
    g.fillStyle(0xa0784a, 1);
    g.fillRect(postX - 3, gndY - postH, 6, postH);

    // Sign board — yellow, slight tilt
    const container = this.add.container(postX, signCY);
    const board = this.add.graphics();
    board.fillStyle(0xf5e642, 1);
    board.fillRoundedRect(-signW / 2, -signH / 2, signW, signH, 5);
    board.lineStyle(2, 0xc8a800, 1);
    board.strokeRoundedRect(-signW / 2, -signH / 2, signW, signH, 5);
    container.add(board);

    const line1 = this.add.text(0, -10, 'YETI', {
      fontFamily: 'FoxwhelpFont', fontSize: '22px', fontStyle: 'bold', color: '#1a1a1a',
    }).setOrigin(0.5);
    const line2 = this.add.text(0, 12, 'XING', {
      fontFamily: 'FoxwhelpFont', fontSize: '22px', fontStyle: 'bold', color: '#cc2222',
    }).setOrigin(0.5);
    container.add([line1, line2]);
    container.setRotation(-0.08);
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
  private drawSleepingCat(): void {
    const cx   = 450;
    const gndY = 1003;
    const g    = this.add.graphics();

    // Ground shadow
    g.fillStyle(0x000020, 0.10);
    g.fillEllipse(cx, gndY - 2, 110, 16);

    // Tail — crescent wrapping to the left of the body (drawn first, behind body)
    g.fillStyle(0x8888a2, 1);
    g.fillPoints([
      { x: cx - 10, y: gndY - 46 },
      { x: cx - 38, y: gndY - 55 },
      { x: cx - 50, y: gndY - 43 },
      { x: cx - 25, y: gndY - 34 },
    ], true);

    // Body
    g.fillStyle(0xa0a0b8, 1);
    g.fillEllipse(cx, gndY - 26, 88, 50);

    // Belly (lighter patch)
    g.fillStyle(0xbcbccc, 0.75);
    g.fillEllipse(cx + 12, gndY - 20, 52, 28);

    // Head
    g.fillStyle(0xa0a0b8, 1);
    g.fillCircle(cx + 34, gndY - 48, 23);

    // Ears
    g.fillStyle(0xa0a0b8, 1);
    g.fillTriangle(cx + 21, gndY - 64, cx + 17, gndY - 79, cx + 32, gndY - 66);
    g.fillTriangle(cx + 37, gndY - 67, cx + 48, gndY - 81, cx + 53, gndY - 63);

    // Inner ear (pink)
    g.fillStyle(0xcc8080, 1);
    g.fillTriangle(cx + 23, gndY - 65, cx + 21, gndY - 75, cx + 29, gndY - 67);
    g.fillTriangle(cx + 39, gndY - 67, cx + 47, gndY - 77, cx + 50, gndY - 64);

    // Closed eyes (happy sleeping arcs)
    g.lineStyle(2.5, 0x2a2a3a, 1);
    g.beginPath();
    g.arc(cx + 27, gndY - 49, 6, -Math.PI * 0.75, -Math.PI * 0.2);
    g.strokePath();
    g.beginPath();
    g.arc(cx + 41, gndY - 49, 6, -Math.PI * 0.75, -Math.PI * 0.2);
    g.strokePath();

    // Nose
    g.fillStyle(0xcc6666, 1);
    g.fillTriangle(cx + 34, gndY - 43, cx + 31, gndY - 40, cx + 37, gndY - 40);

    // Whiskers
    g.lineStyle(1.5, 0xd8d8e8, 0.8);
    g.beginPath(); g.moveTo(cx + 22, gndY - 41); g.lineTo(cx + 8,  gndY - 43); g.strokePath();
    g.beginPath(); g.moveTo(cx + 22, gndY - 38); g.lineTo(cx + 9,  gndY - 35); g.strokePath();
    g.beginPath(); g.moveTo(cx + 46, gndY - 41); g.lineTo(cx + 60, gndY - 43); g.strokePath();
    g.beginPath(); g.moveTo(cx + 46, gndY - 38); g.lineTo(cx + 59, gndY - 35); g.strokePath();

    // Paws peeking out from under the body
    g.fillStyle(0x9292aa, 1);
    g.fillRoundedRect(cx + 14, gndY - 11, 20, 11, 4);
    g.fillRoundedRect(cx + 38, gndY - 11, 20, 11, 4);

    // Light snow dusting on the cat's back
    g.fillStyle(0xeef4fc, 0.55);
    g.fillEllipse(cx - 6, gndY - 50, 36, 11);

    // Floating zzz
    const zzz = this.add.text(cx + 58, gndY - 68, 'zzz', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '28px',
      color:      '#b8b8cc',
    }).setOrigin(0, 1).setAlpha(0.8);
    this.tweens.add({
      targets:  zzz,
      y:        { from: gndY - 68, to: gndY - 90 },
      alpha:    { from: 0.8,       to: 0 },
      duration: 2600,
      repeat:   -1,
      ease:     'Quad.easeOut',
      delay:    800,
    });
  }

  private drawLodgeScene(hour: number): void {
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
    // Scale glow size and brightness based on how dark it is outside.
    const ni        = hour >= 18 ? Math.min(1, (hour - 18) / 4)   // evening ramp
                    : hour <  6  ? 1                                // deep night
                    : hour <  7  ? 1 - (hour - 6)                  // dawn fade
                    : 0;                                            // daytime
    // Ambient snow pool — visible only at night, spreads wide on the ground
    if (ni > 0.05) {
      const pool = this.add.graphics();
      pool.fillStyle(0xff7700, 0.18 * ni);
      pool.fillEllipse(fX - 40, gndY + 6, 760, 70);
      pool.fillStyle(0xff5500, 0.22 * ni);
      pool.fillEllipse(fX, gndY - 10, 480, 110);
      this.tweens.add({
        targets: pool, alpha: 0.55,
        duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300,
      });
    }

    // ─── Ground shadow beneath skier ─────────────────────────────────────────
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000020, 0.18);
    shadow.fillEllipse(sX + 20, gndY - 2, 155, 18);

    // ─── Skis laid flat on the snow beside the skier ─────────────────────────
    // Two parallel skis resting on the ground, tips pointing toward the fire.
    const skiCX  = sX - 155;   // centre x — tucked left of the log
    const skiLen = 172;         // full length
    const skiW   = 11;
    const skiA   = 0.10;        // gentle diagonal angle
    const tipOffX = (skiLen / 2 - 15) * Math.cos(skiA);
    const tipOffY = (skiLen / 2 - 15) * Math.sin(skiA);
    const skis   = this.add.graphics();

    // Soft shadow beneath both skis
    skis.fillStyle(0x000020, 0.12);
    skis.fillEllipse(skiCX, gndY + 17, skiLen + 10, 14);

    // Ski bodies — bottom ski then top ski (slightly above)
    skis.fillStyle(0x0e0e18, 1);
    rr(skis, skiCX, gndY + 15,      skiLen, skiW, skiA);
    rr(skis, skiCX, gndY + 15 - 12, skiLen, skiW, skiA);

    // Coloured tips on the right-hand (fire-side) ends
    skis.fillStyle(COLORS.PLAYER, 1);
    rr(skis, skiCX + tipOffX, gndY + 15      + tipOffY, 30, skiW, skiA);
    rr(skis, skiCX + tipOffX, gndY + 15 - 12 + tipOffY, 30, skiW, skiA);

    // Binding highlights at centre of each ski
    skis.fillStyle(COLORS.PLAYER_SUIT, 1);
    skis.fillRect(skiCX - 10, gndY - 6, 20, 24);

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
    const container = this.add.container(x, y + 55).setAlpha(0).setDepth(2);

    const glowGfx = new Phaser.GameObjects.Graphics(this);
    const GLOW_LAYERS = [
      { pad: 42, alpha: 0.04 },
      { pad: 28, alpha: 0.08 },
      { pad: 18, alpha: 0.13 },
      { pad: 10, alpha: 0.18 },
      { pad:  4, alpha: 0.24 },
    ] as const;
    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 15 + pad);
      }
    };
    drawGlow(false);

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

    container.add([glowGfx, bg, labelText, hitArea]);

    let pulseTween: Phaser.Tweens.Tween | null = null;

    const flashAndGo = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
      bg.clear();
      bg.fillStyle(0xddf4ff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 15);
      labelText.setColor('#2a5ab8');
      this.tweens.add({
        targets:    container,
        scaleX:     1.07,
        scaleY:     1.07,
        duration:   55,
        ease:       'Quad.easeOut',
        yoyo:       true,
        onComplete: () => { drawBg(false); drawGlow(false); labelText.setText(label); labelText.setColor('#ffffff'); onClick(); },
      });
    };

    hitArea.on('pointerover', () => {
      onHover?.(); drawGlow(true); drawBg(true); labelText.setText(`~ ${label} ~`);
      if (!pulseTween) pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    hitArea.on('pointerout', () => {
      drawGlow(false); drawBg(false); labelText.setText(label);
      if (pulseTween) { pulseTween.stop(); pulseTween = null; container.setScale(1); }
    });
    hitArea.on('pointerdown', flashAndGo);

    this.tweens.add({
      targets:  container,
      y:        y,
      alpha:    1,
      duration: 400,
      delay:    entranceDelay,
      ease:     'Quad.easeOut',
    });

    return {
      setFocus: (f) => {
        drawGlow(f); drawBg(f); labelText.setText(f ? `~ ${label} ~` : label);
        if (f && !pulseTween) {
          pulseTween = this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (!f && pulseTween) {
          pulseTween.stop(); pulseTween = null; container.setScale(1);
        }
      },
      activate: flashAndGo,
      setVisible: (v: boolean) => {
        container.setVisible(v);
        if (v) hitArea.setInteractive({ useHandCursor: true });
        else   hitArea.disableInteractive();
      },
    };
  }
}
