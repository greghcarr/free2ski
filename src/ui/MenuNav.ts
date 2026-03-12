import Phaser from 'phaser';

export interface MenuNavItem {
  setFocus: (focused: boolean) => void;
  activate: () => void;
}

/**
 * Keyboard navigation manager for menu scenes.
 * Keyboard focus is NOT shown until the user presses an arrow key, so mouse
 * and touch users see no pre-selected item.  Arrow keys move focus;
 * Space/Enter activate the focused item once keyboard mode is active.
 */
export class MenuNav {
  private index = 0;
  private hasFocus = false;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuNavItem[],
    axis: 'vertical' | 'horizontal' = 'vertical',
  ) {
    if (!items.length) return;
    const kb = scene.input.keyboard;
    if (!kb) return;
    const prev = axis === 'vertical' ? 'UP'   : 'LEFT';
    const next = axis === 'vertical' ? 'DOWN' : 'RIGHT';
    kb.on(`keydown-${prev}`,  () => this.move(-1));
    kb.on(`keydown-${next}`,  () => this.move(+1));
    kb.on('keydown-SPACE',    () => { if (this.hasFocus) this.items[this.index]!.activate(); });
    kb.on('keydown-ENTER',    () => { if (this.hasFocus) this.items[this.index]!.activate(); });
  }

  /** Called by a button's pointerover to clear keyboard focus. */
  hoverAt(index: number): void {
    if (this.hasFocus) {
      this.items[this.index]!.setFocus(false);
      this.hasFocus = false;
    }
    this.index = index;
  }

  /** Directly focus a specific item by index, entering keyboard mode. */
  focusAt(index: number): void {
    if (this.hasFocus) this.items[this.index]!.setFocus(false);
    this.index    = (index + this.items.length) % this.items.length;
    this.hasFocus = true;
    this.items[this.index]!.setFocus(true);
  }

  move(delta: number): void {
    if (!this.hasFocus) {
      this.index = 0;
      this.hasFocus = true;
    } else {
      this.items[this.index]!.setFocus(false);
      this.index = (this.index + delta + this.items.length) % this.items.length;
    }
    this.items[this.index]!.setFocus(true);
  }
}
