import Phaser from 'phaser';

export interface MenuNavItem {
  setFocus: (focused: boolean) => void;
  activate: () => void;
}

/**
 * Keyboard navigation manager for menu scenes.
 * First item receives focus automatically on construction.
 * Arrow keys move focus; Space/Enter activate the focused item.
 */
export class MenuNav {
  private index = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuNavItem[],
    axis: 'vertical' | 'horizontal' = 'vertical',
    private readonly initialFocusIndex = 0,
  ) {
    if (!items.length) return;
    this.index = initialFocusIndex;
    items[initialFocusIndex]!.setFocus(true);
    const kb = scene.input.keyboard;
    if (!kb) return;
    const prev = axis === 'vertical' ? 'UP'   : 'LEFT';
    const next = axis === 'vertical' ? 'DOWN' : 'RIGHT';
    kb.on(`keydown-${prev}`,  () => this.move(-1));
    kb.on(`keydown-${next}`,  () => this.move(+1));
    kb.on('keydown-SPACE',    () => items[this.index]!.activate());
    kb.on('keydown-ENTER',    () => items[this.index]!.activate());
  }

  /** Called by a button's pointerover to clear keyboard focus from the previously selected item. */
  hoverAt(index: number): void {
    this.items[this.index]!.setFocus(false);
    this.index = index;
  }

  private move(delta: number): void {
    this.items[this.index]!.setFocus(false);
    this.index = (this.index + delta + this.items.length) % this.items.length;
    this.items[this.index]!.setFocus(true);
  }
}
