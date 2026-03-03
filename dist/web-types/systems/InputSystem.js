import Phaser from 'phaser';
export class InputSystem {
    constructor(scene) {
        this.cursors = null;
        this.keyA = null;
        this.keyD = null;
        this.keyW = null;
        this.keyS = null;
        this.keySpace = null;
        const kb = scene.input.keyboard;
        if (!kb)
            return;
        this.cursors = kb.createCursorKeys();
        this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    getState() {
        return {
            left: (this.cursors?.left.isDown ?? false) || (this.keyA?.isDown ?? false),
            right: (this.cursors?.right.isDown ?? false) || (this.keyD?.isDown ?? false),
            up: (this.cursors?.up.isDown ?? false) || (this.keyW?.isDown ?? false),
            down: (this.cursors?.down.isDown ?? false) || (this.keyS?.isDown ?? false),
            action: (this.cursors?.space.isDown ?? false) || (this.keySpace?.isDown ?? false),
        };
    }
    destroy() {
        this.keyA?.destroy();
        this.keyD?.destroy();
        this.keyW?.destroy();
        this.keyS?.destroy();
        this.keySpace?.destroy();
    }
}
