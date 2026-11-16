// The whole ledger, in an order the player picks (the wheelwright's yard first, the granary last): every section
// filled pulls pumps, the fourth turns the gold road off and opens the standing orders. Road lamps are delivered and
// one is lit that night; the next wheel names a family; coin buys a ring of land, and the grant grows. The ledger
// opens beside the queen in her hall, where the quest's ledger steps point, as well as at the granary's counter.
import { LEDGER, LAND_RING } from '../content/goods.ts';
import { QUESTS } from '../content/quests.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const deliver = (section: 'granary' | 'mill' | 'lamphouse' | 'wheelwright') =>
  ({ do: 'run', name: `deliver to ${section}`, run: (p: Play) => { p.sys.goods.pick(section); p.sys.goods.deliver(section); } }) as const;
const goods = Object.fromEntries(LEDGER.flatMap((s) => s.needs).reduce((m, n) => m.set(n.item, (m.get(n.item) ?? 0) + n.count), new Map<string, number>()));

export const goodsLedger: Scenario = {
  name: 'goods-ledger',
  about: 'The four sections in the player\'s order, a reload between, the last one ending the gold road; then road lamps lit by night, a wheel that names a family, and a ring of land bought.',
  seed: 44,
  start: { quest: 'count', give: { ...goods, glow_dust: 25, gear_spring: 30, copper: 15, old_brass: 1 } },
  inputs: [
    { do: 'run', name: 'the queen has shown her ledger', run: (p) => p.game.flags.set('scene.22', true) },
    { do: 'check', what: 'the ledger steps point at the queen\'s hall', that: () => QUESTS.flatMap((q) => q.steps).filter((s) => s.id === 'ledger').every((s) => s.place === 'town.hall') },
    { do: 'teleport', to: { place: 'town.hall', dx: 2.5 } },
    { do: 'interact', prompt: 'Open the queen\'s ledger' },
    { do: 'check', what: 'the ledger opens there', that: (p) => p.heard.some((e) => e.name === 'ui.open' && (e.data as { panel: string }).panel === 'ledger') },
    deliver('wheelwright'),
    { do: 'check', what: 'the yard first', that: (p) => p.game.flags.is('ledger.wheelwright.filled') && !p.game.flags.is('ledger.granary.filled') },
    deliver('lamphouse'),
    { do: 'reload' },
    { do: 'check', what: 'two sections, kept', that: (p) => p.sys.goods.ledger().filter((s) => s.filled).length === 2 },
    deliver('mill'),
    deliver('granary'),
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'the gold road goes dark', that: (p) => p.said.some((s) => s.includes('the gold road goes dark')) },
    { do: 'run', name: 'road lamps', run: (p) => { if (!p.sys.goods.fill('lamps')) throw new Error('no lamps order'); } },
    { do: 'wait', until: 'evening' },
    { do: 'wait', seconds: 150 },
    { do: 'check', what: 'a road lamp is lit that night', that: (p) => p.game.flags.get('road.lamps') === 1 },
    { do: 'run', name: 'the town\'s next wheel', run: (p) => { if (!p.sys.goods.fill('wheel')) throw new Error('no wheel order'); } },
    { do: 'run', name: 'sell for a ring of land', run: (p) => { p.game.flags.add('coin', LAND_RING.coin); if (p.sys.goods.buy('ring')) throw new Error('the ring was not sold'); } },
  ],
  expect(p) {
    const grant = p.sys.region.grant();
    return [
      ['every section is filled', LEDGER.every((s) => p.game.flags.is(`ledger.${s.section}.filled`))],
      ['a family is named', p.said.some((s) => s.includes('The queen names the Carrows'))],
      ['the grant grew by a ring', grant.width === 28 + 2 * LAND_RING.blocks && p.game.flags.get('land.rings') === 1],
      ['the quest\'s ledger steps can read it', p.sys.goods.ledger().every((s) => s.filled)],
    ];
  },
};
