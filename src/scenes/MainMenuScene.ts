import Phaser from 'phaser';
import { SceneKey } from '@/config/SceneKeys';
import { WORLD_WIDTH, GAME_HEIGHT, COLORS, MAIN_MENU_BADGE_TEXT } from '@/data/constants';
import { addVersionLabel, addUsernameLabel } from '@/ui/versionLabel';
import { MenuNav, type MenuNavItem } from '@/ui/MenuNav';
import { fetchTotalRuns } from '@/services/LeaderboardService';

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
    this.add.text(WORLD_WIDTH / 2, 420, 'free2ski', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '280px',
      fontStyle: 'bold',
      color: COLORS.UI_TITLE,
      stroke: '#ffffff',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Badge — golden text above the top-right corner of the title, rotated clockwise.
    // Starts invisible; scales up once the network call resolves or fails.
    const badge = this.add.text(1300, 320, '', {
      fontFamily: 'FoxwhelpFont',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#001a6e',
      strokeThickness: 10,
    }).setOrigin(0.5).setAngle(12).setScale(0.01);

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

    // this.add.text(WORLD_WIDTH / 2, 557, 'a skiing adventure', {
    //   fontFamily: 'FoxwhelpFont',
    //   fontSize: '80px',
    //   color: COLORS.UI_SUBTITLE,
    // }).setOrigin(0.5);

    // Menu buttons
    let nav: MenuNav | undefined;
    const playItem        = this.createButton(WORLD_WIDTH / 2, 580, 650, 145, 'play',         100, 'bold', () => { this.scene.start(SceneKey.ModeSelect); },   () => nav?.hoverAt(0));
    const leaderboardItem = this.createButton(WORLD_WIDTH / 2, 720, 410, 105, 'leaderboard',   50, 'bold', () => { this.scene.start(SceneKey.Leaderboard); }, () => nav?.hoverAt(1));
    const settingsItem    = this.createButton(WORLD_WIDTH / 2, 830,  350,  85, 'settings',      60, 'bold', () => { this.scene.start(SceneKey.Settings); },    () => nav?.hoverAt(2));
    const patchNotesItem  = this.createButton(WORLD_WIDTH / 2, 935,  310,  70, 'patch notes',   44, 'bold', () => { this.scene.start(SceneKey.PatchNotes); }, () => nav?.hoverAt(3));
    nav = new MenuNav(this, [playItem, leaderboardItem, settingsItem, patchNotesItem]);

    addVersionLabel(this);
    addUsernameLabel(this);
  }

  private createButton(x: number, y: number, width: number, height: number, label: string, fontSize: number, fontStyle: string, onClick: () => void, onHover?: () => void): MenuNavItem {
    const bg = this.add.graphics();
    const labelText = this.add.text(x, y, label, {
      fontFamily: 'FoxwhelpFont',
      fontSize: fontSize + 'px',
      fontStyle,
      color: '#ffffff',
    }).setOrigin(0.5);

    const drawBg = (hovered: boolean): void => {
      bg.clear();
      bg.fillStyle(hovered ? COLORS.BTN_HOVER : COLORS.BTN, 1);
      bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 15);
      labelText.setText(hovered ? `~ ${label} ~` : label);
    };
    drawBg(false);

    const hitArea = this.add.rectangle(x, y, width, height)
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
