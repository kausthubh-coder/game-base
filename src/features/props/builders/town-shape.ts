import { Shape, type Tone } from '../shape.ts';
/** Broad edges catch the sun. Keep tiny rails square so board divisions stay visible. */
export class TownShape extends Shape {
  private softened = 0;
  override box(x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone, options: Parameters<Shape['box']>[7] = {}): void {
    const broad = w >= .3 && h >= .25 && d >= .2 && this.softened < 2;
    if (broad) this.softened++;
    super.box(x,y,z,w,h,d,tone, broad ? { ...options, bevel: options.bevel ?? .035 } : options);
  }
}
