// Diagnostic rules fixture only. Never used as an earned checkpoint.
import { makeStage } from '../../src/game/actions/stage.ts';
import { blockId } from '../../src/content/blocks.ts';
import { install as crops } from '../../src/game/crops/index.sim.ts';
import { install as machines } from '../../src/game/machines/index.sim.ts';
import { install as farms } from '../../src/game/farms/index.sim.ts';
export function observeBeeDay() {
  const s = makeStage();
  for (let x = 1; x < 15; x++)
    for (let z = 1; z < 15; z++) s.world.setBlock(x, s.ground - 1, z, blockId('grass'));
  crops(s.kernel);
  machines(s.kernel);
  farms(s.kernel);
  const g = s.kernel.game;
  g.systems.placeables.place('bee_box', 7, s.ground, 7, 0);
  Object.assign(g.player.pos, { x: 40, y: s.ground, z: 40 });
  g.clock.timeOfDay = 0.27;
  s.wait(2.5);
  for (let second = 0; second < 720; second++) {
    g.clock.timeOfDay = 0.270001 + (second / 720) * 0.459998;
    s.wait(1);
  }
  g.clock.timeOfDay = 0.731;
  s.wait(3);
  const made = s.heard
    .filter((e) => e.name === 'good.made' && e.data.farm === 'bee')
    .map((e) => e.data);
  return {
    rate: g.systems.farms.get('bee').rate,
    made,
    honey: made.filter((e) => e.item === 'honey').reduce((n, e) => n + e.count, 0),
    wax: made.filter((e) => e.item === 'wax').reduce((n, e) => n + e.count, 0),
  };
}
if (import.meta.main) {
  const result = observeBeeDay();
  console.log(JSON.stringify(result, null, 2));
  if (result.wax === 0) {
    console.error('FAIL: a full productive day from one bee box produced no wax');
    process.exitCode = 1;
  }
}
