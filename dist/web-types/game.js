import Phaser from 'phaser';
import { WORLD_WIDTH, GAME_HEIGHT } from '@/data/constants';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { ModeSelectScene } from '@/scenes/ModeSelectScene';
import { GameScene } from '@/scenes/GameScene';
import { GameOverScene } from '@/scenes/GameOverScene';
import { PauseScene } from '@/scenes/PauseScene';
import { LeaderboardScene } from '@/scenes/LeaderboardScene';
import { SettingsScene } from '@/scenes/SettingsScene';
export function createGame(platform) {
    const config = {
        type: Phaser.AUTO,
        width: WORLD_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: '#e8f0f8',
        parent: document.body,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: 0 },
                debug: false,
            },
        },
        scene: [
            BootScene,
            PreloadScene,
            MainMenuScene,
            ModeSelectScene,
            GameScene,
            PauseScene,
            GameOverScene,
            LeaderboardScene,
            SettingsScene,
        ],
        // Attach the platform service so scenes can access it via this.game.registry
        callbacks: {
            preBoot: (game) => {
                game.registry.set('platform', platform);
            },
        },
    };
    return new Phaser.Game(config);
}
