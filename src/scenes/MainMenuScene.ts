import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS } from '@/data/constants';
import { addVersionLabel } from '@/ui/versionLabel';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.MainMenu });
  }

  create(): void {
    // Background gradient (snowy slope feel)
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.SNOW_LIGHT, COLORS.SNOW_LIGHT, COLORS.SNOW_SHADOW, COLORS.SNOW_SHADOW, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Title
    this.add.text(WORLD_WIDTH / 2, 160, 'FREE2SKI', {
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
    let nav: MenuNav | undefined;
    const playItem        = this.createButton(WORLD_WIDTH / 2, 340, 'PLAY',        () => { this.scene.start(SceneKey.ModeSelect); },   () => nav?.hoverAt(0));
    const leaderboardItem = this.createButton(WORLD_WIDTH / 2, 420, 'LEADERBOARD', () => { this.scene.start(SceneKey.Leaderboard); }, () => nav?.hoverAt(1));
    const settingsItem    = this.createButton(WORLD_WIDTH / 2, 500, 'SETTINGS',    () => { this.scene.start(SceneKey.Settings); },    () => nav?.hoverAt(2));
    nav = new MenuNav(this, [playItem, leaderboardItem, settingsItem]);

    addVersionLabel(this);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void, onHover?: () => void): MenuNavItem {
    const btnW = 260;
    const btnH = 54;

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? 0x1a3a8a : 0x2a5ab8, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
    };
    drawBg(false);

    this.add.text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(x, y, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => { onHover?.(); drawBg(true); });
    hitArea.on('pointerout',  () => drawBg(false));
    hitArea.on('pointerdown', onClick);

    return {
      setFocus: (f) => drawBg(f),
      activate: onClick,
    };
  }
}
