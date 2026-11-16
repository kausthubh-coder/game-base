// Installed in the browser. Copies public observations only; never replaces a game method.
export function observePumpTransactions() {
  const g = window.__game.view.game;
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const snapshot = () => ({
    slots: copy(g.systems.inventory.slots), loose: copy(g.systems.machines.loose()),
    pets: copy(g.systems.pets.all()), creatures: copy(g.systems.creatures.all()),
    player: copy(g.player.pos), clock: copy(g.clock),
    flags: Object.fromEntries(['fight.6.won','fight.7.won'].map(k => [k, g.flags.get(k)])),
    lanternflies: [...g.actors.values()].filter(a => a.sprite === 'lanternfly').map(a => ({ id:a.id, anim:a.anim, visible:a.visible, pos:copy(a.pos) })),
  });
  const rows = [];
  window.__pumpTransactions = { rows, snapshot };
  g.events.onAny((name, data) => {
    if (['item.gained','item.lost','creature.gave','good.made','toast','fight.ended','flag.changed'].includes(name))
      rows.push({ name, data: copy(data), ...snapshot() });
  });
}
