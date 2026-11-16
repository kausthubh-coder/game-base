// The Order's pump, set running at the blessing: the stone reads a step lower and says so, the field's wheat comes
// three to one and the ledger will not take it, the hero pulls the pump out in the field, and three nights later the
// grey ground has healed.
import { PUMP } from '../content/goods.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const talking = (p: Play): boolean => p.sys.talk.active;
const sleep = { do: 'run', name: 'sleep', run: (p: Play) => { p.sys.time.sleep(); } } as const;

export const goodsPump: Scenario = {
  name: 'goods-pump',
  about: 'The pump is set running at the blessing; the Heartstone is held a step down, the field gives three to one and the ledger refuses that wheat; pulled out, the ground heals in three nights.',
  seed: 42,
  start: { quest: 'blessing' },
  inputs: [
    { do: 'teleport', to: { place: 'grant.stone', dz: 2 } },
    { do: 'wait', seconds: 5, until: talking },
    { do: 'talk' },
    { do: 'wait', seconds: 5, until: talking },
    // The first choice: set it running.
    { do: 'talk', choice: 0 },
    { do: 'check', what: 'the choice is remembered', that: (p) => p.game.flags.get('choice.pump') === 'running' },
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'the pump runs in the field', that: (p) => p.game.flags.get('pump.running') === true && p.sys.goods.pump().grey === 1 },
    { do: 'check', what: 'the Heartstone knows', that: (p) => p.sys.settlement.next()?.pump === true },
    // The field makes four wheat: the pump adds eight on the ground beside it.
    { do: 'run', name: 'the field makes wheat', run: (p) => { const at = p.sys.goods.pump().at!; p.game.events.emit('good.made', { farm: 'field', item: 'wheat', count: 4, at }); } },
    { do: 'check', what: 'two more for each', that: (p) => p.sys.machines.loose().filter((g) => g.item === 'wheat').reduce((n, g) => n + g.count, 0) === 4 * (PUMP.yield - 1) },
    { do: 'run', name: 'pick up pump wheat', run: (p) => { p.sys.inventory.add('wheat', 12); } },
    { do: 'check', what: 'it is all pump wheat', that: (p) => p.sys.goods.pumpWheat() === 12 },
    { do: 'run', name: 'walk up to the pump', run: (p) => { const at = p.sys.goods.pump().at!; p.teleport({ x: at.x + 1, z: at.z }); } },
    { do: 'wait', seconds: 5, until: (p) => !talking(p) || (p.talkThrough(), false) },
    { do: 'interact', prompt: 'Pull out the Order\'s pump' },
    { do: 'check', what: 'it stopped', that: (p) => p.game.flags.get('pump.running') === false && !p.sys.goods.pumpRunning() },
    { do: 'check', what: 'the ground is still grey', that: (p) => p.sys.goods.pump().grey > 0.9 },
    sleep, { do: 'wait', seconds: 2 }, sleep, { do: 'wait', seconds: 2 },
    { do: 'check', what: 'two nights on it is greying less', that: (p) => p.sys.goods.pump().grey > 0 && p.sys.goods.pump().grey < 0.6 },
    sleep, { do: 'wait', seconds: 2 }, sleep, { do: 'wait', seconds: 2 },
  ],
  expect(p) {
    return [
      ['the ground has healed', p.sys.goods.pump().grey === 0 && p.sys.goods.pump().greyAt === null],
      ['the pump is in its crate', !p.sys.goods.pumpRunning() && p.sys.goods.pump().at !== null],
      ['the stone is no longer held down', p.sys.settlement.next()?.pump !== true],
    ];
  },
};
