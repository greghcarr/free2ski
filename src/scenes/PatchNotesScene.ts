import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, BACK_BTN_Y } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { PATCH_NOTES } from '@/data/patchNotes';

// Layout
const CONTENT_TOP    = 215;
const CONTENT_BOTTOM = BACK_BTN_Y - 55;   // 885
const CONTENT_H      = CONTENT_BOTTOM - CONTENT_TOP;
const NOTE_X         = 120;
const NOTE_WRAP_W    = 1440;  // right edge at x=1560
const VERSION_H      = 72;
const DATE_H         = 50;
const NOTE_PADDING   = 12;
const ENTRY_GAP      = 52;

// Arrow scroll buttons (right side)
const ARROW_X        = 1780;
const ARROW_UP_Y     = 430;
const ARROW_DOWN_Y   = 670;
const ARROW_BTN_SIZE = 180;
const SCROLL_AMOUNT  = 200;

// Scrollbar
const SCROLLBAR_X = 1620;
const SCROLLBAR_W = 12;

// Drag detection boundary — pointer must be left of the scrollbar to start a drag
const DRAG_RIGHT_EDGE = 1560;

type FocusItem = 'scroll-up' | 'scroll-down' | 'back';
const FOCUS_ORDER: FocusItem[] = ['scroll-up', 'scroll-down', 'back'];
export class PatchNotesScene extends Phaser.Scene {
  private scrollY              = 0;
  private maxScroll            = 0;
  private contentContainer!:    Phaser.GameObjects.Container;
  private focused: FocusItem | null = null;
  private dragActive            = false;
  private dragStartY            = 0;
  private dragStartScroll       = 0;
  private scrollbarThumb:       Phaser.GameObjects.Graphics | null = null;
  private scrollbarDragActive   = false;
  private scrollbarDragStartY   = 0;
  private scrollbarDragStartScroll = 0;
  private scrollbarHighlighted  = false;

  // Focus-state setters, assigned after button creation
  private setUpFocus!:   (focused: boolean) => void;
  private setDownFocus!: (focused: boolean) => void;
  private setBackFocus!: (focused: boolean) => void;

  constructor() {
    super({ key: SceneKey.PatchNotes });
  }

  create(): void {
    this.scrollY    = 0;
    this.focused    = null;
    this.dragActive = false;

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Title
    this.add.text(WORLD_WIDTH / 2, 100, 'patch notes', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '130px',
      fontStyle:  'bold',
      color:      COLORS.UI_TITLE,
    }).setOrigin(0.5);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(2, COLORS.UI_DIVIDER, 0.6);
    div.beginPath();
    div.moveTo(120, 175);
    div.lineTo(WORLD_WIDTH - 120, 175);
    div.strokePath();

    // Scrollable content container
    this.contentContainer = this.add.container(0, CONTENT_TOP);
    let curY = 0;
    const textCenterX = NOTE_X + NOTE_WRAP_W / 2;

    for (const entry of PATCH_NOTES) {
      this.contentContainer.add(
        this.add.text(textCenterX, curY, entry.version, {
          fontFamily: 'FoxwhelpFont',
          fontSize:   '60px',
          fontStyle:  'bold',
          color:      COLORS.UI_TITLE,
        }).setOrigin(0.5, 0),
      );
      curY += VERSION_H;

      this.contentContainer.add(
        this.add.text(textCenterX, curY, entry.date, {
          fontFamily: 'FoxwhelpFont',
          fontSize:   '38px',
          color:      COLORS.UI_SECONDARY,
        }).setOrigin(0.5, 0),
      );
      curY += DATE_H;

      for (const note of entry.notes) {
        const t = this.add.text(NOTE_X, curY, `– ${note}`, {
          fontFamily: 'FoxwhelpFont',
          fontSize:   '42px',
          color:      COLORS.UI_SUBTITLE,
          wordWrap:   { width: NOTE_WRAP_W },
        }).setOrigin(0, 0);
        this.contentContainer.add(t);
        curY += t.displayHeight + NOTE_PADDING;
      }

      curY += ENTRY_GAP;
    }

    this.maxScroll = Math.max(0, curY - CONTENT_H);

    // Scrollbar (only when content overflows)
    if (this.maxScroll > 0) {
      const track = this.add.graphics();
      track.fillStyle(COLORS.BTN, 0.3);
      track.fillRoundedRect(SCROLLBAR_X - SCROLLBAR_W / 2, CONTENT_TOP, SCROLLBAR_W, CONTENT_H, SCROLLBAR_W / 2);

      this.scrollbarThumb = this.add.graphics();
      this.updateScrollbar();

      const trackHit = this.add.rectangle(SCROLLBAR_X, CONTENT_TOP + CONTENT_H / 2, SCROLLBAR_W + 20, CONTENT_H)
        .setInteractive({ useHandCursor: true });
      trackHit.on('pointerover', () => { this.scrollbarHighlighted = true;  this.updateScrollbar(); });
      trackHit.on('pointerout',  () => { this.scrollbarHighlighted = false; if (!this.scrollbarDragActive) this.updateScrollbar(); });
      trackHit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        const totalH     = CONTENT_H + this.maxScroll;
        const thumbH     = Math.max(40, (CONTENT_H / totalH) * CONTENT_H);
        const trackRange = CONTENT_H - thumbH;
        const pos        = Phaser.Math.Clamp(ptr.y - CONTENT_TOP - thumbH / 2, 0, trackRange);
        this.scrollY     = Phaser.Math.Clamp((pos / trackRange) * this.maxScroll, 0, this.maxScroll);
        this.contentContainer.setY(CONTENT_TOP - this.scrollY);
        this.updateScrollbar();
        this.scrollbarDragActive      = true;
        this.scrollbarDragStartY      = ptr.y;
        this.scrollbarDragStartScroll = this.scrollY;
      });
    }

    // Clip mask
    const maskGfx = this.add.graphics();
    maskGfx.fillRect(0, CONTENT_TOP, WORLD_WIDTH, CONTENT_H);
    this.contentContainer.setMask(maskGfx.createGeometryMask());

    // Arrow scroll buttons
    this.setUpFocus   = this.createArrowButton(ARROW_X, ARROW_UP_Y,   'up',   () => this.applyScroll(-SCROLL_AMOUNT));
    this.setDownFocus = this.createArrowButton(ARROW_X, ARROW_DOWN_Y, 'down', () => this.applyScroll(SCROLL_AMOUNT));

    // Back button
    this.setBackFocus = this.createBackButton();

    // Keyboard navigation
    if (this.input.keyboard) {
      const kb = this.input.keyboard;
      kb.on('keydown-UP',    () => this.moveFocus(-1));
      kb.on('keydown-DOWN',  () => this.moveFocus(1));
      kb.on('keydown-SPACE', () => this.activateFocused());
      kb.on('keydown-ENTER', () => this.activateFocused());
      kb.on('keydown-ESC',   () => this.scene.start(SceneKey.MainMenu));
    }

    // Drag scroll (content area only, not over the arrow buttons)
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= CONTENT_TOP && ptr.y <= CONTENT_BOTTOM && ptr.x < DRAG_RIGHT_EDGE) {
        this.dragActive      = true;
        this.dragStartY      = ptr.y;
        this.dragStartScroll = this.scrollY;
      }
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.scrollbarDragActive) {
        const totalH     = CONTENT_H + this.maxScroll;
        const thumbH     = Math.max(40, (CONTENT_H / totalH) * CONTENT_H);
        const trackRange = CONTENT_H - thumbH;
        const delta      = ptr.y - this.scrollbarDragStartY;
        this.scrollY     = Phaser.Math.Clamp(
          this.scrollbarDragStartScroll + (delta / trackRange) * this.maxScroll,
          0, this.maxScroll,
        );
        this.contentContainer.setY(CONTENT_TOP - this.scrollY);
        this.updateScrollbar();
        return;
      }
      if (!this.dragActive) return;
      this.scrollY = Phaser.Math.Clamp(
        this.dragStartScroll + (this.dragStartY - ptr.y),
        0, this.maxScroll,
      );
      this.contentContainer.setY(CONTENT_TOP - this.scrollY);
      this.updateScrollbar();
    });
    this.input.on('pointerup', () => {
      this.dragActive          = false;
      this.scrollbarDragActive = false;
    });

    // Mouse wheel
    this.input.on('wheel', (_ptr: unknown, _objs: unknown, _dx: unknown, dy: number) => {
      this.applyScroll(dy * 0.8);
    });

    addVersionLabel(this, COLORS.VERSION_MENU);
    addUsernameLabel(this, COLORS.VERSION_MENU);
  }

  // ---------------------------------------------------------------------------
  // Button builders
  // ---------------------------------------------------------------------------

  private createArrowButton(
    x: number, y: number,
    dir: 'up' | 'down',
    onPress: () => void,
  ): (focused: boolean) => void {
    const visual  = this.add.container(x, y);
    const glowGfx = this.add.graphics();
    const gfx     = this.add.graphics();
    visual.add([glowGfx, gfx]);

    // Hit area is separate so it stays full size while the visual pulses
    const hit = this.add.rectangle(x, y, ARROW_BTN_SIZE, ARROW_BTN_SIZE)
      .setInteractive({ useHandCursor: true });

    const focusKey: FocusItem = dir === 'up' ? 'scroll-up' : 'scroll-down';
    let pulseTween: Phaser.Tweens.Tween | null = null;

    const GLOW_LAYERS = [
      { pad: 30, alpha: 0.04 },
      { pad: 20, alpha: 0.08 },
      { pad: 12, alpha: 0.13 },
      { pad:  6, alpha: 0.18 },
      { pad:  2, alpha: 0.24 },
    ] as const;
    const half = ARROW_BTN_SIZE / 2;

    const drawGlow = (on: boolean): void => {
      glowGfx.clear();
      if (!on) return;
      for (const { pad, alpha } of GLOW_LAYERS) {
        glowGfx.fillStyle(0xaaddff, alpha);
        glowGfx.fillRoundedRect(-half - pad, -half - pad, ARROW_BTN_SIZE + pad * 2, ARROW_BTN_SIZE + pad * 2, 18 + pad);
      }
    };
    const drawVisual = (hovered: boolean): void => {
      gfx.clear();
      gfx.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, hovered ? 1 : 0.85);
      gfx.fillRoundedRect(-half, -half, ARROW_BTN_SIZE, ARROW_BTN_SIZE, 18);
      gfx.fillStyle(0xffffff, 1);
      if (dir === 'up') gfx.fillTriangle(0, -38, -34, 26, 34, 26);
      else              gfx.fillTriangle(0,  38, -34, -26, 34, -26);
    };
    const startPulse = (): void => {
      if (!pulseTween) pulseTween = this.tweens.add({ targets: visual, scaleX: 1.22, scaleY: 1.22, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    const stopPulse = (): void => {
      if (pulseTween) { pulseTween.stop(); pulseTween = null; visual.setScale(1); }
    };
    drawVisual(false);

    hit.on('pointerover', () => {
      if (this.focused !== focusKey) {
        drawGlow(true); drawVisual(true);
        this.tweens.add({ targets: visual, scaleX: 1.18, scaleY: 1.18, duration: 120, ease: 'Quad.easeOut' });
      }
    });
    hit.on('pointerout', () => {
      if (this.focused !== focusKey) {
        drawGlow(false); drawVisual(false);
        this.tweens.add({ targets: visual, scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
      }
    });
    hit.on('pointerdown', () => {
      stopPulse();
      onPress();
      this.tweens.add({ targets: visual, scaleX: 1.07, scaleY: 1.07, duration: 55, ease: 'Quad.easeOut', yoyo: true });
    });

    return (focused: boolean) => {
      drawGlow(focused); drawVisual(focused);
      if (focused) startPulse(); else stopPulse();
    };
  }

  private createBackButton(): (focused: boolean) => void {
    const backText = this.add.text(60, BACK_BTN_Y, '← back', {
      fontFamily: 'FoxwhelpFont',
      fontSize:   '50px',
      color:      COLORS.UI_TITLE,
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SceneKey.MainMenu))
      .on('pointerover', () => { if (this.focused !== 'back') backUnderline.setVisible(true); })
      .on('pointerout',  () => { if (this.focused !== 'back') backUnderline.setVisible(false); });

    const ulY = BACK_BTN_Y + backText.displayHeight - 6;
    const prefixMeasure = this.add.text(0, 0, '← ', { fontFamily: 'FoxwhelpFont', fontSize: '50px' }).setVisible(false);
    const backWordX = 60 + prefixMeasure.displayWidth;
    const backWordW = backText.displayWidth - prefixMeasure.displayWidth;
    prefixMeasure.destroy();
    const backUnderline = this.add.graphics();
    backUnderline.fillStyle(parseInt(COLORS.UI_TITLE.slice(1), 16), 1);
    backUnderline.fillRect(backWordX, ulY, backWordW, 4);
    backUnderline.setVisible(false);

    return (focused: boolean) => backUnderline.setVisible(focused);
  }

  // ---------------------------------------------------------------------------
  // Focus / keyboard navigation
  // ---------------------------------------------------------------------------

  private moveFocus(dir: 1 | -1): void {
    if (this.focused === null) {
      this.focused = FOCUS_ORDER[0]!;
    } else {
      const idx    = FOCUS_ORDER.indexOf(this.focused);
      const newIdx = (idx + dir + FOCUS_ORDER.length) % FOCUS_ORDER.length;
      this.focused = FOCUS_ORDER[newIdx]!;
    }
    this.updateFocusVisuals();
  }

  private updateFocusVisuals(): void {
    this.setUpFocus(this.focused === 'scroll-up');
    this.setDownFocus(this.focused === 'scroll-down');
    this.setBackFocus(this.focused === 'back');
  }

  private activateFocused(): void {
    if (this.focused === null) {
      this.focused = FOCUS_ORDER[0]!;
      this.updateFocusVisuals();
      return;
    }
    switch (this.focused) {
      case 'scroll-up':   this.applyScroll(-SCROLL_AMOUNT); break;
      case 'scroll-down': this.applyScroll(SCROLL_AMOUNT);  break;
      case 'back':        this.scene.start(SceneKey.MainMenu); break;
    }
  }

  private applyScroll(delta: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScroll);
    this.contentContainer.setY(CONTENT_TOP - this.scrollY);
    this.updateScrollbar();
  }

  private updateScrollbar(): void {
    if (!this.scrollbarThumb || this.maxScroll <= 0) return;
    const totalH     = CONTENT_H + this.maxScroll;
    const thumbH     = Math.max(40, (CONTENT_H / totalH) * CONTENT_H);
    const thumbY     = CONTENT_TOP + (this.scrollY / this.maxScroll) * (CONTENT_H - thumbH);
    const color = this.scrollbarHighlighted || this.scrollbarDragActive ? COLORS.BTN_HOVER : COLORS.BTN;
    this.scrollbarThumb.clear();
    this.scrollbarThumb.fillStyle(color, 1);
    this.scrollbarThumb.fillRoundedRect(SCROLLBAR_X - SCROLLBAR_W / 2, thumbY, SCROLLBAR_W, thumbH, SCROLLBAR_W / 2);
  }
}
