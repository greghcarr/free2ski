import Phaser from 'phaser';
import { COLORS, DEPTH, WORLD_WIDTH, JUMP_DURATION, JUMP_VISUAL_HEIGHT } from '@/data/constants';
import type { InputState } from '@/systems/InputSystem';

export enum PlayerState {
  Skiing     = 'skiing',
  Jumping    = 'jumping',
  Crashed    = 'crashed',
  Caught     = 'caught',
  Respawning = 'respawning',
}

// How quickly the skier turns (degrees / second)
const TURN_RATE     = 115;
// Reduced turning authority while airborne (no edge grip)
const AIR_TURN_RATE = 32;
// How quickly the skier auto-straightens when no key is held
const RETURN_RATE   = 75;
// Max lean angle from vertical (degrees)
const MAX_ANGLE   = 72;
// How much horizontal travel the angle produces relative to scroll speed
const LATERAL_FACTOR = 0.48;
// Minimum screen margin (px) from world edge
const X_MARGIN = 96;
// Brake deceleration when holding Up (fraction of speed per second)
const BRAKE_RATE = 0.55;
// Tuck acceleration multiplier when holding Down
const TUCK_MULT = 1.18;

export class Player {
  readonly scene: Phaser.Scene;

  // Screen position — Y is fixed; X drifts left/right based on angle
  x: number;
  readonly screenY: number;

  // Gameplay state
  state: PlayerState = PlayerState.Skiing;
  angle: number = 0;      // degrees from vertical; negative = left, positive = right
  velocityX: number = 0;  // px/s horizontal

  // Jump state
  airTime: number = 0;    // ms of the CURRENT jump (resets each ramp hit)

  // Invincibility (star powerup)
  invincible = false;
  private invincibleTimer: Phaser.Time.TimerEvent | null = null;
  private rainbowTimer:    Phaser.Time.TimerEvent | null = null;
  private rainbowIndex = 0;

  // Speed boost (lightning powerup)
  speedBoostMult = 1;
  private boostTimer:      Phaser.Time.TimerEvent | null = null;
  private boostFlashTimer: Phaser.Time.TimerEvent | null = null;

  // Internal jump counters
  private jumpElapsed: number = 0;
  private visualOffsetY: number = 0;

  // Visual container (child scene objects)
  private container: Phaser.GameObjects.Container;

  // Individual parts — kept as fields so we can animate them
  private leftSki:  Phaser.GameObjects.Rectangle;
  private rightSki: Phaser.GameObjects.Rectangle;
  private body:     Phaser.GameObjects.Ellipse;
  private helmet:   Phaser.GameObjects.Arc;
  private poles:    Phaser.GameObjects.Graphics;
  private shadow:   Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, x: number, screenY: number) {
    this.scene = scene;
    this.x = x;
    this.screenY = screenY;

    // --- Build visual parts (local coords, 0,0 = centre of mass) ---

    // Ground shadow — drawn behind everything
    this.shadow = scene.add.ellipse(3, 16, 26, 9, 0x000000, 0.18);

    // Ski poles — thin lines from body outward (drawn with Graphics)
    this.poles = scene.add.graphics();
    this.drawPoles(0);

    // Skis — dark, thin, slightly fanned
    this.leftSki  = scene.add.rectangle(-8, 8, 5, 30, COLORS.SKI).setAngle(-10);
    this.rightSki = scene.add.rectangle( 8, 8, 5, 30, COLORS.SKI).setAngle( 10);

    // Jacket / suit body
    this.body = scene.add.ellipse(0, -3, 17, 21, COLORS.PLAYER_SUIT);

    // Helmet
    this.helmet = scene.add.arc(0, -17, 7, 0, 360, false, COLORS.PLAYER);

    this.container = scene.add.container(x, screenY, [
      this.shadow,
      this.poles,
      this.leftSki,
      this.rightSki,
      this.body,
      this.helmet,
    ]);
    this.container.setDepth(DEPTH.PLAYER);
    this.container.setScale(1.5);
  }

  // ---------------------------------------------------------------------------
  // Per-frame update — called from GameScene.update()
  // scrollSpeed: effective world scroll speed (px/s) already factored by difficulty
  // Returns a speed multiplier [0.25 – 1.0+] so GameScene can modulate scroll rate
  // ---------------------------------------------------------------------------
  update(input: InputState, scrollSpeed: number, delta: number): number {
    // --- Airborne / jump arc ---
    if (this.state === PlayerState.Jumping) {
      const dt           = delta / 1000;
      this.jumpElapsed  += delta;
      this.airTime      += delta;
      const t            = Math.min(this.jumpElapsed / JUMP_DURATION, 1);
      const jumpFrac     = Math.sin(t * Math.PI);        // 0 → 1 at apex → 0
      this.visualOffsetY = -JUMP_VISUAL_HEIGHT * jumpFrac;

      // Shadow stays pinned to ground: counteract the container's upward movement,
      // then shrink and fade it to sell the illusion of height.
      this.shadow.setPosition(3, 16 - this.visualOffsetY);
      this.shadow.setScale(1 - 0.55 * jumpFrac);
      this.shadow.setAlpha(1 - 0.50 * jumpFrac);

      // Limited steering while airborne — no edge grip
      if (input.left) {
        this.angle = Math.max(this.angle - AIR_TURN_RATE * dt, -MAX_ANGLE);
      } else if (input.right) {
        this.angle = Math.min(this.angle + AIR_TURN_RATE * dt,  MAX_ANGLE);
      }
      const angleRad = Phaser.Math.DegToRad(this.angle);
      this.velocityX = scrollSpeed * Math.sin(angleRad) * LATERAL_FACTOR;
      this.x = Phaser.Math.Clamp(this.x + this.velocityX * dt, X_MARGIN, WORLD_WIDTH - X_MARGIN);

      this.container.setPosition(this.x, this.screenY + this.visualOffsetY);

      const jumpLean = this.angle / MAX_ANGLE;
      const jumpSplay = Math.abs(jumpLean) * 10;
      const jumpBase = -jumpLean * 60;
      if (jumpLean >= 0) {
        this.leftSki.setAngle(jumpBase);
        this.rightSki.setAngle(jumpBase - jumpSplay);
      } else {
        this.rightSki.setAngle(jumpBase);
        this.leftSki.setAngle(jumpBase + jumpSplay);
      }

      if (this.jumpElapsed >= JUMP_DURATION) {
        this.state         = PlayerState.Skiing;
        this.jumpElapsed   = 0;
        this.visualOffsetY = 0;
        this.container.setPosition(this.x, this.screenY);
        this.container.setDepth(DEPTH.PLAYER);
        // Restore shadow to its default resting state
        this.shadow.setPosition(3, 16);
        this.shadow.setScale(1);
        this.shadow.setAlpha(1);
      }
      return 1;
    }

    if (this.state !== PlayerState.Skiing) return 1;

    const dt = delta / 1000;

    // --- Steering ---
    if (input.left) {
      this.angle = Math.max(this.angle - TURN_RATE * dt, -MAX_ANGLE);
    } else if (input.right) {
      this.angle = Math.min(this.angle + TURN_RATE * dt,  MAX_ANGLE);
    } else {
      // Smoothly return to straight
      if (Math.abs(this.angle) < 1.5) {
        this.angle = 0;
      } else {
        const sign = this.angle > 0 ? -1 : 1;
        const delta_a = sign * RETURN_RATE * dt;
        this.angle += delta_a;
        // Clamp overshoot
        if (sign > 0 && this.angle > 0) this.angle = 0;
        if (sign < 0 && this.angle < 0) this.angle = 0;
      }
    }

    // --- Horizontal travel ---
    const angleRad = Phaser.Math.DegToRad(this.angle);
    this.velocityX = scrollSpeed * Math.sin(angleRad) * LATERAL_FACTOR;
    this.x = Phaser.Math.Clamp(
      this.x + this.velocityX * dt,
      X_MARGIN,
      WORLD_WIDTH - X_MARGIN,
    );

    // --- Speed modifier ---
    // Turning reduces effective downhill component (cos²); brake key applies extra drag
    let speedMod = Math.max(Math.cos(angleRad) ** 2, 0.25);
    if (input.up)   speedMod *= (1 - BRAKE_RATE * dt * 6);   // active braking
    // down arrow no longer boosts speed

    // --- Update visual ---
    this.container.setPosition(this.x, this.screenY);

    // When curving right, the outside of the arc is the left side (and vice versa).
    // Outside ski tracks the direction of travel; inside ski splays outward.
    const lean = this.angle / MAX_ANGLE; // -1 … +1
    const splay = Math.abs(lean) * 10;  // max 10° splay at full turn
    const baseAngle = -lean * 60;        // ±60° spread evenly across the full turn range
    if (lean >= 0) {
      this.leftSki.setAngle(baseAngle);          // outside: direction of travel
      this.rightSki.setAngle(baseAngle - splay); // inside: splayed
    } else {
      this.rightSki.setAngle(baseAngle);         // outside: direction of travel
      this.leftSki.setAngle(baseAngle + splay);  // inside: splayed
    }

    // Redraw poles with current angle context
    this.drawPoles(lean);

    return speedMod;
  }

  // ---------------------------------------------------------------------------
  // Hit a ramp — launches the player airborne for JUMP_DURATION ms
  // ---------------------------------------------------------------------------
  hitRamp(): void {
    if (this.state !== PlayerState.Skiing) return;
    this.state        = PlayerState.Jumping;
    this.jumpElapsed  = 0;
    this.airTime      = 0;
    this.container.setDepth(DEPTH.PLAYER_AIR);
  }

  // ---------------------------------------------------------------------------
  // Trigger crash sequence — animates tumble then calls onComplete
  // ---------------------------------------------------------------------------
  crash(onComplete: () => void): void {
    if (this.state === PlayerState.Crashed || this.state === PlayerState.Caught) return;
    this.state = PlayerState.Crashed;

    this.scene.tweens.add({
      targets: this.container,
      angle: this.container.angle + 900,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 750,
      ease: 'Power3',
      onComplete,
    });
  }

  // ---------------------------------------------------------------------------
  // "Yeti got you" — eaten animation, then calls onComplete
  // ---------------------------------------------------------------------------
  caughtByYeti(onComplete: () => void): void {
    if (this.state === PlayerState.Crashed || this.state === PlayerState.Caught) return;
    this.state = PlayerState.Caught;

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0,
      scaleY: 0,
      duration: 350,
      ease: 'Back.easeIn',
      onComplete,
    });
  }

  // ---------------------------------------------------------------------------
  // Invincibility (star powerup)
  // ---------------------------------------------------------------------------
  private static readonly RAINBOW = [
    0xff0000, 0xff8800, 0xffff00, 0x00ff44, 0x0088ff, 0x8800ff, 0xff00cc,
  ] as const;

  startInvincibility(durationMs: number): void {
    this.invincible = true;
    this.rainbowIndex = 0;

    // Clear any existing timers (stacking stars resets duration)
    this.invincibleTimer?.remove(false);
    this.rainbowTimer?.remove(false);

    // Cycle body color through rainbow
    this.rainbowTimer = this.scene.time.addEvent({
      delay: 60,
      loop:  true,
      callback: () => {
        const c = Player.RAINBOW[this.rainbowIndex % Player.RAINBOW.length]!;
        this.body.setFillStyle(c);
        this.helmet.setFillStyle(c);
        this.rainbowIndex++;
      },
    });

    // End invincibility after duration
    this.invincibleTimer = this.scene.time.delayedCall(durationMs, () => {
      this.endInvincibility();
    });

    // Flash warning in last 2 seconds
    this.scene.time.delayedCall(durationMs - 2000, () => {
      if (!this.invincible) return;
      this.rainbowTimer?.remove(false);
      let flashOn = true;
      this.rainbowTimer = this.scene.time.addEvent({
        delay: 100,
        loop:  true,
        callback: () => {
          if (!this.invincible) return;
          if (flashOn) {
            const c = Player.RAINBOW[this.rainbowIndex % Player.RAINBOW.length]!;
            this.body.setFillStyle(c);
            this.helmet.setFillStyle(c);
            this.rainbowIndex++;
          } else {
            this.body.setFillStyle(COLORS.PLAYER_SUIT);
            this.helmet.setFillStyle(COLORS.PLAYER);
          }
          flashOn = !flashOn;
        },
      });
    });
  }

  private endInvincibility(): void {
    this.invincible = false;
    this.rainbowTimer?.remove(false);
    this.rainbowTimer = null;
    this.invincibleTimer = null;
    this.body.setFillStyle(COLORS.PLAYER_SUIT);
    this.helmet.setFillStyle(COLORS.PLAYER);
  }

  // ---------------------------------------------------------------------------
  // Speed boost (lightning powerup)
  // ---------------------------------------------------------------------------
  private static readonly BOLT_COLOR = 0xffdd00;

  startSpeedBoost(durationMs: number, multiplier: number): void {
    this.speedBoostMult = multiplier;

    // Clear any existing timers (stacking resets duration)
    this.boostTimer?.remove(false);
    this.boostFlashTimer?.remove(false);

    // Electric blue flash cycle
    let flashOn = true;
    this.boostFlashTimer = this.scene.time.addEvent({
      delay: 80,
      loop:  true,
      callback: () => {
        if (this.invincible) return; // rainbow takes priority
        if (flashOn) {
          this.body.setFillStyle(Player.BOLT_COLOR);
          this.helmet.setFillStyle(Player.BOLT_COLOR);
        } else {
          this.body.setFillStyle(COLORS.PLAYER_SUIT);
          this.helmet.setFillStyle(COLORS.PLAYER);
        }
        flashOn = !flashOn;
      },
    });

    // End boost after duration
    this.boostTimer = this.scene.time.delayedCall(durationMs, () => {
      this.endSpeedBoost();
    });
  }

  private endSpeedBoost(): void {
    this.speedBoostMult = 1;
    this.boostFlashTimer?.remove(false);
    this.boostFlashTimer = null;
    this.boostTimer = null;
    if (!this.invincible) {
      this.body.setFillStyle(COLORS.PLAYER_SUIT);
      this.helmet.setFillStyle(COLORS.PLAYER);
    }
  }

  destroy(): void {
    this.invincibleTimer?.remove(false);
    this.rainbowTimer?.remove(false);
    this.boostTimer?.remove(false);
    this.boostFlashTimer?.remove(false);
    this.container.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------
  private drawPoles(lean: number): void {
    this.poles.clear();
    this.poles.lineStyle(2, COLORS.SKI_POLE, 0.85);

    // Left pole: body left side → lower-left
    this.poles.beginPath();
    this.poles.moveTo(-5, -6);
    this.poles.lineTo(-18 + lean * 4, 18);
    this.poles.strokePath();

    // Right pole
    this.poles.beginPath();
    this.poles.moveTo(5, -6);
    this.poles.lineTo(18 + lean * 4, 18);
    this.poles.strokePath();
  }
}
