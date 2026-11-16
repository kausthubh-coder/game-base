// Goods and coin through the real rules: the buyers' caps and market day, the queen's ledger and the pump wheat it
// refuses, the pumps coming out, the standing orders, the rush order, what coin buys, the pump, and a save.
import { describe, expect, test } from 'bun:test';
import type { ItemId } from '../api.sim.ts';
import { BUYERS, FURNITURE, LAND_RING, LEDGER, PRICES, PUMP, RUSH, SEED_SACK, TOWN_PUMPS, pumpsStanding } from '../content/goods.ts';
import type { QuestId } from '../content/ids.ts';
import { loadPlay, newPlay, type Play } from '../play/harness.sim.ts';
import { mossPen } from '../scenarios/settlement-kitchen.sim.ts';

/** A new game at the start of a quest. */
function at(quest: QuestId): Play {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo(quest);
  p.advance(1.5);
  return p;
}

const give = (p: Play, item: ItemId, count: number): void => {
  expect(p.sys.inventory.add(item, count)).toBe(0);
};
/** Clicks through whatever scene started as the hero arrived. */
function free(p: Play): void {
  for (let i = 0; i < 5 && p.sys.talk.active; i++) {
    p.talkThrough();
    p.advance(0.5);
  }
}
/** Sleeps to the morning of this day. */
function sleepTo(p: Play, day: number): void {
  while (p.game.clock.day < day) {
    p.sys.time.sleep();
    p.advance(1.1);
  }
}

describe('the data', () => {
  test('the ledger is the handbook\'s four sections', () => {
    expect(LEDGER.map((s) => s.needs.map((n) => `${n.count} ${n.item}`).join(', '))).toEqual([
      '40 wheat, 10 moss_fiber', '120 wheat, 10 honey', '20 glow_dust', '20 gear_spring, 10 copper',
    ]);
  });
  test('the pumps come out a few at a time, and all of them with the fourth section', () => {
    expect([0, 1, 2, 3, 4].map(pumpsStanding)).toEqual([TOWN_PUMPS, 5, 3, 2, 0]);
  });
});

describe('selling', () => {
  test('nobody in Hollowmere buys before the hero has come to it', () => {
    const p = at('copper');
    give(p, 'wheat', 10);
    expect(p.sys.goods.sell('granary', 'wheat', 10)).toBe(0);
    expect(p.sys.goods.coin()).toBe(0);
  });

  test('the granary takes 40 wheat a day at its price, and 40 more the next day', () => {
    const p = at('count');
    give(p, 'wheat', 90);
    expect(p.sys.goods.sell('granary', 'wheat', 90)).toBe(BUYERS.granary.cap);
    expect(p.sys.goods.coin()).toBe(40 * PRICES.wheat!);
    expect(p.count('wheat')).toBe(50);
    expect(p.sys.goods.sell('granary', 'wheat', 5)).toBe(0);
    expect(p.heard.some((e) => e.name === 'goods.sold')).toBe(true);
    // It takes only what it buys.
    give(p, 'honey', 5);
    expect(p.sys.goods.sell('granary', 'honey', 5)).toBe(0);
    sleepTo(p, p.game.clock.day + 1);
    expect(p.sys.goods.buyer('granary').goods[0].taken).toBe(0);
    expect(p.sys.goods.sell('granary', 'wheat', 50)).toBe(40);
  });

  test('the market green takes 10 of each a day, and twice that on market day', () => {
    const p = at('count');
    give(p, 'honey', 50);
    give(p, 'quill', 50);
    expect(p.sys.goods.sell('market', 'honey', 50)).toBe(10);
    expect(p.sys.goods.sell('market', 'quill', 50)).toBe(10);
    expect(p.sys.goods.coin()).toBe(10 * PRICES.honey! + 10 * PRICES.quill!);
    sleepTo(p, 7);
    expect(p.sys.goods.marketDay()).toBe(true);
    expect(p.sys.goods.buyer('market').goods.every((g) => g.cap === 20)).toBe(true);
    expect(p.sys.goods.sell('market', 'honey', 50)).toBe(20);
    sleepTo(p, 8);
    expect(p.sys.goods.marketDay()).toBe(false);
  });
});

describe('the queen\'s ledger', () => {
  test('a delivery puts in what the bag holds; a full section pulls pumps out and opens the granary wider', () => {
    const p = at('count');
    p.game.flags.set('scene.22', true);
    give(p, 'wheat', 30);
    give(p, 'moss_fiber', 12);
    expect(p.sys.goods.deliver('granary')).toBe(30 + 10);
    expect(p.sys.goods.ledger()[0].needs.map((n) => n.have)).toEqual([30, 10]);
    expect(p.game.flags.is('ledger.granary.filled')).toBe(false);
    give(p, 'wheat', 15);
    expect(p.sys.goods.deliver('granary')).toBe(10);
    expect(p.count('wheat')).toBe(5);
    expect(p.game.flags.is('ledger.granary.filled')).toBe(true);
    expect(p.heard.some((e) => e.name === 'ledger.filled')).toBe(true);
    expect(p.said.some((s) => s.includes('A pump comes out'))).toBe(true);
    // One pump out: the granary takes 20 more a day.
    expect(p.sys.goods.buyer('granary').goods[0].cap).toBe(60);
    // A filled section takes nothing more.
    expect(p.sys.goods.deliver('granary')).toBe(0);
  });

  test('the queen takes no wheat that grew while the pump ran, and the granary takes it first', () => {
    const p = at('count');
    p.game.flags.set('scene.22', true);
    expect(p.sys.goods.setPump(true)).toBe(true);
    give(p, 'wheat', 20);
    expect(p.sys.goods.pumpWheat()).toBe(20);
    p.sys.goods.setPump(false);
    give(p, 'wheat', 15);
    expect(p.sys.goods.pumpWheat()).toBe(20);
    expect(p.sys.goods.deliver('granary')).toBe(15);
    expect(p.count('wheat')).toBe(20);
    // The granary buys the pump wheat, and what is left is clean.
    give(p, 'wheat', 5);
    expect(p.sys.goods.sell('granary', 'wheat', 22)).toBe(22);
    expect(p.sys.goods.pumpWheat()).toBe(0);
    expect(p.sys.goods.deliver('granary')).toBe(3);
  });

  test('selling at the granary and picking a section finishes the quest\'s step', () => {
    const p = at('count');
    p.game.flags.set('scene.22', true);
    p.game.flags.set('quest.count.step', 'sow');
    give(p, 'wheat', 4);
    p.sys.goods.sell('granary', 'wheat', 4);
    p.advance(1.1);
    expect(p.game.flags.is('step.count.sow')).toBe(false);
    p.sys.goods.pick('mill');
    expect(p.sys.goods.picked()).toBe('mill');
    expect(p.game.flags.is('step.count.sow')).toBe(true);
  });

  test('the fourth section takes the last pump out, and the standing orders open', () => {
    const p = at('count');
    p.game.flags.set('scene.22', true);
    for (const def of LEDGER) for (const need of def.needs) give(p, need.item, need.count);
    for (const def of LEDGER) p.sys.goods.deliver(def.section);
    expect(LEDGER.every((def) => p.game.flags.is(`ledger.${def.section}.filled`))).toBe(true);
    expect(p.said.some((s) => s.includes('the gold road goes dark'))).toBe(true);
    expect(p.sys.goods.buyer('granary').goods[0].cap).toBe(BUYERS.granary.cap + 20 * TOWN_PUMPS);
    // Road lamps: five glow dust, and a lamp is lit that night.
    give(p, 'glow_dust', 5);
    const before = p.sys.goods.coin();
    expect(p.sys.goods.fill('lamps')).toBe(true);
    expect(p.sys.goods.coin()).toBe(before + 20);
    expect(p.game.flags.get('order.lamps')).toBe(1);
    sleepTo(p, p.game.clock.day + 1);
    expect(p.game.flags.get('road.lamps')).toBe(1);
    // The next wheel: the queen names a family.
    give(p, 'gear_spring', 10);
    give(p, 'copper', 5);
    expect(p.sys.goods.fill('wheel')).toBe(false);
    give(p, 'old_brass', 1);
    expect(p.sys.goods.fill('wheel')).toBe(true);
    expect(p.said.some((s) => s.includes('The queen names the Carrows'))).toBe(true);
    // A pack order is never taken.
    expect(p.sys.goods.fill('rootworks')).toBe(false);
  });

  test('before the queen shows it, the ledger takes nothing', () => {
    const p = at('count');
    give(p, 'glow_dust', 20);
    expect(p.sys.goods.deliver('lamphouse')).toBe(0);
    expect(p.count('glow_dust')).toBe(20);
  });
});

describe('the rush order', () => {
  test('on market day the green asks for twice the moss pen\'s rate by nightfall, for sunroot seeds', () => {
    const p = at('count');
    p.teleport('grant.rocks');
    mossPen(p);
    p.advance(3);
    const pen = p.sys.farms.get('moss')!;
    expect(pen.built).toBe(true);
    sleepTo(p, 7);
    p.advance(1.1);
    const rush = p.sys.goods.rush()!;
    expect(rush.item).toBe('moss_fiber');
    expect(rush.count).toBe(Math.max(RUSH.least, Math.round(Math.max(pen.rate, pen.best) * RUSH.times)));
    expect(p.sys.goods.meetRush()).toBe(false);
    give(p, 'moss_fiber', rush.count);
    const before = p.sys.goods.coin();
    expect(p.sys.goods.meetRush()).toBe(true);
    expect(p.sys.goods.coin()).toBe(before + RUSH.coin);
    expect(p.count('sunroot_seeds')).toBe(RUSH.gift.count);
    expect(p.sys.goods.meetRush()).toBe(false);
  });

  test('none is posted with no farm making a market good', () => {
    const p = at('count');
    sleepTo(p, 7);
    p.advance(1.1);
    expect(p.sys.goods.rush()).toBeNull();
  });
});

describe('what coin buys', () => {
  test('a ring of land grows the grant by eight blocks each way', () => {
    const p = at('count');
    const before = p.sys.region.grant();
    p.game.flags.set('coin', LAND_RING.coin + 5);
    expect(p.sys.goods.buy('ring')).toBeNull();
    expect(p.sys.goods.coin()).toBe(5);
    const after = p.sys.region.grant();
    expect(after).toEqual({ x: before.x - 8, z: before.z - 8, width: before.width + 16, depth: before.depth + 16 });
    expect(p.sys.goods.buy('ring')).toBe(`It costs ${LAND_RING.coin} coin`);
  });

  test('the seed store opens with the granary\'s section; furniture goes up a grade at a time', () => {
    const p = at('count');
    p.game.flags.set('coin', 1000);
    expect(p.sys.goods.buy('seeds')).toBe('Opens when the granary\'s section is filled');
    p.game.flags.set('ledger.granary.filled', true);
    const seeds = p.count('wheat_seeds');
    expect(p.sys.goods.buy('seeds')).toBeNull();
    expect(p.count('wheat_seeds')).toBe(seeds + SEED_SACK.count);
    expect(p.sys.goods.furniture()).toEqual({ grade: 1, hearts: 1 });
    expect(p.sys.goods.buy('furniture')).toBeNull();
    expect(p.sys.goods.buy('furniture')).toBeNull();
    expect(p.sys.goods.furniture()).toEqual({ grade: 3, hearts: 3 });
    expect(p.sys.goods.coin()).toBe(1000 - SEED_SACK.coin - FURNITURE[1].coin - FURNITURE[2].coin);
    expect(p.sys.goods.buy('furniture')).toBe('Your homes have the finest already');
  });

  test('the ferry carries the hero between the town\'s quay and the landing, and a guide to a marked vault', () => {
    const p = at('count');
    p.game.flags.set('coin', 100);
    p.teleport('ferry');
    expect(p.sys.goods.buy('ferry')).toBeNull();
    const landing = p.sys.region.place('landing').at;
    expect(Math.hypot(p.game.player.pos.x - landing.x, p.game.player.pos.z - landing.z)).toBeLessThan(1);
    expect(p.sys.goods.coin()).toBe(95);
    expect(p.sys.goods.buy('guide', 'pumphouse')).toBe('Nobody knows the way until the vaults are marked');
    p.game.flags.set('vaults.marked', true);
    expect(p.sys.goods.buy('guide', 'pumphouse')).toBeNull();
    const vault = p.sys.region.place('pumphouse').at;
    expect(Math.hypot(p.game.player.pos.x - vault.x, p.game.player.pos.z - vault.z)).toBeLessThan(1);
  });
});

describe('the Order\'s pump', () => {
  test('set running by the blessing\'s choice, it lowers the Heartstone, greys the ground and triples the field', () => {
    const p = at('blessing');
    p.game.flags.set('choice.pump', 'running');
    p.advance(0.5);
    expect(p.sys.goods.pumpRunning()).toBe(true);
    expect(p.game.flags.get('pump.running')).toBe(true);
    const pump = p.sys.goods.pump();
    expect(pump.grey).toBe(1);
    expect(pump.at).not.toBeNull();
    // The field's wheat: two more on the ground for each one it makes.
    const loose = (): number => p.sys.machines.loose().filter((g) => g.item === 'wheat').reduce((n, g) => n + g.count, 0);
    p.game.events.emit('good.made', { farm: 'field', item: 'wheat', count: 4, at: pump.at! });
    expect(loose()).toBe(4 * (PUMP.yield - 1));
    // "E" at it pulls it out, and the grey heals over three days.
    p.teleport({ x: pump.at!.x, z: pump.at!.z });
    free(p);
    expect(p.interact()).toBe('Pull out the Order\'s pump');
    expect(p.game.flags.get('pump.running')).toBe(false);
    expect(p.sys.goods.pump().grey).toBeCloseTo(1, 2);
    sleepTo(p, p.game.clock.day + 2);
    expect(p.sys.goods.pump().grey).toBeGreaterThan(0);
    sleepTo(p, p.game.clock.day + 2);
    expect(p.sys.goods.pump().grey).toBe(0);
  });

  test('left in its crate, it waits by the camp and can be set running later', () => {
    const p = at('kitchen');
    p.advance(0.5);
    expect(p.game.flags.get('choice.pump')).toBe('crated');
    const crate = p.sys.goods.pump();
    expect(crate.running).toBe(false);
    expect(crate.at).not.toBeNull();
    expect(p.game.flags.get('pump.running')).toBeUndefined();
    p.teleport({ x: crate.at!.x, z: crate.at!.z });
    free(p);
    expect(p.interact()).toBe('Set the Order\'s pump running in your field');
    expect(p.sys.goods.pumpRunning()).toBe(true);
  });
});

test('a save keeps the coin, the day\'s sales, the ledger, the pump and its wheat', () => {
  const p = at('count');
  p.game.flags.set('scene.22', true);
  p.sys.goods.setPump(true);
  give(p, 'wheat', 30);
  give(p, 'moss_fiber', 4);
  p.sys.goods.sell('granary', 'wheat', 10);
  p.sys.goods.pick('granary');
  p.sys.goods.deliver('granary');
  p.advance(0.5);
  const q = loadPlay(p.save());
  q.advance(0.5);
  expect(q.sys.goods.coin()).toBe(p.sys.goods.coin());
  expect(q.sys.goods.buyer('granary').goods[0].taken).toBe(10);
  expect(q.sys.goods.ledger()[0].needs.map((n) => n.have)).toEqual([0, 4]);
  expect(q.sys.goods.picked()).toBe('granary');
  expect(q.sys.goods.pumpWheat()).toBe(20);
  expect(q.sys.goods.pump()).toEqual(p.sys.goods.pump());
});

test('in any order, with the pump on and off and saves between, the ledger and the coin stay true', () => {
  const items: ItemId[] = ['wheat', 'moss_fiber', 'honey', 'glow_dust', 'gear_spring', 'copper'];
  for (let seed = 1; seed <= 8; seed++) {
    let r = seed * 9301;
    const rand = (n: number): number => {
      r = (r * 48271) % 2147483647;
      return r % n;
    };
    let p = at('count');
    p.game.flags.set('scene.22', true);
    for (let i = 0; i < 40; i++) {
      const roll = rand(6);
      if (roll === 0) p.sys.inventory.add(items[rand(items.length)], 1 + rand(30));
      else if (roll === 1) p.sys.goods.deliver(LEDGER[rand(LEDGER.length)].section);
      else if (roll === 2) p.sys.goods.setPump(rand(2) === 0);
      else if (roll === 3) p.sys.goods.sell(rand(2) ? 'granary' : 'market', items[rand(3)], rand(25));
      else if (roll === 4) {
        p.advance(0.1);
        const state = (q: Play): string => {
          const pump = q.sys.goods.pump();
          return JSON.stringify([q.sys.goods.coin(), q.sys.goods.ledger(), { ...pump, grey: Math.round(pump.grey * 100) }, q.sys.goods.pumpWheat()]);
        };
        const before = state(p);
        p = loadPlay(p.save());
        p.advance(0.1);
        expect(state(p)).toBe(before);
      } else p.advance(1);
      // What must always hold.
      expect(p.sys.goods.coin()).toBeGreaterThanOrEqual(0);
      expect(p.sys.goods.pumpWheat()).toBeLessThanOrEqual(p.count('wheat'));
      expect(p.game.flags.get('pump.running') === true).toBe(p.sys.goods.pumpRunning());
      for (const section of p.sys.goods.ledger()) {
        for (const need of section.needs) expect(need.have).toBeLessThanOrEqual(need.count);
        const full = section.needs.every((need) => need.have >= need.count);
        if (full) expect(section.filled).toBe(true);
        if (section.filled) expect(full).toBe(true);
      }
    }
  }
}, 30_000);
