import { afterEach, expect, test } from 'bun:test';
import type { Fight } from '../fight/fight.sim.ts';
import { createFight } from '../fight/fight.sim.ts';
import { arenaStage } from '../fight/arena.sim.ts';
import type { HeroInput } from '../../features/hero/index.ts';
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

test('shared practice controls route primary, held release and touch dodge without a Mark or companion', () => {
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  let listener: (press: Press) => void = () => {};
  const fight = createFight(arenaStage(0, 0), { way: 'hero', weapon: 'bow', external: true });
  fight.placeHero(0.5, 0);
  fight.input.aimX = 0.5;
  fight.input.aimZ = -2;
  const target = fight.addTarget({ x: 0.5, z: -2, radius: 0.5, guard: 100, high: true });
  const shots: string[] = [];
  const view = {
    game: { player: { busy: false } }, paused: false, ctx: { camera: {} }, claim() {},
    keys: { primary: false, touch: { calmHeld: true }, onPress(fn: typeof listener) { listener = fn; } },
    hero: { drive: null, body: { x: 0.5, z: 0, vx: 0, vz: 0, tuning: { walkSpeed: 4 } } },
  } as unknown as GameView;
  const keys = createKeys(view, fight, { feel: { freeze: 0, hear(e: { type: string; text: string }) { if (e.type === 'shot') shots.push(e.text); } } as never, say() {}, groundY: () => 0, weapon() {}, calm: () => false, skill: () => true });
  keys.use(true);
  const step = (n: number) => {
    for (let i = 0; i < n; i++) view.hero.drive!({ moveX: 0, moveZ: 0, jump: false } as HeroInput, view.hero.body);
  };
  listener({ kind: 'fight', action: 'use' });
  listener({ kind: 'fight', action: 'skill' });
  step(1);
  expect(fight.input.calmHeld).toBe(false);
  expect(fight.record.skills).toBe(0);
  listener({ kind: 'use', button: 'primary' });
  step(36);
  expect(target.guard).toBe(94);
  Object.assign(view.keys, { primary: true });
  step(60);
  Object.assign(view.keys, { primary: false });
  step(36);
  expect(shots).toEqual(['arrow', 'drawn']);
  expect(94 - target.guard).toBeGreaterThanOrEqual(24);
  listener({ kind: 'fight', action: 'dodge' });
  step(1);
  expect(fight.hero.act).toBe('dodge');
  expect(fight.record.dodges).toBe(1);
  keys.use(false);
  expect(view.hero.drive).toBeNull();
});
