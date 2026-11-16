export function observeLights() {
  const g = window.__game.view.game,
    copy = (v) => JSON.parse(JSON.stringify(v));
  const snapshot = () => ({
    clock: copy(g.clock),
    player: copy(g.player.pos),
    slots: copy(g.systems.inventory.slots),
    loose: copy(g.systems.machines.loose()),
    chests: g.systems.machines
      .parts()
      .filter((p) => p.kind === 'collector_chest')
      .map((p) => [p.id, copy(g.systems.machines.chest(p.id))]),
    farms: copy(g.systems.farms.all()),
    parts: copy(g.systems.machines.parts()),
    pets: copy(g.systems.pets.all()),
    creatures: copy(g.systems.creatures.all()),
  });
  const rows = [];
  window.__lightsObservation = { rows, snapshot };
  g.events.onAny((name, data) => {
    if (!name.startsWith('ui.') && name !== 'frame')
      rows.push({ name, data: copy(data), ...snapshot() });
  });
}
