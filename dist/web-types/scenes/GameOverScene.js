import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, PX_PER_METER } from '@/data/constants';
import { HighScoreManager } from '@/data/HighScoreManager';
import { GameMode } from '@/config/GameModes';
export class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: SceneKey.GameOver });
    }
    init(data) {
        // Store data for use in create() — don't call this.add here
        this.summary = {
            distanceM: Math.floor((data.distancePx ?? 0) / PX_PER_METER),
            score: data.score ?? 0,
            session: data.session ?? { mode: GameMode.FreeSki },
            caughtByYeti: data.caughtByYeti ?? false,
        };
    }
    create() {
        // Submit run first so the result informs the whole UI
        const result = HighScoreManager.submitRun(this.summary.session.mode, this.summary.distanceM, this.summary.score);
        this.buildBackground();
        this.buildHeadline();
        this.buildStats(result);
        this.buildButtons();
    }
    // ---------------------------------------------------------------------------
    // Sections
    // ---------------------------------------------------------------------------
    buildBackground() {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a1520, 0x0a1520, 0x162535, 0x162535, 1);
        bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    }
    buildHeadline() {
        const { caughtByYeti, session } = this.summary;
        this.add.text(WORLD_WIDTH / 2, 58, session.mode.replace(/_/g, ' ').toUpperCase(), {
            fontFamily: 'sans-serif',
            fontSize: '14px',
            color: '#445566',
            letterSpacing: 3,
        }).setOrigin(0.5);
        this.add.text(WORLD_WIDTH / 2, 120, caughtByYeti ? 'THE YETI GOT YOU' : 'WIPEOUT', {
            fontFamily: 'sans-serif',
            fontSize: caughtByYeti ? '50px' : '62px',
            fontStyle: 'bold',
            color: caughtByYeti ? '#c8ddf0' : '#e63030',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
    }
    buildStats(result) {
        const { distanceM, score } = this.summary;
        const { isNewBest, prevBest } = result;
        // Distance — the headline number
        this.add.text(WORLD_WIDTH / 2, 226, `${distanceM.toLocaleString()} m`, {
            fontFamily: 'sans-serif',
            fontSize: '52px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);
        this.add.text(WORLD_WIDTH / 2, 290, `Score  ${score.toLocaleString()}`, {
            fontFamily: 'sans-serif',
            fontSize: '20px',
            color: '#6688aa',
        }).setOrigin(0.5);
        // Divider
        const div = this.add.graphics();
        div.lineStyle(1, 0x223344, 1);
        div.beginPath();
        div.moveTo(WORLD_WIDTH / 2 - 220, 328);
        div.lineTo(WORLD_WIDTH / 2 + 220, 328);
        div.strokePath();
        // Personal best comparison
        if (isNewBest) {
            this.buildNewBestBadge(distanceM, prevBest?.distance ?? null);
        }
        else {
            this.buildExistingBestRow(distanceM, prevBest?.distance ?? null);
        }
        // Run count footnote
        const total = HighScoreManager.getTotalRuns();
        this.add.text(WORLD_WIDTH / 2, GAME_HEIGHT - 22, `Run #${total}`, {
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#2a3a4a',
        }).setOrigin(0.5);
    }
    buildNewBestBadge(distanceM, prevM) {
        const badge = this.add.text(WORLD_WIDTH / 2, 360, '★  NEW PERSONAL BEST  ★', {
            fontFamily: 'sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 1,
        }).setOrigin(0.5);
        this.tweens.add({
            targets: badge,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        const sub = prevM !== null
            ? `+${distanceM - prevM} m over previous  (${prevM.toLocaleString()} m)`
            : 'First run on record!';
        this.add.text(WORLD_WIDTH / 2, 398, sub, {
            fontFamily: 'sans-serif',
            fontSize: '15px',
            color: '#88aacc',
        }).setOrigin(0.5);
    }
    buildExistingBestRow(distanceM, bestM) {
        const best = bestM ?? distanceM;
        this.add.text(WORLD_WIDTH / 2, 358, `Personal Best  ${best.toLocaleString()} m`, {
            fontFamily: 'sans-serif',
            fontSize: '19px',
            color: '#6688aa',
        }).setOrigin(0.5);
        if (bestM !== null) {
            const delta = distanceM - bestM;
            const prefix = delta >= 0 ? '+' : '';
            const color = delta >= 0 ? '#78bb78' : '#cc7777';
            this.add.text(WORLD_WIDTH / 2, 390, `${prefix}${delta} m this run`, {
                fontFamily: 'sans-serif',
                fontSize: '15px',
                color,
            }).setOrigin(0.5);
        }
    }
    buildButtons() {
        this.createButton(WORLD_WIDTH / 2, 464, 'PLAY AGAIN', () => {
            this.scene.start(SceneKey.Game, { session: this.summary.session });
        });
        this.createButton(WORLD_WIDTH / 2, 538, 'MAIN MENU', () => {
            this.scene.start(SceneKey.MainMenu);
        });
    }
    createButton(x, y, label, onClick) {
        const btnW = 270;
        const btnH = 54;
        const bg = this.add.graphics();
        const draw = (hovered) => {
            bg.clear();
            bg.fillStyle(hovered ? 0x3a6ae8 : 0x2a5ab8, 1);
            bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
        };
        draw(false);
        this.add.text(x, y, label, {
            fontFamily: 'sans-serif',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);
        const hit = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => draw(true));
        hit.on('pointerout', () => draw(false));
        hit.on('pointerdown', onClick);
    }
}
