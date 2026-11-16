import { afterEach, expect, test } from 'bun:test';
import type { Fight } from '../fight/fight.sim.ts';
import type { Press } from '../shell/keys.ts';
import type { GameView } from '../shell/view.ts';
import { createKeys } from './keys.ts';

const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => { if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); });

test('typed touch combat respects ready, busy and pause gates and companion ownership', () => {
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  let listener: (press: Press) => void = () => {};
  const actions: string[] = [];
  const view = {
    game: { player: { busy: false } }, paused: false, ctx: { camera: {} },
    keys: { onPress(fn: typeof listener) { listener = fn; } },
    hero: { body: { tuning: { walkSpeed: 4 } } },
  } as unknown as GameView;
  let ownsSkill = false;
  const fight = { press(action: string) { actions.push(action); } } as unknown as Fight;
  const keys = createKeys(view, fight, { feel: {} as never, say() {}, groundY: () => 0, weapon() {}, skill: () => ownsSkill });
  listener({ kind: 'fight', action: 'dodge' });
  expect(actions).toEqual([]);
  keys.ready = true;
  listener({ kind: 'fight', action: 'dodge' });
  listener({ kind: 'fight', action: 'use' });
  listener({ kind: 'fight', action: 'skill' });
  ownsSkill = true;
  listener({ kind: 'fight', action: 'skill' });
  view.game.player.busy = true;
  listener({ kind: 'fight', action: 'dodge' });
  view.game.player.busy = false;
  Object.defineProperty(view, 'paused', { value: true });
  listener({ kind: 'fight', action: 'dodge' });
  expect(actions).toEqual(['dodge', 'use', 'skill']);
});
