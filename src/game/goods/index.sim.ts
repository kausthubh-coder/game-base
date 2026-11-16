// Goods and coin: where the farms' goods go, what coin buys, the queen's ledger and the Order's pump (handbook
// chapter 30, "Where the goods go"; the data is content/goods.ts).
//
// - Two buyers in Hollowmere: the granary takes wheat, 40 a day and 20 more for every pump out of the town's fields;
//   the market green takes honey, moss fiber and quills, 10 of each a day and twice that on market day, every
//   seventh. "E" at either opens its panel (the view `ui-goods`). Each sale pays coin, the flag `coin`.
// - The queen's ledger: four sections, filled in the order the player picks. A delivery puts in what the bag holds,
//   and wheat that grew while the pump ran stays out. Each section filled sets `ledger.<section>.filled`; the world
//   pulls the town's pumps as they fill, and turns off the gold road when the fourth does. Then the standing orders.
// - On market day a rush order asks for twice a farm's daily rate by nightfall, for a gift nobody else gives.
// - Coin buys a ring of land round the grant (`land.rings`, which the region grows `grant()` by), the queen's seed
//   once her granary is stocked, better furniture (`furniture.grade`), a bed at the inn, the ferry and a guide.
// - The Order's pump: the blessing's choice (`choice.pump`) sets it running in the field or leaves it in its crate by
//   the camp. While it runs it triples the field, `pump.running` is true (the settlement lowers the Heartstone a step)
//   and the grass round it greys. "E" at it pulls it out, and the ground heals in three days.
//
// It finishes the quest step "sow her seed, sell the first sacks and pick a section" (`step.count.sow`), and "pack
// for the road" (`step.pilgrimage.pack`) once the bag holds the road west's order. The ledger's own steps read
// `ledger.<section>.filled`.

import type { Vec3 } from '../../engine/types.ts';
import type {
  BuyerView, Game, GoodsApi, Interactable, ItemId, LedgerView, OrderView, PumpView, RushView, ShopView, SimSystem,
} from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import {
  BUYERS, FURNITURE, LAND_RING, LEDGER, LEDGER_DONE, ORDERS, PRICES, PUMP, ROAD, RUSH, SEED_SACK, SHOP_IDS, TOWN_PUMPS,
  WHEEL_FAMILIES, isMarketDay, ledgerDef, orderDef, pumpsStanding, type OrderId, type ShopId, type TownBuyer,
} from '../content/goods.ts';
import { CHOICES, LEDGER_SECTIONS, type FarmId, type LedgerSection, type QuestId, type VaultId } from '../content/ids.ts';
import type { Kernel } from '../kernel.sim.ts';
import { DAWN, DUSK } from '../quests/rules.sim.ts';
import { EVENING } from '../time/index.sim.ts';

/** Within this many blocks of a buyer's place its prompt shows. */
const COUNTER = 2.5;
/** A counter stands this far east of its place, so the queen or a stallholder at the door keeps their own "E". */
const COUNTER_EAST = 2.5;
/** Within this many blocks of the pump or its crate. */
const PUMP_REACH = 2.5;
/** Seconds between two looks at the quest steps this system finishes. */
const LOOK_EVERY = 1;
const VAULTS: readonly VaultId[] = ['pumphouse', 'lampgallery', 'seedvault'];

export interface GoodsSave {
  version: 1;
  /** What each buyer took on `day`. */
  day: number;
  taken: Partial<Record<TownBuyer, Partial<Record<ItemId, number>>>>;
  ledger: Partial<Record<LedgerSection, Partial<Record<ItemId, number>>>>;
  picked: LedgerSection | null;
  sold: boolean;
  pumpWheat: number;
  pump: { state: 'none' | 'crated' | 'running'; at: [number, number, number] | null; greyAt: [number, number, number] | null; healFrom: number };
  lampsOwed: number;
  litNight: number;
  rush: { day: number; item: ItemId; count: number; met: boolean } | null;
}

export interface Goods {
  api: GoodsApi;
  system: SimSystem;
}

const toVec = (at: [number, number, number] | null): Vec3 | null => (at ? { x: at[0], y: at[1], z: at[2] } : null);
const fromVec = (at: Vec3 | null): [number, number, number] | null => (at ? [at.x, at.y, at.z] : null);

export function createGoods(game: Game): Goods {
  const { flags, events, clock } = game;
  const sys = game.systems;

  // ------------------------------------------------------------------------------------ state

  let day = clock.day;
  let taken: GoodsSave['taken'] = {};
  let have: GoodsSave['ledger'] = {};
  let picked: LedgerSection | null = null;
  let sold = false;
  let pumpWheat = 0;
  let pumpState: GoodsSave['pump']['state'] = 'none';
  let pumpAt: Vec3 | null = null;
  let greyAt: Vec3 | null = null;
  /** Seconds of game time when the pump came out, or -1 while it has not. */
  let healFrom = -1;
  let lampsOwed = 0;
  /** The last night a road lamp was lit. */
  let litNight = 0;
  let rush: GoodsSave['rush'] = null;
  let lookIn = 0;
  /** True while this system changes the bag itself, so a sale or a delivery is not read as wheat lost elsewhere. */
  let selling = false;

  const coin = (): number => Number(flags.get(FLAG.coin)) || 0;
  function pay(by: number): void {
    if (by === 0) return;
    const now = flags.add(FLAG.coin, by);
    events.emit('coin.changed', { coin: now, by });
  }
  const bag = (item: ItemId): number => sys.inventory?.count(item) ?? 0;
  function take(item: ItemId, count: number): boolean {
    selling = true;
    try {
      return sys.inventory?.remove(item, count) ?? false;
    } finally {
      selling = false;
    }
  }
  const toast = (text: string, icon?: string): void => events.emit('toast', icon ? { text, icon } : { text });
  /** Finishes a quest step, only while it is the open step. */
  const step = (quest: QuestId, id: string): void => {
    if (flags.get(FLAG.questStep(quest)) === id && !flags.is(FLAG.step(quest, id))) flags.set(FLAG.step(quest, id), true);
  };

  // ------------------------------------------------------------------------------------ the town

  const filledCount = (): number => LEDGER_SECTIONS.filter((s) => flags.is(FLAG.ledgerFilled(s))).length;
  /**
   * The pumps out of Hollowmere's fields. The world writes `land.pumps` on its own step, after a delivery has
   * filled a section, so the ledger's rule counts too: a pump the toast said came out is out at once.
   */
  function pumpsOut(): number {
    const world = flags.get(FLAG.landPumps);
    const standing = pumpsStanding(filledCount());
    return TOWN_PUMPS - (typeof world === 'number' ? Math.min(world, standing) : standing);
  }
  const marketDay = (): boolean => isMarketDay(clock.day);

  function capOf(buyer: TownBuyer): number {
    const def = BUYERS[buyer];
    let cap = def.cap + (def.perPump ?? 0) * pumpsOut();
    if (def.marketDay && marketDay()) cap *= 2;
    return cap;
  }

  /** Each buyer's day starts fresh. */
  function newDay(): void {
    if (day === clock.day) return;
    day = clock.day;
    taken = {};
  }

  function buyerView(buyer: TownBuyer): BuyerView {
    newDay();
    const cap = capOf(buyer);
    return {
      buyer,
      goods: BUYERS[buyer].takes.map((item) => ({ item, price: PRICES[item] ?? 0, taken: taken[buyer]?.[item] ?? 0, cap })),
      marketDay: marketDay(),
    };
  }

  function sell(buyer: TownBuyer, item: ItemId, count: number): number {
    newDay();
    const def = BUYERS[buyer];
    if (!def.takes.includes(item) || !canTrade()) return 0;
    const already = taken[buyer]?.[item] ?? 0;
    const n = Math.max(0, Math.min(Math.floor(count), bag(item), capOf(buyer) - already));
    if (n <= 0 || !take(item, n)) return 0;
    (taken[buyer] ??= {})[item] = already + n;
    // The granary takes pump wheat first: it is the wheat nobody else will.
    if (item === 'wheat') pumpWheat = Math.max(0, pumpWheat - n);
    const earned = n * (PRICES[item] ?? 0);
    pay(earned);
    events.emit('goods.sold', { buyer, item, count: n, coin: earned });
    if (buyer === 'granary') sold = true;
    look();
    return n;
  }

  /** The town trades once the hero has come to Hollowmere: the quest of the gold on the arches has begun. */
  const canTrade = (): boolean => flags.is(FLAG.questStarted('count')) || flags.is(FLAG.questDone('count'));
  /** The queen shows her ledger in scene 22. */
  const ledgerOpen = (): boolean => flags.is(FLAG.scene(22)) || flags.is(FLAG.questDone('count')) || LEDGER_SECTIONS.some((s) => flags.is(FLAG.ledgerFilled(s)));

  // ------------------------------------------------------------------------------------ the ledger

  /** Clean wheat: what the bag holds, less what grew while the pump ran. */
  const cleanWheat = (): number => Math.max(0, bag('wheat') - pumpWheat);
  const usable = (item: ItemId): number => (item === 'wheat' ? cleanWheat() : bag(item));

  function ledgerView(): LedgerView[] {
    return LEDGER.map((def) => ({
      section: def.section,
      needs: def.needs.map((need) => ({ ...need, have: Math.min(need.count, have[def.section]?.[need.item] ?? 0) })),
      filled: flags.is(FLAG.ledgerFilled(def.section)),
    }));
  }

  function deliver(section: LedgerSection): number {
    if (flags.is(FLAG.ledgerFilled(section)) || !ledgerOpen()) return 0;
    picked = section;
    const def = ledgerDef(section);
    const got = (have[section] ??= {});
    let put = 0;
    for (const need of def.needs) {
      const n = Math.min(need.count - (got[need.item] ?? 0), usable(need.item));
      if (n > 0 && take(need.item, n)) {
        got[need.item] = (got[need.item] ?? 0) + n;
        put += n;
      }
    }
    if (def.needs.every((need) => (got[need.item] ?? 0) >= need.count)) fillSection(section);
    look();
    return put;
  }

  function fillSection(section: LedgerSection): void {
    flags.set(FLAG.ledgerFilled(section), true);
    events.emit('ledger.filled', { section });
    const filled = filledCount();
    const freed = pumpsStanding(filled - 1) - pumpsStanding(filled);
    const def = ledgerDef(section);
    if (filledCount() === LEDGER.length) {
      toast(LEDGER_DONE);
      toast('The queen has standing orders now. They are in her ledger.');
    } else {
      toast(`${def.name} is stocked. ${def.gives}${freed > 0 ? ` ${freed === 1 ? 'A pump comes' : `${freed} pumps come`} out of the town's fields.` : ''}`);
    }
  }

  // ------------------------------------------------------------------------------------ standing orders

  const ordersOpen = (): boolean => filledCount() === LEDGER.length;
  const times = (id: OrderId): number => Number(flags.get(FLAG.order(id))) || 0;
  const kitFilled = (): number => sys.bench?.gear().kit.filter((slot) => slot !== null).length ?? 0;

  function orderView(id: OrderId): OrderView {
    const def = orderDef(id);
    const needs = def.needs.map((need) => ({ ...need, have: bag(need.item) }));
    const kit = def.kit ? kitFilled() : -1;
    const full = needs.every((need) => need.have >= need.count) && (kit < 0 || kit >= 3);
    return { id, needs, kit, times: times(id), ready: ordersOpen() && full && (def.kind === 'pack' || times(id) < def.most) };
  }

  function fill(id: OrderId): boolean {
    const def = orderDef(id);
    const view = orderView(id);
    if (def.kind !== 'deliver' || !view.ready) return false;
    for (const need of def.needs) take(need.item, need.count);
    const n = flags.add(FLAG.order(id), 1);
    pay(def.coin);
    events.emit('order.filled', { order: id, times: n });
    if (id === 'lamps') {
      lampsOwed++;
      toast('The queen\'s lamplighters will hang one more lamp toward the vaults tonight.');
    } else if (id === 'wheel') {
      toast(`The town builds its next wheel. The queen names ${WHEEL_FAMILIES[Math.min(n, WHEEL_FAMILIES.length) - 1]}: their field comes out of the grey.`);
    }
    return true;
  }

  /** A pack order counts once, the first time the bag holds it all. The road west packs you for the last step. */
  function lookAtPacks(): void {
    for (const def of ORDERS) {
      if (def.kind !== 'pack' || times(def.id) > 0 || !orderView(def.id).ready) continue;
      flags.set(FLAG.order(def.id), 1);
      events.emit('order.filled', { order: def.id, times: 1 });
    }
    if (orderView('west').ready) step('pilgrimage', 'pack');
  }

  // ------------------------------------------------------------------------------------ the rush order

  /** At dawn on market day, the green asks for twice the best rate of a market good, by nightfall. */
  function postRush(): void {
    if (!marketDay() || !canTrade() || rush?.day === clock.day) return;
    let best: { item: ItemId; rate: number } | null = null;
    for (const [item, farm] of Object.entries(RUSH.farms) as [ItemId, FarmId][]) {
      const view = sys.farms?.get(farm);
      const rate = view?.built ? Math.max(view.rate, view.best) : 0;
      if (rate <= 0) continue;
      if (!best || rate > best.rate) best = { item, rate };
    }
    if (!best) return;
    const count = Math.max(RUSH.least, Math.round(best.rate * RUSH.times));
    rush = { day: clock.day, item: best.item, count, met: false };
    events.emit('rush.posted', { item: best.item, count });
    toast(`Market day. A rush order on the green: ${count} ${sys.items?.get(best.item).name.toLowerCase() ?? best.item} by nightfall.`);
  }

  function rushView(): RushView | null {
    if (!rush || rush.day !== clock.day) return null;
    const left = Math.max(0, (DUSK - clock.timeOfDay) * (sys.time?.dayLength ?? 1200));
    return { day: rush.day, item: rush.item, count: rush.count, met: rush.met, left: rush.met ? 0 : left };
  }

  function meetRush(): boolean {
    const view = rushView();
    if (!view || view.met || view.left <= 0 || bag(view.item) < view.count || !rush) return false;
    if (!take(view.item, view.count)) return false;
    rush.met = true;
    pay(RUSH.coin);
    sys.inventory?.add(RUSH.gift.id, RUSH.gift.count);
    events.emit('rush.met', { item: view.item, count: view.count });
    toast(`The green's rush order is met. ${RUSH.coin} coin, and ${RUSH.gift.count} sunroot seeds nobody else sells.`);
    return true;
  }

  // ------------------------------------------------------------------------------------ what coin buys

  const rings = (): number => Number(flags.get(FLAG.landRings)) || 0;
  const grade = (): number => Math.max(1, Math.min(3, Number(flags.get(FLAG.furnitureGrade)) || 1));
  const evening = (): boolean => clock.timeOfDay >= EVENING || clock.timeOfDay < DAWN;
  const marked = (): boolean => flags.is('vaults.marked');

  function priceOf(id: ShopId): number {
    switch (id) {
      case 'ring': return LAND_RING.coin;
      case 'seeds': return SEED_SACK.coin;
      case 'furniture': return FURNITURE[Math.min(grade(), FURNITURE.length - 1)].coin;
      case 'inn': return ROAD.inn.coin;
      case 'ferry': return ROAD.ferry.coin;
      case 'guide': return ROAD.guide.coin;
    }
  }

  function why(id: ShopId): string | null {
    if (!canTrade()) return 'Hollowmere does not know you yet';
    let reason: string | null = null;
    switch (id) {
      case 'ring': reason = rings() >= LAND_RING.most ? 'The queen has no more land round yours to grant' : null; break;
      case 'seeds': reason = flags.is(FLAG.ledgerFilled('granary')) ? null : 'Opens when the granary\'s section is filled'; break;
      case 'furniture': reason = grade() >= FURNITURE.length ? 'Your homes have the finest already' : null; break;
      case 'inn': reason = evening() ? null : 'The inn lets beds from evening on'; break;
      case 'ferry': reason = null; break;
      case 'guide': reason = !marked() ? 'Nobody knows the way until the vaults are marked' : VAULTS.every((v) => flags.is(FLAG.vaultCleared(v))) ? 'Every vault is behind you' : null; break;
    }
    if (reason) return reason;
    return coin() < priceOf(id) ? `It costs ${priceOf(id)} coin` : null;
  }

  function placeAt(names: readonly string[]): Vec3 | null {
    const all = sys.region?.places() ?? [];
    for (const name of names) {
      const found = all.find((p) => p.name === name);
      if (found) return found.at;
    }
    return null;
  }

  function moveHero(to: Vec3): void {
    const p = game.player.pos;
    p.x = to.x;
    p.y = to.y;
    p.z = to.z;
  }

  function buy(id: ShopId, vault?: VaultId): string | null {
    const reason = why(id);
    if (reason) return reason;
    const price = priceOf(id);
    switch (id) {
      case 'ring': {
        flags.set(FLAG.landRings, rings() + 1);
        toast(`The queen grants you a ring of ${LAND_RING.blocks} more blocks round your claim.`);
        break;
      }
      case 'seeds': {
        if (sys.inventory && sys.inventory.add(SEED_SACK.item, SEED_SACK.count) > 0) return 'Your bag has no room';
        break;
      }
      case 'furniture': {
        const next = FURNITURE[grade()];
        flags.set(FLAG.furnitureGrade, next.grade);
        toast(`${next.name} furniture goes into your homes. Each use gives ${next.hearts} hearts.`);
        break;
      }
      case 'inn': {
        pay(-price);
        sys.time?.sleep();
        return null;
      }
      case 'ferry': {
        const here = game.player.pos;
        const from = placeAt([ROAD.ferry.from]), to = placeAt([ROAD.ferry.to]);
        if (!from || !to) return 'The ferry is not running';
        const d = (a: Vec3): number => Math.hypot(a.x - here.x, a.z - here.z);
        moveHero(d(from) <= d(to) ? to : from);
        break;
      }
      case 'guide': {
        const where = vault && !flags.is(FLAG.vaultCleared(vault)) ? placeAt([vault]) : null;
        if (!where) return 'Pick a vault you have not cleared';
        moveHero(where);
        toast('Your guide leaves you at the door, and is gone back up the road.');
        break;
      }
    }
    pay(-price);
    return null;
  }

  // ------------------------------------------------------------------------------------ the pump

  /** Where the pump goes in: the middle of your wheat field, or of your plot before there is one. */
  function fieldSpot(): Vec3 | null {
    const tag = sys.farms?.get('field')?.at;
    const middle = placeAt(['grant.center']);
    const at = tag ?? (middle && { x: middle.x + PUMP.plot.dx, y: middle.y, z: middle.z + PUMP.plot.dz });
    if (!at) return null;
    const ground = game.world.heightAt(at.x, at.z);
    return { x: Math.floor(at.x) + 0.5, y: ground > 0 ? ground : at.y, z: Math.floor(at.z) + 0.5 };
  }

  function crateSpot(): Vec3 | null {
    const camp = placeAt(['camp', 'grant.center']);
    if (!camp) return null;
    const x = camp.x + PUMP.crate.dx, z = camp.z + PUMP.crate.dz;
    const ground = game.world.heightAt(x, z);
    return { x, y: ground > 0 ? ground : camp.y, z };
  }

  function setPump(running: boolean): boolean {
    if (running === (pumpState === 'running')) return false;
    if (running) {
      const at = fieldSpot();
      if (!at) return false;
      pumpState = 'running';
      pumpAt = at;
      greyAt = at;
      healFrom = -1;
      flags.set(FLAG.pumpRunning, true);
      toast('The Order\'s pump hums in your field. Three crops where there was one.');
    } else {
      pumpState = 'crated';
      pumpAt = crateSpot();
      healFrom = clock.seconds;
      flags.set(FLAG.pumpRunning, false);
      if (greyAt) toast(`You pull the pump out and crate it. The grey ground round it will heal in ${PUMP.healDays} days.`);
    }
    events.emit('pump.set', { running });
    return true;
  }

  function grey(): number {
    if (pumpState === 'running') return 1;
    if (!greyAt || healFrom < 0) return 0;
    const heal = PUMP.healDays * (sys.time?.dayLength ?? 1200);
    return Math.max(0, 1 - (clock.seconds - healFrom) / heal);
  }

  /** Inside the grant: the pump's field is yours. */
  function onGrant(x: number, z: number): boolean {
    const g = sys.region?.grant();
    return !g || (x >= g.x && z >= g.z && x < g.x + g.width && z < g.z + g.depth);
  }

  // ------------------------------------------------------------------------------------ hearing the others

  events.on('flag.changed', ({ flag, value }) => {
    // The blessing's choice: the pump goes in the field, or stays in its crate by the camp.
    if (flag === FLAG.choice('pump') && pumpState === 'none') {
      if (value === CHOICES.pump[1]) setPump(true);
      else {
        pumpState = 'crated';
        pumpAt = crateSpot();
      }
    }
  });

  events.on('item.gained', ({ id, count }) => {
    if (id === 'wheat' && pumpState === 'running') pumpWheat += count;
  });
  events.on('item.lost', ({ id }) => {
    if (id === 'wheat' && !selling) pumpWheat = Math.min(pumpWheat, bag('wheat'));
  });

  // The pumped field gives three times what it would: two more for every one it makes.
  events.on('good.made', ({ farm, item, count, at }) => {
    if (pumpState !== 'running' || farm !== 'field' || item !== 'wheat') return;
    sys.machines?.drop(item, count * (PUMP.yield - 1), at);
  });
  events.on('crop.harvested', ({ x, z, crop }) => {
    if (pumpState !== 'running' || crop !== 'wheat' || !onGrant(x, z)) return;
    const gives = sys.crops?.defs().find((def) => def.id === crop)?.gives ?? [];
    for (const stack of gives) sys.inventory?.add(stack.id, stack.count * (PUMP.yield - 1));
  });

  events.on('day.started', () => {
    newDay();
    postRush();
  });
  // One more road lamp a night, whether the night is watched or slept through.
  function lightLamp(night: number): void {
    if (lampsOwed <= 0 || litNight >= night) return;
    litNight = night;
    lampsOwed--;
    flags.add(FLAG.roadLamps, 1);
  }
  events.on('night.started', ({ day: night }) => lightLamp(night));
  events.on('slept', ({ day: morning }) => lightLamp(morning - 1));

  // ------------------------------------------------------------------------------------ the quest steps

  function look(): void {
    if (sold && picked) step('count', 'sow');
    lookAtPacks();
  }

  // ------------------------------------------------------------------------------------ "E" in the world

  function counterAt(places: readonly string[]): Vec3 | null {
    const at = placeAt(places);
    return at ? { x: at.x + COUNTER_EAST, y: at.y, z: at.z } : null;
  }
  const counter = (buyer: TownBuyer): Interactable => {
    let cached: Vec3 | null = null;
    return {
      id: `goods:${buyer}`,
      pos: () => (cached ??= counterAt(BUYERS[buyer].places)) ?? { x: 0, y: -100, z: 0 },
      radius: COUNTER,
      prompt: () => (canTrade() ? (buyer === 'granary' ? 'Sell at the granary, and the queen\'s ledger' : 'Sell on the market green') : null),
      act: () => events.emit('ui.open', { panel: 'goods', detail: buyer }),
    };
  };
  /** The queen has shown the hero her ledger: her scene, or a section already filled. */
  const ledgerShown = (): boolean => flags.is(FLAG.scene(22)) || flags.is(FLAG.questDone('count')) || filledCount() > 0;
  const targets: Interactable[] = [
    counter('granary'),
    counter('market'),
    // The ledger also lies open beside the queen in her hall, where the quest's ledger steps point.
    {
      id: 'goods:ledger',
      pos: () => counterAt(['town.hall']) ?? { x: 0, y: -100, z: 0 },
      radius: COUNTER,
      prompt: () => (canTrade() && ledgerShown() ? 'Open the queen\'s ledger' : null),
      act: () => events.emit('ui.open', { panel: 'ledger' }),
    },
    {
      id: 'goods:inn',
      pos: () => placeAt([ROAD.inn.place]) ?? { x: 0, y: -100, z: 0 },
      radius: COUNTER,
      prompt: () => (canTrade() && evening() ? `Take a bed at the inn: ${ROAD.inn.coin} coin` : null),
      act: () => {
        const reason = buy('inn');
        if (reason) toast(`${reason}.`);
      },
    },
    ...[ROAD.ferry.from, ROAD.ferry.to].map((place): Interactable => ({
      id: `goods:ferry:${place}`,
      pos: () => placeAt([place]) ?? { x: 0, y: -100, z: 0 },
      radius: COUNTER,
      prompt: () => (canTrade() ? `Take the ferry ${place === ROAD.ferry.from ? 'to the landing' : 'to Hollowmere'}: ${ROAD.ferry.coin} coin` : null),
      act: () => {
        const reason = buy('ferry');
        if (reason) toast(`${reason}.`);
      },
    })),
    {
      id: 'goods:pump',
      pos: () => pumpAt ?? { x: 0, y: -100, z: 0 },
      radius: PUMP_REACH,
      prompt: () => (pumpState === 'running' ? 'Pull out the Order\'s pump' : pumpState === 'crated' && pumpAt ? 'Set the Order\'s pump running in your field' : null),
      act: () => { setPump(pumpState !== 'running'); },
    },
  ];
  let added = false;

  // ------------------------------------------------------------------------------------ the api

  const api: GoodsApi = {
    coin,
    ledger: ledgerView,
    pumpRunning: () => pumpState === 'running',
    buyer: buyerView,
    sell,
    marketDay,
    pumpWheat: () => Math.min(pumpWheat, bag('wheat')),
    picked: () => picked,
    pick(section) {
      if (!ledgerOpen()) return;
      picked = section;
      look();
    },
    deliver,
    orders: () => ORDERS.map((def) => orderView(def.id)),
    fill,
    rush: rushView,
    meetRush,
    shop: (): ShopView[] => SHOP_IDS.map((id) => ({ id, coin: priceOf(id), why: why(id) })),
    buy,
    furniture: () => ({ grade: grade(), hearts: FURNITURE[grade() - 1].hearts }),
    pump: (): PumpView => ({ running: pumpState === 'running', at: pumpAt, grey: grey(), greyAt: grey() > 0 ? greyAt : null }),
    setPump,
  };

  const system: SimSystem = {
    step(dt) {
      if (!added && sys.interact) {
        added = true;
        for (const target of targets) sys.interact.add(target);
      }
      // A game skipped past the blessing has the choice already made.
      if (pumpState === 'none' && flags.get(FLAG.choice('pump')) !== undefined) {
        if (flags.get(FLAG.choice('pump')) === CHOICES.pump[1]) setPump(true);
        else {
          pumpState = 'crated';
          pumpAt = crateSpot();
        }
      }
      if (pumpState === 'crated' && !pumpAt) pumpAt = crateSpot();
      lookIn -= dt;
      if (lookIn > 0) return;
      lookIn = LOOK_EVERY;
      newDay();
      if (marketDay() && clock.timeOfDay >= DAWN) postRush();
      look();
    },
    save(): GoodsSave {
      return {
        version: 1, day, taken, ledger: have, picked, sold, pumpWheat,
        pump: { state: pumpState, at: fromVec(pumpAt), greyAt: fromVec(greyAt), healFrom },
        lampsOwed, litNight, rush,
      };
    },
    load(data) {
      const save = data as Partial<GoodsSave> | undefined;
      if (save?.version !== 1) return;
      day = save.day ?? clock.day;
      taken = save.taken ?? {};
      have = save.ledger ?? {};
      picked = save.picked ?? null;
      sold = !!save.sold;
      pumpWheat = save.pumpWheat ?? 0;
      pumpState = save.pump?.state ?? 'none';
      pumpAt = toVec(save.pump?.at ?? null);
      greyAt = toVec(save.pump?.greyAt ?? null);
      healFrom = save.pump?.healFrom ?? -1;
      lampsOwed = save.lampsOwed ?? 0;
      litNight = save.litNight ?? 0;
      rush = save.rush ?? null;
    },
  };
  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createGoods(kernel.game);
  kernel.add('goods', api, system);
}
