import { afterEach, expect, test } from 'bun:test';
import { FLAG } from '../content/flags.ts';
import { newPlay } from '../play/harness.sim.ts';
import { equippedWeapon } from './bag.ui.ts';
import type { UiContext } from './types.ui.ts';

const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'document', original);
  else Reflect.deleteProperty(globalThis, 'document');
});

/** Only the element operations used by the real equipment row; browser layout is checked in the release replay. */
class Element {
  children: (Element | string)[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  classList = { add() {} };
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  append(child: Element | string) { this.children.push(child); }
  get textContent(): string { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(' '); }
  set textContent(text: string) { this.children = [text]; }
}

for (const weapon of ['sword', 'bow', 'staff'] as const) {
  test(`Bag shows the equipped guild ${weapon} before and after Continue without creating bag items`, () => {
    Object.defineProperty(globalThis, 'document', { value: { createElement: () => new Element() }, configurable: true });
    const p = newPlay();
    p.game.flags.set(FLAG.choice('weapon'), weapon);
    const icons: string[] = [];
    const context = (game: UiContext['game']) => ({ game, options: { icon(name: string) { icons.push(name); return null; } } }) as Pick<UiContext, 'game' | 'options'>;
    const first = equippedWeapon(context(p.game)) as unknown as Element;
    expect(first.attrs['aria-label']).toBe('Equipped combat weapon');
    expect(first.textContent).toContain(`Guild ${weapon}`);
    expect(first.textContent).toContain('Equipped for combat');
    expect(icons).toEqual([`act1-${weapon}`]);
    const q = p.reload();
    const continued = equippedWeapon(context(q.game)) as unknown as Element;
    expect(continued.textContent).toContain(`Guild ${weapon}`);
    expect(p.sys.inventory.slots.filter(Boolean)).toEqual([]);
    expect(q.sys.inventory.slots.filter(Boolean)).toEqual([]);
  });
}

test('Bag does not claim a guild weapon before the rack choice', () => {
  const p = newPlay();
  expect(equippedWeapon({ game: p.game } as Pick<UiContext, 'game' | 'options'>)).toBeNull();
});
