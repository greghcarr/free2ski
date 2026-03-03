import Phaser from 'phaser';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;     // brake / lean back
  down: boolean;   // tuck / crouch (speed boost)
  action: boolean; // jump / confirm (Space)
}

export class InputSystem {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keyA: Phaser.Input.Keyboard.Key | null = null;
  private keyD: Phaser.Input.Keyboard.Key | null = null;
  private keyW: Phaser.Input.Keyboard.Key | null = null;
  private keyS: Phaser.Input.Keyboard.Key | null = null;
  private keySpace: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;

    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  getState(): InputState {
    return {
      left:   (this.cursors?.left.isDown  ?? false) || (this.keyA?.isDown ?? false),
      right:  (this.cursors?.right.isDown ?? false) || (this.keyD?.isDown ?? false),
      up:     (this.cursors?.up.isDown    ?? false) || (this.keyW?.isDown ?? false),
      down:   (this.cursors?.down.isDown  ?? false) || (this.keyS?.isDown ?? false),
      action: (this.cursors?.space.isDown ?? false) || (this.keySpace?.isDown ?? false),
    };
  }

  destroy(): void {
    this.keyA?.destroy();
    this.keyD?.destroy();
    this.keyW?.destroy();
    this.keyS?.destroy();
    this.keySpace?.destroy();
  }
}
