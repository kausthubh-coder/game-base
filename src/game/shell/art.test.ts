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
