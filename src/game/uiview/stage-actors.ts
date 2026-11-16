import type { Actor } from '../api.sim.ts';
import type { SceneDef } from '../content/scenes.ts';

/** Visual cast only. Never enters pets, saves, bonds or rewards. */
export function createStageActors(actors: Map<string, Actor>) {
  const temporary: string[] = [];
  const hidden: { actor: Actor; visible: boolean }[] = [];
  function clear(): void {
    for (const id of temporary) actors.delete(id);
    temporary.length = 0;
    for (const { actor, visible } of hidden) actor.visible = visible;
    hidden.length = 0;
  }
  return {
    clear,
    begin(scene: SceneDef, centre: { x: number; y: number; z: number }, heightAt: (x: number, z: number) => number): void {
      clear();
      if (scene.memory && scene.staging?.actors?.length) {
        for (const actor of actors.values()) if (actor.id.startsWith('pet:')) {
          hidden.push({ actor, visible: actor.visible });
          actor.visible = false;
        }
      }
      for (const one of scene.staging?.actors ?? []) {
        const id = `stage:${one.id}`, x = centre.x + one.x, z = centre.z + one.z;
        const y = heightAt(x, z);
        actors.set(id, { id, sprite: one.sprite, pos: { x, y: Math.abs(y - centre.y) > 3 ? centre.y : y, z }, facing: Math.PI, anim: 'idle', visible: true, mark: '' });
        temporary.push(id);
      }
    },
  };
}
