// Quest 9 at the granary: the hero comes to Hollowmere, meets the queen, sells the first sacks at the granary's
// counter, picks a section of her ledger and delivers toward it. A reload keeps what was delivered, and the rest of
// the wheat fills the section: a pump comes out of the town's fields and the granary takes 20 more a day.
import { BUYERS, PRICES } from '../content/goods.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const talking = (p: Play): boolean => p.sys.talk.active;
const opened = (p: Play, detail: string): boolean =>
  p.heard.some((e) => e.name === 'ui.open' && (e.data as { panel: string; detail?: string }).panel === 'goods' && (e.data as { detail?: string }).detail === detail);

export const goodsGranary: Scenario = {
  name: 'goods-granary',
  about: 'At the granary the queen\'s scene plays, the first sacks are sold to the day\'s cap, a section of the ledger is picked and fed, a reload keeps it, and the filled section pulls a pump and widens the granary.',
  seed: 41,
  start: { quest: 'count', give: { wheat: 70, moss_fiber: 12 } },
  inputs: [
    { do: 'teleport', to: 'granary' },
    { do: 'interact', prompt: 'Talk to Maren' },
    { do: 'wait', seconds: 5, until: talking },
    { do: 'run', name: 'click through the queen', run: (p) => { p.talkThrough(); } },
    { do: 'wait', seconds: 1 },
    { do: 'run', name: 'the queen\'s scene has played (the dialogue builder plays scene 22)', run: (p) => p.game.flags.set('scene.22', true) },
    { do: 'wait', seconds: 1.5 },
    { do: 'teleport', to: { place: 'granary', dx: 2.5 } },
    { do: 'interact', prompt: 'Sell at the granary, and the queen\'s ledger' },
    { do: 'check', what: 'the granary\'s panel opens', that: (p) => opened(p, 'granary') },
    // The panel's Sell button: the granary takes its day's cap and no more.
    { do: 'run', name: 'sell all the wheat', run: (p) => { if (p.sys.goods.sell('granary', 'wheat', 70) !== BUYERS.granary.cap) throw new Error('the granary did not take 40'); } },
    { do: 'check', what: 'forty sacks paid', that: (p) => p.sys.goods.coin() === BUYERS.granary.cap * PRICES.wheat! && p.count('wheat') === 30 },
    { do: 'check', what: 'the step waits for a section to be picked', that: (p) => p.game.flags.get('quest.count.step') === 'sow' },
    // The ledger: the granary's section picked, and Deliver puts in what the bag holds.
    { do: 'run', name: 'pick the granary\'s section', run: (p) => p.sys.goods.pick('granary') },
    { do: 'wait', seconds: 1.5 },
    { do: 'check', what: 'sow, sell and pick is done', that: (p) => p.game.flags.is('step.count.sow') && p.game.flags.get('quest.count.step') !== 'sow' },
    { do: 'run', name: 'deliver', run: (p) => { p.sys.goods.deliver('granary'); } },
    { do: 'reload' },
    { do: 'check', what: 'the ledger kept what was delivered', that: (p) => p.sys.goods.ledger()[0].needs.map((n) => n.have).join() === '30,10' },
    { do: 'check', what: 'the day\'s sales are kept', that: (p) => p.sys.goods.buyer('granary').goods[0].taken === 40 },
    { do: 'run', name: 'bring ten more wheat and deliver', run: (p) => { p.sys.inventory.add('wheat', 10); p.sys.goods.deliver('granary'); } },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    return [
      ['the section is filled', p.game.flags.is('ledger.granary.filled')],
      ['the queen says a pump comes out', p.said.some((s) => s.includes('A pump comes out'))],
      ['the granary takes 20 more a day', p.sys.goods.buyer('granary').goods[0].cap === 60],
      ['her seed store is open', p.sys.goods.shop().find((s) => s.id === 'seeds')?.why !== 'Opens when the granary\'s section is filled'],
      ['the player is free', !p.game.player.busy],
    ];
  },
};
