// Where the goods go, as data: the buyers and their daily caps, the queen's ledger and the standing orders after
// it, what coin buys, and the Order's pump. From handbook chapter 30 ("Where the goods go") and
// `playthrough/farms.js` (`market`, `buys`, `ledger`, `pump`, `take`). The rules are src/game/goods.
//
// Chapter 30 gives no prices. The ones here start from the old design's (wheat 2 a sack, honey 8, moss fiber 3):
// a day of the granary's 40 wheat is 80 coin, so the ring of land is two good days.

import type { ItemId, LedgerSection } from './ids.ts';

// ------------------------------------------------------------------------------------------ selling

/** Coin a buyer pays for one. Only what someone buys has a price. */
export const PRICES: Readonly<Partial<Record<ItemId, number>>> = { wheat: 2, honey: 8, moss_fiber: 3, quill: 4 };

/** The two buyers in Hollowmere. Your kitchen takes food through the settlement's larder, and your bench the found things. */
export type TownBuyer = 'granary' | 'market';

export interface BuyerDef {
  buyer: TownBuyer;
  name: string;
  /** The places it stands at, the first the region has: the world names `town.granary` and `town.market`. */
  places: readonly string[];
  takes: readonly ItemId[];
  /** Of each good, a day. */
  cap: number;
  /** More a day for each of the Order's pumps out of Hollowmere's fields. */
  perPump?: number;
  /** Twice the cap on market day. */
  marketDay?: boolean;
  /** One line under its name. */
  says: string;
}

export const BUYERS: Readonly<Record<TownBuyer, BuyerDef>> = {
  granary: {
    buyer: 'granary', name: 'The granary', places: ['town.granary', 'granary'], takes: ['wheat'], cap: 40, perPump: 20,
    says: 'The queen\'s granary takes wheat: 40 a day, and 20 more for every pump out of the town\'s fields.',
  },
  market: {
    buyer: 'market', name: 'The market green', places: ['town.market', 'town.square'], takes: ['honey', 'moss_fiber', 'quill'], cap: 10, marketDay: true,
    says: 'The stalls on the green take honey, moss fiber and quills: 10 of each a day, twice that on market day.',
  },
};

/** Every seventh day is market day. */
export const MARKET_EVERY = 7;
export const isMarketDay = (day: number): boolean => day > 0 && day % MARKET_EVERY === 0;

/** The Order's pumps in Hollowmere's edge fields, one a field (`CITY_FIELDS` in the world's plan). */
export const TOWN_PUMPS = 6;
/** How many still stand once `filled` of the ledger's four sections are filled: they come out a few at a time. */
export const pumpsStanding = (filled: number): number => Math.ceil((TOWN_PUMPS * (LEDGER.length - Math.min(filled, LEDGER.length))) / LEDGER.length);

/**
 * The rush order on market day: twice your best daily rate of a market good, by nightfall, for a gift nobody else
 * gives. Only taking, or a second farm built that day, meets it.
 */
export const RUSH = {
  /** Times the farm's daily rate. */
  times: 2,
  /** It never asks for fewer than this. */
  least: 10,
  coin: 40,
  /** Sunroot seeds: "Nobody sells these." */
  gift: { id: 'sunroot_seeds', count: 6 } as const,
  /** The farm that makes each good the market buys. */
  farms: { moss_fiber: 'moss', quill: 'quill', honey: 'bee' } as const,
} as const;

// ------------------------------------------------------------------------------------------ the queen's ledger

export interface LedgerSectionDef {
  section: LedgerSection;
  name: string;
  needs: readonly { item: ItemId; count: number }[];
  /** What filling it does, in words. */
  gives: string;
  /** One line under the name on the ledger's page. */
  about: string;
  /** An icon from the manifest for the reward. */
  icon: string;
}

/**
 * Four things Hollowmere needs before it can pull out the Order's pumps, filled in any order. The queen takes no
 * wheat from a pumped field. When the fourth fills, the last pump comes out and the gold road above the town goes dark.
 */
export const LEDGER: readonly LedgerSectionDef[] = [
  {
    section: 'granary', name: 'The granary', needs: [{ item: 'wheat', count: 40 }, { item: 'moss_fiber', count: 10 }],
    gives: 'The queen\'s seed store opens to you.', about: 'Grain and fiber for the queen\'s stores.', icon: 'act1-seeds',
  },
  {
    section: 'mill', name: 'The mill', needs: [{ item: 'wheat', count: 120 }, { item: 'honey', count: 10 }],
    gives: 'Bread takes one wheat, not two.', about: 'Wheat to turn the stones again, and honey for the miller\'s bread.', icon: 'bread',
  },
  {
    section: 'lamphouse', name: 'The lamp house', needs: [{ item: 'glow_dust', count: 20 }],
    gives: 'Lamps along the road to town. You can walk it at night.', about: 'Dust for lamps that need no gold.', icon: 'lantern',
  },
  {
    section: 'wheelwright', name: 'The wheelwright\'s yard', needs: [{ item: 'gear_spring', count: 20 }, { item: 'copper', count: 10 }],
    gives: 'The town builds wheels of its own.', about: 'Springs and copper, so the town can build its own wheels.', icon: 'act1-gear-spring',
  },
];

export const ledgerDef = (section: LedgerSection): LedgerSectionDef => LEDGER.find((def) => def.section === section)!;

/** The queen says this when the last section fills and the last pump comes out. */
export const LEDGER_DONE = 'The last pump is out of Hollowmere\'s fields. Above the town, the gold road goes dark.';

// ------------------------------------------------------------------------------------------ standing orders

export const ORDER_IDS = ['lamps', 'wheel', 'rootworks', 'west'] as const;
export type OrderId = (typeof ORDER_IDS)[number];

export interface OrderDef {
  id: OrderId;
  name: string;
  /** `deliver`: the queen takes it, again and again. `pack`: what to carry, read from the bag, never taken. */
  kind: 'deliver' | 'pack';
  needs: readonly { item: ItemId; count: number }[];
  /** A pack order also wants all three kit slots filled. */
  kit?: boolean;
  /** Coin for each delivery. */
  coin: number;
  /** A delivery order fills at most this many times. */
  most: number;
  gives: string;
}

/** What the ledger asks for once its four sections are filled. */
export const ORDERS: readonly OrderDef[] = [
  {
    id: 'lamps', name: 'Road lamps', kind: 'deliver', needs: [{ item: 'glow_dust', count: 5 }], coin: 20, most: 12,
    gives: 'One more lamp a night, out along the roads toward the three vaults. A lit road is a fast road.',
  },
  {
    id: 'wheel', name: 'The town\'s next wheel', kind: 'deliver', needs: [{ item: 'gear_spring', count: 10 }, { item: 'copper', count: 5 }, { item: 'old_brass', count: 1 }],
    coin: 50, most: 6, gives: 'Each wheel takes one more family\'s field out of the grey. The queen names the family.',
  },
  {
    id: 'rootworks', name: 'The Rootworks', kind: 'pack',
    needs: [{ item: 'waterwheel', count: 1 }, { item: 'gear_shaft', count: 4 }, { item: 'switch_lamp', count: 2 }, { item: 'sensor', count: 1 }, { item: 'harvester_arm', count: 1 }],
    coin: 0, most: 1, gives: 'Three dead machines, one a level. You rebuild each from the parts in your pack.',
  },
  {
    id: 'west', name: 'The road west', kind: 'pack', needs: [{ item: 'travel_meal', count: 6 }, { item: 'vine_rope', count: 2 }], kit: true,
    coin: 0, most: 1, gives: 'What you pack for the pilgrimage. Your Gate keeps sending more from home.',
  },
];

export const orderDef = (id: OrderId): OrderDef => ORDERS.find((def) => def.id === id)!;

/** The families whose fields the town's own wheels take out of the grey, in the order the queen names them. */
export const WHEEL_FAMILIES = ['the Carrows', 'the Pells', 'the Dunmores', 'the Hasks', 'the Orrins', 'the Brays'] as const;

// ------------------------------------------------------------------------------------------ what coin buys

export const SHOP_IDS = ['ring', 'seeds', 'furniture', 'inn', 'ferry', 'guide'] as const;
export type ShopId = (typeof SHOP_IDS)[number];

/** A ring of eight more blocks round your claim. The region reads `land.rings` and grows the grant. */
export const LAND_RING = { blocks: 8, coin: 150, most: 2 } as const;

/** The queen's seed store, once the granary's section is filled: a sack of seed for coin. */
export const SEED_SACK = { item: 'wheat_seeds', count: 10, coin: 10 } as const;

/** Furniture for your homes in three grades. The better it is, the more hearts each use gives. */
export const FURNITURE = [
  { grade: 1, name: 'Plain', coin: 0, hearts: 1, text: 'What you made with your own hands.' },
  { grade: 2, name: 'Good', coin: 120, hearts: 2, text: 'A carpenter\'s chairs, a table that does not rock, a chest with a good lid.' },
  { grade: 3, name: 'Fine', coin: 300, hearts: 3, text: 'Turned legs, a painted headboard, quilts from the market green.' },
] as const;

/** On the road: coin is the one thing every realm takes. */
export const ROAD = {
  /** A bed at the inn by the Hollow Oak, from evening on. */
  inn: { coin: 10, place: 'lodge' },
  /** The ferry from the town's quay to the landing below your land, and back. */
  ferry: { coin: 5, from: 'ferry', to: 'landing' },
  /** A guide to the door of a vault the Custodian marked. */
  guide: { coin: 25 },
} as const;

// ------------------------------------------------------------------------------------------ the Order's pump

/**
 * The Order's root pump: it triples a field with no parts and no upkeep. While it runs the Heartstone reads one step
 * lower and the grass round it goes grey. Pull it out any time and the ground heals in three days. The granary takes
 * pump wheat; the queen's ledger does not.
 */
export const PUMP = {
  /** What the pumped field gives, times what it would. */
  yield: 3,
  /** Days the grey ground takes to heal once the pump is out. */
  healDays: 3,
  /** How far the grey reaches round the pump, in blocks. */
  grey: 5,
  /** The pump's crate stands this far from the camp's fire, east and south. */
  crate: { dx: -2.5, dz: 2.5 },
  /** Before there is a wheat field, it goes in this far from the plot's middle, clear of the camp. */
  plot: { dx: 3, dz: 9 },
} as const;
