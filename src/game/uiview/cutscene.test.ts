import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import { FILMS, SCENE_9, filmFlag, type Film } from '../content/cutscenes.ts';
import { REGION } from '../content/region.ts';
import { createKernel } from '../kernel.sim.ts';
import { createFilm, filmFrame, newFrame, placesOf, resolveFilm, startsFilm, trackAt, walkAlong, type Cut, type FilmFrame } from './cutscene.ts';

/** The region's places as the region system gives them: the middle of the block, at the height of the feet. */
const places = (name: string) => {
  const p = REGION.places.find((place) => place.name === name);
  return p ? { x: p.x + 0.5, y: p.y, z: p.z + 0.5 } : null;
};
const cut = resolveFilm(SCENE_9, places) as Cut;
const at = (t: number): FilmFrame => filmFrame(cut, t);
const startOf = (id: string): number => cut.starts[SCENE_9.shots.findIndex((shot) => shot.id === id)];
const endOf = (id: string): number => {
  const i = SCENE_9.shots.findIndex((shot) => shot.id === id);
  return cut.starts[i] + SCENE_9.shots[i].seconds;
};
const hero = (f: FilmFrame) => f.puppets.find((p) => p.actor === 'player')!;
const fox = (f: FilmFrame) => f.puppets.find((p) => p.actor === 'fox:blighted')!;
const near = (a: { x: number; z: number }, b: { x: number; z: number }, by = 1e-6): boolean => Math.hypot(a.x - b.x, a.z - b.z) <= by;

test('scene 9 is six shots and 24 to 26 seconds long, and every place it names is in the region', () => {
  expect(SCENE_9.shots.map((s) => s.id)).toEqual(['dusk', 'fire', 'listen', 'trees', 'edge', 'play']);
  expect(cut.length).toBeGreaterThanOrEqual(24);
  expect(cut.length).toBeLessThanOrEqual(26);
  for (const name of placesOf(SCENE_9)) expect(places(name), name).not.toBeNull();
});

test('in the fire shot the hero sits at camp.seat', () => {
  const seat = places('camp.seat')!;
  for (let t = startOf('fire'); t < endOf('fire'); t += 0.25) {
    const h = hero(at(t));
    expect(near(h, seat), `${t}`).toBe(true);
    expect(h.pose.anim, `${t}`).toBe('sit');
    expect(h.visible).toBe(true);
  }
});

test('the fire sinks in the listening shot: its light is lower after it than before it', () => {
  const before = at(startOf('listen') - 0.01).fire, after = at(endOf('listen')).fire;
  expect(after).toBeLessThan(before);
  // By a third.
  expect(after / before).toBeCloseTo(2 / 3, 1);
  expect(at(startOf('listen') - 0.01).fireLow).toBe(false);
  expect(at(endOf('listen')).fireLow).toBe(true);
});

test('the fox comes out of the trees in the trees shot and ends it at camp.edge, shaking', () => {
  const trees = places('camp.trees')!, edge = places('camp.edge')!;
  // Nowhere to be seen before it.
  for (let t = 0; t < startOf('trees'); t += 0.5) expect(fox(at(t)).visible, `${t}`).toBe(false);
  const first = fox(at(startOf('trees') + 0.01));
  expect(first.visible).toBe(true);
  expect(near(first, trees)).toBe(true);
  const last = fox(at(endOf('trees') - 0.001));
  expect(near(last, edge)).toBe(true);
  expect(last.pose.anim).toBe('shake');
  expect(last.pose.or.anim).toBe('idle');
});

test('the fox walks: slow to start and to stop, never sliding, its steps following the ground it covers', () => {
  const walk = SCENE_9.puppets[1].beats.find((b) => b.to)!;
  const dt = 1 / 60;
  let last = fox(at(walk.at)), lastWalked = 0, top = 0;
  const speeds: number[] = [];
  for (let t = walk.at + dt; t <= walk.at + walk.move!; t += dt) {
    const f = fox(at(t));
    const step = Math.hypot(f.x - last.x, f.z - last.z);
    speeds.push(step / dt);
    // The animation is driven by the distance walked: the two agree at every frame.
    if (f.walked >= 0) {
      expect(f.walked - lastWalked).toBeCloseTo(step, 6);
      lastWalked = f.walked;
    }
    top = Math.max(top, step / dt);
    last = { ...f };
  }
  // From a standing start and to a standstill, not at a constant speed.
  expect(speeds[0]).toBeLessThan(top * 0.1);
  expect(speeds.at(-1)!).toBeLessThan(top * 0.1);
  // A slow walk: under the speed the rules give it.
  expect(top).toBeLessThan(2.2);
});

test('the words show only in the edge shot', () => {
  let shown = 0;
  for (let t = 0; t <= cut.length; t += 0.05) {
    const f = at(t);
    if (f.words > 0) {
      shown++;
      expect(SCENE_9.shots[f.shot].id, `${t}`).toBe('edge');
      expect(f.text).toBe('The fire is low. Something is standing at the edge of the light.');
    }
  }
  expect(shown).toBeGreaterThan(20);
  expect(at(startOf('edge') + 2).words).toBe(1);
});

test('the frame at the end is the film\'s land: everyone where play resumes, on the game\'s own camera, no bars, no black', () => {
  const end = at(cut.length);
  expect(end.done).toBe(true);
  expect([end.land, end.black, end.bars, end.words]).toEqual([1, 0, 0, 0]);
  for (const p of end.puppets) {
    const land = cut.land[p.actor];
    expect(land, p.actor).toBeDefined();
    expect(near(p, land), p.actor).toBe(true);
    expect(Math.abs(Math.sin(p.facing - land.facing)) + (Math.cos(p.facing - land.facing) < 0 ? 1 : 0), p.actor).toBeLessThan(1e-6);
    expect(p.visible).toBe(true);
  }
  // The hero ends standing, in the stance of play.
  expect(hero(end).pose.sprite).toBe('hero');
  expect(hero(end).pose.anim).toBe('idle');
  // The land is the hall's: the fox where the rules stand it, the hero where the director puts the player.
  expect(near(cut.land['fox:blighted'], places('camp.edge')!)).toBe(true);
  expect(near(cut.land.player, places('camp.seat')!)).toBe(true);
});

test('the lens moves eased, never from a standing start at full speed, and holds dusk across the film', () => {
  for (let i = 0; i < SCENE_9.shots.length - 1; i++) {
    const s = cut.starts[i], e = s + SCENE_9.shots[i].seconds;
    const a = at(s + 0.001), b = at(s + 0.05), c = at(s + SCENE_9.shots[i].seconds / 2), d = at(s + SCENE_9.shots[i].seconds / 2 + 0.05);
    const startSpeed = Math.hypot(b.lens.x - a.lens.x, b.lens.y - a.lens.y, b.lens.z - a.lens.z);
    const midSpeed = Math.hypot(d.lens.x - c.lens.x, d.lens.y - c.lens.y, d.lens.z - c.lens.z);
    expect(startSpeed, SCENE_9.shots[i].id).toBeLessThan(midSpeed * 0.2 + 1e-9);
    expect(at(e - 0.0001).move).toBeGreaterThan(0.99);
  }
  // Dusk from the first frame to the last, a little darker at the end.
  const first = at(0).timeOfDay, last = at(cut.length).timeOfDay;
  expect(first).toBeGreaterThanOrEqual(0.73);
  expect(last).toBeGreaterThan(first);
  expect(last).toBeLessThan(0.8);
});

test('the crickets stop 3.4 seconds into the fire shot, the twig snaps on the cut, and the note swells in the trees shot', () => {
  const stop = startOf('fire') + 3.4;
  expect(at(stop - 0.05).world).toBe(1);
  expect(at(stop + 0.5).world).toBe(0);
  expect(at(startOf('listen') - 0.01).cues).toBe(0);
  expect(at(startOf('listen')).cues).toBe(1);
  expect(SCENE_9.sound.cues[0].cue).toBe('twig');
  expect(at(startOf('trees')).note).toBe(0);
  expect(at(endOf('trees')).note).toBeGreaterThan(0.6);
  // The night comes back, quieter than before.
  expect(at(cut.length).world).toBeGreaterThan(0);
  expect(at(cut.length).world).toBeLessThan(1);
});

test('a skip at any moment leaves the same world as watching to the end', () => {
  const end = at(cut.length);
  for (const when of [0, 3, 9.6, 15, 21, 24]) {
    const run = createFilm(cut);
    run.advance(when);
    run.skip();
    run.advance(0.1);
    // Going dark, the moment holds.
    expect(run.frame(newFrame(cut)).black).toBeGreaterThan(0);
    for (let i = 0; i < 20 && !run.done; i++) run.advance(0.1);
    expect(run.done, `${when}`).toBe(true);
    const f = run.frame(newFrame(cut));
    expect(f.puppets.map((p) => [p.x, p.y, p.z, p.facing, p.pose.anim]), `${when}`).toEqual(end.puppets.map((p) => [p.x, p.y, p.z, p.facing, p.pose.anim]));
    expect([f.land, f.black, f.bars, f.fire, f.timeOfDay, f.done]).toEqual([1, 0, 0, end.fire, end.timeOfDay, true]);
    // No sound starts after the skip.
    expect(f.cues).toBe(at(when).cues);
  }
});

test('a frame makes no garbage: the same objects are filled every call', () => {
  const out = newFrame(cut);
  const lens = out.lens, puppets = out.puppets, first = out.puppets[0];
  for (let t = 0; t < cut.length; t += 0.5) filmFrame(cut, t, out);
  expect(out.lens).toBe(lens);
  expect(out.puppets).toBe(puppets);
  expect(out.puppets[0]).toBe(first);
});

test('with reduced motion each shot holds one still', () => {
  const a = filmFrame(cut, startOf('trees') + 0.2, newFrame(cut), { still: true });
  const b = filmFrame(cut, endOf('trees') - 0.2, newFrame(cut), { still: true });
  expect([a.lens.x, a.lens.y, a.lens.z]).toEqual([b.lens.x, b.lens.y, b.lens.z]);
});

test('a film plays when its flag is first set in play near its place, once per save, and never from a load', () => {
  const kernel = createKernel(new World(1), 1);
  const flags = kernel.game.flags;
  expect(startsFilm(SCENE_9, 'night.fox', { flags, inPlay: true, near: 1.4 })).toBe(true);
  expect(startsFilm(SCENE_9, 'night.fox', { flags, inPlay: true, near: 25 })).toBe(false);
  expect(startsFilm(SCENE_9, 'door.open', { flags, inPlay: true, near: 1.4 })).toBe(false);
  // A save being loaded is not play.
  expect(startsFilm(SCENE_9, 'night.fox', { flags, inPlay: false, near: 1.4 })).toBe(false);
  flags.set(filmFlag(SCENE_9), true);
  expect(startsFilm(SCENE_9, 'night.fox', { flags, inPlay: true, near: 1.4 })).toBe(false);
});

test('a region without one of the film\'s places plays nothing', () => {
  expect(resolveFilm(SCENE_9, (name) => (name === 'camp.trees' ? null : places(name)))).toBeNull();
});

test('every film has a land for each puppet, its cues in order, and a scene number of its own', () => {
  const scenes = new Set<string>();
  for (const film of FILMS as readonly Film[]) {
    expect(scenes.has(film.scene)).toBe(false);
    scenes.add(film.scene);
    for (const p of film.puppets) expect(film.land[p.actor], `${film.id} ${p.actor}`).toBeDefined();
    const cues = film.sound.cues.map((c) => c.at);
    expect(cues).toEqual([...cues].sort((x, y) => x - y));
    expect(film.shots.at(-1)?.land).toBe(true);
    expect(film.shots[0].enter).toBe('fade');
  }
});

test('tracks and walks ease', () => {
  expect(trackAt([[0, 1], [2, 0, 2]], 1)).toBe(1);
  expect(trackAt([[0, 1], [2, 0, 2]], 3)).toBeCloseTo(0.5, 6);
  expect(trackAt([[0, 1], [2, 0, 2]], 9)).toBe(0);
  expect(walkAlong(0)).toBe(0);
  expect(walkAlong(1)).toBeCloseTo(1, 9);
  expect(walkAlong(0.5)).toBeCloseTo(0.5, 9);
});
