// Market day on the green: a moss pen at home, six nights, and on the seventh morning the green posts a rush
// order for twice the pen's rate by nightfall. The hero sells honey at twice the usual cap and meets the order.
import { RUSH } from '../content/goods.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { mossPen } from './settlement-kitchen.sim.ts';

const sleepTo = (day: number) => ({ do: 'run', name: `sleep to day ${day}`, run: (p: Play) => { while (p.game.clock.day < day) { p.sys.time.sleep(); p.advance(1.1); } } }) as const;

export const goodsMarketDay: Scenario = {
  name: 'goods-market-day',
  about: 'With a moss pen at home, the seventh morning is market day: the green takes twice the honey and posts a rush order for twice the pen\'s rate, met for coin and sunroot seeds.',
  seed: 43,
  start: { quest: 'count', give: { honey: 30, moss_fiber: 70 } },
  inputs: [
    { do: 'teleport', to: 'grant.rocks' },
    { do: 'run', name: 'build a moss pen', run: (p) => mossPen(p) },
    { do: 'check', what: 'the pen makes moss fiber', that: (p) => (p.sys.farms.get('moss')?.rate ?? 0) > 0 },
    sleepTo(6),
    { do: 'check', what: 'no rush order on an ordinary day', that: (p) => p.sys.goods.rush() === null && !p.sys.goods.marketDay() },
    sleepTo(7),
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'market day, and the rush order is posted', that: (p) => p.sys.goods.marketDay() && p.sys.goods.rush()?.item === 'moss_fiber' && p.said.some((s) => s.startsWith('Market day. A rush order')) },
    { do: 'teleport', to: { place: 'town.market', dx: 2.5 } },
    { do: 'wait', seconds: 5, until: (p) => !p.sys.talk.active || (p.talkThrough(), false) },
    { do: 'interact', prompt: 'Sell on the market green' },
    { do: 'run', name: 'sell honey', run: (p) => { if (p.sys.goods.sell('market', 'honey', 30) !== 20) throw new Error('market day did not take twenty'); } },
    { do: 'run', name: 'meet the rush order', run: (p) => { if (!p.sys.goods.meetRush()) throw new Error('the rush order was not met'); } },
  ],
  expect(p) {
    const rush = p.sys.goods.rush();
    return [
      ['the order is met', rush?.met === true],
      ['it asked for twice the pen\'s rate', rush?.count === Math.max(RUSH.least, Math.round(Math.max(p.sys.farms.get('moss')!.rate, p.sys.farms.get('moss')!.best) * RUSH.times))],
      ['the gift nobody else gives', p.count('sunroot_seeds') === RUSH.gift.count],
      ['paid for twenty honey and the order', p.sys.goods.coin() === 20 * 8 + RUSH.coin],
    ];
  },
};
