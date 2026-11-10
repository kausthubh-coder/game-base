import { expect, test } from 'bun:test';
import { install } from '../../game/views/core-sound.view.ts';
import type { GameView } from '../../game/shell/view.ts';
import { treeSoundScale } from './tree.sim.ts';

function fixture() {
  const listeners = new Map<string, (event: any) => void>();
  const heard: any[] = [], particles: any[] = [];
  let step: (dt: number) => void = () => {};
  const state = { breaking: null as null | { x: number; y: number; z: number; progress: number; tree: object | null }, primary: true };
  const view = {
    game: { systems: { actions: { breaking: () => state.breaking } }, events: { on: (name: string, fn: (event: any) => void) => listeners.set(name, fn) }, player: { busy: false } },
    audio: { emit: (e: any) => heard.push(structuredClone(e)), onEvent: (e: any) => heard.push(structuredClone(e)) },
    effects: { onEvent: (e: any) => particles.push(e) },
    keys: { get primary() { return state.primary; } },
    onFrame() {}, onSimStep(fn: (dt: number) => void) { step = fn; },
  };
  install(view as unknown as GameView);
  return { state, heard, particles, step: (dt = 0.05) => step(dt), emit: (name: string, event: object) => listeners.get(name)!(event) };
}

test('a whole fall replaces only the trunk break sound, preserving particles and other blocks', async () => {
  const f = fixture();
  f.emit('block.broken', { x: 1, y: 2, z: 3, id: 0 });
  f.emit('block.broken', { x: 4, y: 2, z: 3, id: 0 });
  f.emit('tree.felled', { x: 1, y: 2, z: 3, logs: 7 });
  await Promise.resolve();
  expect(f.heard.map(e => e.type)).toEqual(['treeFell', 'blockBroken']);
  expect(f.heard[0]).toEqual({ type: 'treeFell', logs: 7, at: { x: 1.5, y: 2.5, z: 3.5 } });
  expect(f.heard[1].at.x).toBe(4.5);
  expect(f.particles).toHaveLength(2);
});

test('an ordinary block still has exactly one break sound', async () => {
  const f = fixture();f.emit('block.broken', { x: 1, y: 2, z: 3, id: 0 });
  expect(f.heard).toHaveLength(0);await Promise.resolve();
  expect(f.heard.map(e => e.type)).toEqual(['blockBroken']);
});

test('advancing tree work chops immediately and every 0.3 seconds; release and non-trees are silent', () => {
  const f = fixture();
  f.state.breaking = { x: 1, y: 2, z: 3, progress: 0.01, tree: {} };
  for (let i = 0; i < 13; i++) { f.state.breaking.progress += 0.01; f.step(); }
  expect(f.heard.map(e => e.type)).toEqual(['treeChop', 'treeChop', 'treeChop']);
  f.state.primary = false;
  for (let i = 0; i < 20; i++) f.step();
  expect(f.heard).toHaveLength(3);
  f.state.primary = true; f.state.breaking.tree = null;
  for (let i = 0; i < 20; i++) { f.state.breaking.progress += 0.01; f.step(); }
  expect(f.heard).toHaveLength(3);
});

test('a stalled meter never repeats chop sounds', () => {
  const f = fixture();f.state.breaking = { x: 1, y: 2, z: 3, progress: 0.1, tree: {} };
  for (let i = 0; i < 100; i++) f.step();
  expect(f.heard.map(e => e.type)).toEqual(['treeChop']);
});

test('log count adds modest weight and has a hard cap', () => {
  expect(treeSoundScale(1)).toBe(1);expect(treeSoundScale(5)).toBe(1.1);
  expect(treeSoundScale(1000)).toBe(1.3);expect(treeSoundScale(0)).toBe(1);
});
