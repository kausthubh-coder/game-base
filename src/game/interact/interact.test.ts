import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import type { Interactable } from '../api.sim.ts';
import { createKernel } from '../kernel.sim.ts';
import { install } from './index.sim.ts';

function registry() {
  const kernel = createKernel(new World(1), 1);
  install(kernel);
  const acted: string[] = [];
  const target = (id: string, x: number, z: number, radius = 3, prompt: string | null = `Use ${id}`): Interactable => ({
    id, radius, pos: () => ({ x, y: 0, z }), prompt: () => prompt, act: () => void acted.push(id),
  });
  return { game: kernel.game, interact: kernel.game.systems.interact, acted, target };
}

test('nearest picks the closer of two, and act runs it', () => {
  const { interact, acted, target } = registry();
  interact.add(target('far', 2.5, 0));
  interact.add(target('close', 0, 1));
  expect(interact.nearest()?.id).toBe('close');
  expect(interact.nearest()?.prompt()).toBe('Use close');
  expect(interact.act()).toBe(true);
  expect(acted).toEqual(['close']);
});

test('the closer one changes as the player walks', () => {
  const { game, interact, target } = registry();
  interact.add(target('west', -2, 0));
  interact.add(target('east', 2, 0));
  game.player.pos.x = 0.5;
  expect(interact.nearest()?.id).toBe('east');
  game.player.pos.x = -0.5;
  expect(interact.nearest()?.id).toBe('west');
});

test('a target out of its own radius or with no prompt is passed over', () => {
  const { interact, acted, target } = registry();
  interact.add(target('silent', 0.5, 0, 3, null));
  interact.add(target('short', 1, 0, 0.9));
  expect(interact.nearest()).toBeNull();
  expect(interact.act()).toBe(false);
  interact.add(target('wide', 4, 0, 4));
  expect(interact.nearest()?.id).toBe('wide');
  expect(acted).toEqual([]);
});

test('height counts toward the distance', () => {
  const { game, interact, target } = registry();
  interact.add(target('ledge', 0, 0, 2));
  game.player.pos.y = -3;
  expect(interact.nearest()).toBeNull();
});

test('nothing acts and no prompt shows while the player is busy', () => {
  const { game, interact, acted, target } = registry();
  interact.add(target('door', 1, 0));
  game.player.busy = true;
  expect(interact.nearest()).toBeNull();
  expect(interact.act()).toBe(false);
  expect(acted).toEqual([]);
  game.player.busy = false;
  expect(interact.act()).toBe(true);
  expect(acted).toEqual(['door']);
});

test('remove takes a target out, and adding the same id again replaces it', () => {
  const { interact, acted, target } = registry();
  interact.add(target('bench', 1, 0));
  interact.add({ ...target('bench', 1, 0), prompt: () => 'Craft' });
  expect(interact.nearest()?.prompt()).toBe('Craft');
  interact.remove('bench');
  expect(interact.nearest()).toBeNull();
  expect(interact.act()).toBe(false);
  expect(acted).toEqual([]);
});
