import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, MAIN_MENU_BADGE_TEXT } from '@/data/constants';
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
      color: COLORS.UI_TITLE,
      stroke: '#ffffff',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Badge — golden text above the top-right corner of the title, rotated clockwise
    const badge = this.add.text(1300, 320, MAIN_MENU_BADGE_TEXT, {
      fontFamily: 'FoxwhelpFont',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#001a6e',
      strokeThickness: 10,
    }).setOrigin(0.5).setAngle(12);

    this.tweens.add({
      targets: badge,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // this.add.text(WORLD_WIDTH / 2, 557, 'a skiing adventure', {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize: '80px',
    //   color: COLORS.UI_SUBTITLE,
    // }).setOrigin(0.5);

    // Menu buttons
    let nav: MenuNav | undefined;
    const playItem        = this.createButton(WORLD_WIDTH / 2, 630, 650, 145, 'play', 100, 'bold',      () => { this.scene.start(SceneKey.ModeSelect); },   () => nav?.hoverAt(0));
    // const leaderboardItem = this.createButton(WORLD_WIDTH / 2, 810, 410, 105, 'leaderboard', 50, 'bold', () => { this.scene.start(SceneKey.Leaderboard); }, () => nav?.hoverAt(1));
    const settingsItem    = this.createButton(WORLD_WIDTH / 2, 780, 400, 105, 'settings', 60, 'bold',  () => { this.scene.start(SceneKey.Settings); },    () => nav?.hoverAt(1));
    nav = new MenuNav(this, [
      playItem, 
      // leaderboardItem, 
      settingsItem
    ]);

    addVersionLabel(this);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void, onHover?: () => void): MenuNavItem {
    const btnW = 260;
    const btnH = 54;

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
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
