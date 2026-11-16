import { expect, test } from 'bun:test';
import type { Sprites, SpriteHandle } from '../../features/sprites/index.ts';
import { stage } from '../story/fakes.ts';
import { createActorSprites } from './art.ts';

function drawing() {
  const visible = new Map<string, boolean>();
  const handle = (id: string): SpriteHandle => ({
    setPosition() {}, setFacing() {}, play: () => true, has: () => true, setTint() {},
    sprite: id, animation: 'idle', frame: 0, finished: false, alive: true,
    setVisible(value) { visible.set(id, value); }, remove() { visible.delete(id); },
  });
  const sprites = { add: (id: string) => handle(id) } as unknown as Sprites;
  const actors = createActorSprites(sprites);
  return { actors, visible };
}

test('first person hides the restored sprite hero after a memory', () => {
  const s = stage();
  const hero = { ...s.game.actors.get('npc:tamsin')!, id: 'player', sprite: 'hero', visible: true };
  s.game.actors.set('player', hero);
  const { actors, visible } = drawing();
  s.game.systems.talk.start('memory.pumphouse.again');
  expect(hero.visible).toBe(false);
  actors.sync(s.game.actors, 0, 'first');
  expect(visible.get('hero')).toBe(false);
  expect(actors.drawnAt('player')).not.toBeNull();
  s.through();
  expect(hero.visible).toBe(true);
  actors.sync(s.game.actors, 0, 'first');
  expect(visible.get('hero')).toBe(false);
  expect(visible.get('tamsin')).toBe(true);
  for (const mode of ['free', 'tilt'] as const) {
    actors.sync(s.game.actors, 0, mode);
    expect(visible.get('hero')).toBe(true);
    hero.visible = false;
    actors.sync(s.game.actors, 0, mode);
    expect(visible.get('hero')).toBe(false);
    hero.visible = true;
  }
});

test('actor lighting follows physical feet through painted lift and tool-sheet replacement', () => {
  const added: { id: string; options: any }[] = [], moved: number[][] = [];
  const sprites = { add(id: string, options: any) {
    added.push({ id, options });
    return { setPosition: (...values: number[]) => moved.push(values), setFacing() {}, play() {}, setVisible() {}, remove() {} };
  } } as unknown as Sprites;
  const art = createActorSprites(sprites);
  art.setLift(() => -0.6);
  const player = { id: 'player', sprite: 'hero', anim: 'walk', pos: { x: -18.5, y: 23.398, z: -214.954 }, lightY: 24, facing: 0, visible: true };
  const npc = { id: 'npc', sprite: 'hero', anim: 'idle', pos: { x: 2, y: 24, z: 0 }, facing: 0, visible: true };
  const actors = new Map([['player', player], ['npc', npc]]);
  art.sync(actors, 1);
  expect(added.map(a => [a.options.y, a.options.lightY])).toEqual([[23.398, 24], [23.4, 24]]);
  player.lightY = 25;
  art.sync(actors, 1);
  expect(moved.at(-1)).toEqual([-18.5, 23.398, -214.954, 25]);
  player.sprite = 'hero-swing'; player.anim = 'tool';
  art.sync(actors, 1);
  expect(added.at(-1)?.options.lightY).toBe(25);
});
