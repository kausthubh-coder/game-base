import { test, expect } from 'bun:test';
import type { Actor } from '../api.sim.ts';
import { sceneOf } from '../content/scenes.ts';
import { createStageActors } from './stage-actors.ts';

test('the first Echo has its own fox and restores the existing companion on every exit', () => {
  const pet: Actor = { id: 'pet:leaftail:1', sprite: 'leaftail', pos: { x: 9, y: 2, z: 5 }, facing: 1, anim: 'walk', visible: true, mark: 'heart' };
  const before = structuredClone(pet);
  const actors = new Map([[pet.id, pet]]);
  const stage = createStageActors(actors);
  for (const exit of ['completion', 'skip', 'restoration', 'replacement']) {
    stage.begin(sceneOf(24)!, { x: 0, y: 2, z: 0 }, () => 2);
    const fox = actors.get('stage:echo-fox')!;
    expect(fox.sprite).toBe('fox');
    expect(fox.visible).toBe(true);
    expect(fox.pos).toEqual({ x: 3.6, y: 2, z: 2.8 });
    expect(fox).not.toBe(pet);
    expect(pet.visible).toBe(false);
    if (exit === 'replacement') stage.begin(sceneOf(17)!, { x: 0, y: 2, z: 0 }, () => 2);
    else stage.clear();
    expect([...actors.keys()]).toEqual(['pet:leaftail:1']);
    expect(actors.get(pet.id)).toBe(pet);
    expect(pet).toEqual(before);
  }
});
