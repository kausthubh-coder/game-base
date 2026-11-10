// A press of the right button is either a click or a drag, as in Roblox. A press that comes up within a few
// pixels of where it went down, and soon, is a click: it places or uses what the hero holds. A press that moves
// past the threshold is a drag: it turns the camera from then on and places nothing when it comes up. A press
// held still for long is neither, so a turn the hand barely started never sets a block down.
// Plain numbers, so a test can play a gesture without a page.

/** How far the pointer may wander, in CSS pixels, and the press still be a click. */
export const DRAG_PIXELS = 6;
/** How long a press may last, in milliseconds, and still be a click. */
export const CLICK_MS = 500;

/** What a press was when it came up. */
export type DragEnd = 'click' | 'drag' | 'none';

export class RightDrag {
  /** True from the press until it comes up or is cancelled. */
  down = false;
  /** True once the press has moved past the threshold. From then on it turns the camera. */
  dragging = false;
  /** Pixels to turn the camera by from the last move, right and down. */
  dx = 0;
  dy = 0;
  private x0 = 0;
  private y0 = 0;
  private x = 0;
  private y = 0;
  private t0 = 0;

  press(x: number, y: number, time: number): void {
    this.down = true;
    this.dragging = false;
    this.x0 = this.x = x;
    this.y0 = this.y = y;
    this.t0 = time;
    this.dx = this.dy = 0;
  }

  /**
   * The pointer is at x, y. Sets `dx` and `dy` to how far to turn: nothing before the threshold, the whole way
   * from the press on the move that crosses it, so the turn keeps up with the hand, and each move after that.
   * Returns true while it is a drag.
   */
  move(x: number, y: number): boolean {
    this.dx = this.dy = 0;
    if (!this.down) return false;
    if (!this.dragging && Math.hypot(x - this.x0, y - this.y0) > DRAG_PIXELS) {
      this.dragging = true;
      this.x = this.x0;
      this.y = this.y0;
    }
    if (this.dragging) {
      this.dx = x - this.x;
      this.dy = y - this.y;
    }
    this.x = x;
    this.y = y;
    return this.dragging;
  }

  /** The button came up. */
  release(time: number): DragEnd {
    if (!this.down) return 'none';
    const end: DragEnd = this.dragging ? 'drag' : time - this.t0 <= CLICK_MS ? 'click' : 'none';
    this.cancel();
    return end;
  }

  /** Forgets the press: something took the player, or the window lost focus. */
  cancel(): void {
    this.down = this.dragging = false;
    this.dx = this.dy = 0;
  }
}
