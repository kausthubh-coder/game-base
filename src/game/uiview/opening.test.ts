import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import { OPENING } from '../content/opening.ts';
import { createKernel } from '../kernel.sim.ts';
import { OPENING_FLAG, createOpening, markNewGame, playsOpening, takeNewGame } from './opening.ts';

/** A stand-in for sessionStorage. */
function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

test('the opening plays on a new game chosen from the title, once, and never on Continue', () => {
  const storage = store();
  const kernel = createKernel(new World(1), 1);
  const flags = kernel.game.flags;

  // The title's New game marks the choice, and the start that follows takes it.
  markNewGame(storage);
  expect(playsOpening({ fresh: true, chosen: takeNewGame(storage), flags })).toBe(true);
  // The view sets the flag as it begins, and it is saved with the game.
  flags.set(OPENING_FLAG, true);
  const save = kernel.save();

  // The mark is gone: a second start in this tab without the button does not play it.
  expect(takeNewGame(storage)).toBe(false);
  // Continue: a loaded game is not fresh, and its save has the flag.
  const later = createKernel(new World(1), 1);
  later.load(save);
  expect(playsOpening({ fresh: false, chosen: false, flags: later.game.flags })).toBe(false);
  // Even a save made in the first second, loaded after a New game was pressed, has seen it.
  expect(playsOpening({ fresh: true, chosen: true, flags: later.game.flags })).toBe(false);
  // A game started by the debug door or a test is never chosen from the title.
  const door = createKernel(new World(1), 1);
  expect(playsOpening({ fresh: true, chosen: takeNewGame(storage), flags: door.game.flags })).toBe(false);
});

test('the opening shows every shot in order with a line each, starts and cuts through black, and ends on the hero', () => {
  const opening = createOpening(OPENING);
  expect(OPENING.length).toBeGreaterThanOrEqual(3);
  expect(OPENING.every((shot) => shot.line.length > 0)).toBe(true);
  expect(OPENING.filter((shot) => shot.land).map((shot) => shot.id)).toEqual([OPENING[OPENING.length - 1].id]);
  const first = opening.frame();
  expect([first.shot, first.black, first.bars, first.words]).toEqual([0, 1, 1, 0]);

  const seen: number[] = [];
  let start = 0, wordsShown = new Set<number>();
  for (const [i, shot] of OPENING.entries()) {
    // The middle of each shot is clear, with its line up and the bars in.
    opening.advance(start + shot.seconds / 2 - opening.time);
    const mid = opening.frame();
    seen.push(mid.shot);
    expect(mid.black).toBe(0);
    expect(mid.bars).toBe(1);
    if (mid.words === 1) wordsShown.add(i);
    // Between two shots the screen is black.
    if (i < OPENING.length - 1) {
      opening.advance(start + shot.seconds - 0.001 - opening.time);
      expect(opening.frame().black).toBeGreaterThan(0.99);
    }
    start += shot.seconds;
  }
  expect(seen).toEqual(OPENING.map((_, i) => i));
  expect(wordsShown.size).toBe(OPENING.length);

  opening.advance(opening.length);
  const last = opening.frame();
  expect(last.done).toBe(true);
  expect([last.shot, last.move, last.black, last.bars]).toEqual([OPENING.length - 1, 1, 0, 0]);
});

test('skip ends the opening at any point: a short dip to black, then the hero with no bars', () => {
  for (const at of [0, 3.2, 9, 20]) {
    const opening = createOpening(OPENING);
    opening.advance(at);
    opening.skip();
    expect(opening.skipped).toBe(true);
    expect(opening.done).toBe(false);
    opening.advance(0.3);
    expect(opening.frame().black).toBeGreaterThan(0.99);
    opening.advance(0.6);
    const after = opening.frame();
    expect(after.done).toBe(true);
    expect([after.shot, after.move, after.black, after.bars, after.words]).toEqual([OPENING.length - 1, 1, 0, 0, 0]);
    // It took under a second, wherever it was skipped.
    expect(opening.time - at).toBeLessThan(1);
  }
});
