// A fresh visit goes directly to the grant with a spade and the Leaftail.
// Both looks use the same scene save, so switching art keeps the player in place.
import type { GameView } from '../shell/view.ts';

export function install(view: GameView): void {
  if (new URLSearchParams(location.search).get('scene') !== 'sprite-meadow') return;
  const stop = view.onFrame(() => {
    queueMicrotask(stop);
    if (!view.started && !view.continueGame()) view.newGame();
    const { flags, systems } = view.game;
    if (flags.is('lab.sprite-meadow')) return;
    systems.quests.skipTo('ground');
    flags.set('scene.7', true);
    const at = systems.region.place('grant.center').at;
    view.hero.teleport(at.x, at.y, at.z, Math.PI);
    systems.time.setTimeOfDay(0.4);
    systems.time.setWeather('clear', true);
    const inventory = systems.inventory;
    if (!inventory.count('spade')) inventory.add('spade', 1);
    const slot = inventory.slots.findIndex((item) => item?.id === 'spade');
    inventory.move(slot, 0);
    inventory.selected = 0;
    const fox = systems.pets.all().find((pet) => pet.kind === 'leaftail');
    if (fox) systems.pets.bond?.(fox.id);
    flags.set('lab.sprite-meadow', true);
    view.save();
  });
}
