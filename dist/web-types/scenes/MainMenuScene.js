import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: SceneKey.MainMenu });
    }
    create() {
        // Background gradient (snowy slope feel)
        const bg = this.add.graphics();
        bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
        bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
        // Title
        this.add.text(WORLD_WIDTH / 2, 160, 'SKIFREE', {
            fontFamily: 'sans-serif',
            fontSize: '72px',
            fontStyle: 'bold',
            color: '#1a3a8a',
            stroke: '#ffffff',
            strokeThickness: 4,
        }).setOrigin(0.5);
        this.add.text(WORLD_WIDTH / 2, 240, 'An endless skiing adventure', {
            fontFamily: 'sans-serif',
            fontSize: '22px',
            color: '#3a5a9a',
        }).setOrigin(0.5);
        // Menu buttons
        this.createButton(WORLD_WIDTH / 2, 340, 'PLAY', () => {
            this.scene.start(SceneKey.ModeSelect);
        });
        this.createButton(WORLD_WIDTH / 2, 420, 'LEADERBOARD', () => {
            this.scene.start(SceneKey.Leaderboard);
        });
        this.createButton(WORLD_WIDTH / 2, 500, 'SETTINGS', () => {
            this.scene.start(SceneKey.Settings);
        });
    }
    createButton(x, y, label, onClick) {
        const btnW = 260;
        const btnH = 54;
        const bg = this.add.graphics();
        const drawBg = (hovered) => {
            bg.clear();
            bg.fillStyle(hovered ? 0x1a3a8a : 0x2a5ab8, 1);
            bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
        };
        drawBg(false);
        const text = this.add.text(x, y, label, {
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);
        const hitArea = this.add.rectangle(x, y, btnW, btnH)
            .setInteractive({ useHandCursor: true });
        hitArea.on('pointerover', () => drawBg(true));
        hitArea.on('pointerout', () => drawBg(false));
        hitArea.on('pointerdown', onClick);
    }
}
