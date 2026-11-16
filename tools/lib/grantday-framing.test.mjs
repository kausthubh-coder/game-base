import { test, expect } from 'bun:test';
import { framingIssues } from './grantday-framing.mjs';
const body = (id, x, depth = -10) => ({ id, inFrame: true, depth, face: { x, y: 20 }, chest: { x, y: 40 }, box: { left: x - 10, right: x + 10, top: 15, bottom: 60 } });
const frame = (actors) => ({ line: { scene: 6 }, actors });
test('real Saltgate cast is required even when sight omits it', () => {
  expect(framingIssues(frame([body('player', 20)]))).toEqual(['saltgate:hobb: body cropped', 'saltgate:dax: body cropped']);
});
test('a foreground ward covering the hero fails', () => {
  const actors = [body('player', 20), body('saltgate:hobb', 60), body('saltgate:dax', 100), body('saltgate:crowd:1', 20, -9)];
  expect(framingIssues(frame(actors))).toContain('player: face overlapped by saltgate:crowd:1');
});
test('separated cast passes; a cropped Dax fails', () => {
  const actors = [body('player', 20), body('stage:hobb', 60), body('stage:dax', 100)];
  expect(framingIssues(frame(actors))).toEqual([]);
  actors[2].inFrame = false;
  expect(framingIssues(frame(actors))).toEqual(['stage:dax: body cropped']);
});
