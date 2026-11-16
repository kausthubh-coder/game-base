// The people of Greenhollow, as data. The people system walks them through their routines.
// Places are names from the region. Lines of dialogue live with the talk system. The second half of the file
// is the settlement: who comes to live on the player's land, and what they need.

import type { ItemDef, PlaceableDef, Recipe } from '../api.sim.ts';
import type { ItemId, NpcId } from './ids.ts';

export interface RoutineStop {
  /** The hour of the day this stop begins, 0 to 24. It holds until the next stop's hour. */
  hour: number;
  place: string;
  /** Blocks east and south of the place to stand at, so "nearby" needs no place of its own. */
  offset?: { x: number; z: number };
}

export interface PersonDef {
  id: NpcId;
  name: string;
  /** A sprite and a portrait name from the manifest. */
  sprite: string;
  portrait: string;
  /** A voice id for the sound engine. */
  voice: string;
  /** Background resident assigned a unique appearance at world creation. */
  crowd?: boolean;
  /** Stops in order of hour. Before the first hour of a day, the last stop still holds. */
  routine: RoutineStop[];
  /** Stays at this place, whatever the hour, until the flag is set. */
  stay?: { place: string; until: string };
  /** Ignores the hours and walks to another of these places every `every` seconds, give or take a quarter. */
  wander?: { places: string[]; every: number; spread: number };
  /** Not in the world until this flag is set. Someone who comes to live on the player's land is `settler.<id>`. */
  appears?: string;
}

const at = (place: string): RoutineStop[] => [{ hour: 0, place }];

const named = (id: NpcId, name: string, routine: RoutineStop[], extra: Partial<PersonDef> = {}): PersonDef => ({
  id, name, sprite: id, portrait: id, voice: id, routine, ...extra,
});

const TOWN_WALK = ['town.square', 'river.bank', 'town.gate'];

const villager = (n: number, name: string, kind: 'a' | 'b', every: number): PersonDef => ({
  id: `villager-${n}`,
  crowd: true,
  name,
  sprite: `villager-${kind}`,
  portrait: `villager-${kind}`,
  voice: `villager-${kind}`,
  routine: at('town.square'),
  wander: { places: TOWN_WALK, every, spread: 4 },
});

/** Someone who lives on the player's land once `settler.<id>` is set. Until then they are not in the world. */
const settler = (id: SettlerId, name: string): PersonDef => named(id, name, at('grant.center'), { appears: `settler.${id}` });

export const PEOPLE: readonly PersonDef[] = [
  named('tamsin', 'Tamsin', [
    { hour: 6, place: 'lodge' },
    { hour: 20, place: 'lodge', offset: { x: 3, z: 2 } },
  ], { stay: { place: 'grant.stone', until: 'quest.night.done' } }),
  // Maren sleeps on a sack in the granary, counting, until the hero meets her there (scene 22). Then she keeps
  // the Queen's Hall across Civic Street, whose porch takes the ledger's deliveries.
  named('maren', 'Maren', at('town.hall'), { stay: { place: 'granary', until: 'scene.22' } }),
  // Gus keeps his field under the arches until the lynx, and Wren the queen's kennels until the boar. Then the
  // settlement walks them by its own routine (src/game/settlement), and these stops are not used.
  named('gus', 'Gus', at('gus.field')),
  named('wren', 'Wren', at('kennel')),
  villager(1, 'Pell', 'a', 70),
  villager(2, 'Anwen', 'b', 85),
  villager(3, 'Corin', 'a', 100),
  villager(4, 'Hesper', 'b', 115),
  villager(5, 'Dunn', 'a', 130),
  villager(6, 'Isolde', 'b', 145),
  villager(7, 'Nessa', 'a', 95),
  villager(8, 'Roan', 'b', 110),
  villager(9, 'Pip', 'a', 125),
  villager(10, 'Bryn', 'b', 140),
  // The settlers who come from off the map. They are last, so the town's people keep their order.
  settler('hobb', 'Hobb'),
  settler('dax', 'Dax'),
  settler('mina', 'Mina'),
  settler('tansy', 'Tansy'),
  settler('holt', 'Holt'),
];

/** Blocks a second. */
export const WALK_SPEED = 2.2;
/** Someone further than this from the player does not walk. They jump to where the routine has them. */
export const WALK_RANGE = 60;
/** Someone standing this close to the player turns to face them. */
export const FACE_RANGE = 3;
/** How close the player must be for "Talk to" to show. */
export const TALK_RANGE = 2.5;

/** One appearance per resident, shuffled once by the world's seeded random stream. */
export const CROWD_SPRITES = ['villager-a', 'villager-b', 'town-pell', 'town-corin', 'town-hesper', 'town-dunn', 'town-isolde', 'town-nessa', 'town-roan', 'town-pip', 'town-acolyte-a', 'town-acolyte-b'] as const;

export const JOB_BARKS: Readonly<Record<string, string>> = {
  'town-pell': "Fish took my bait. Left me the hook. Polite of them.",
  'town-corin': "Bread is a penny. The warm smell is free.",
  'town-hesper': "River gets the mud out. Keeps the gossip.",
  'town-dunn': "Quiet watch today. Even the geese let me pass.",
  'town-isolde': "One loose thread. Always where the pattern turns.",
  'town-nessa': "Sit a minute. The work will wait. Mine always has.",
  'town-roan': "Gus says the rows are crooked. Wheat hasn't complained.",
  'town-pip': "The carpenter let me sort the nails. Bent ones have their own pot.",
};

// ======================================================================================== the settlement
// The people who come to live on the player's land, what they need and wish for, the work they choose, the
// dinner table, the buildings and the Heartstone's ladder. Handbook chapters 27, 28 and 30, from
// `playthrough/farms.js` (`people`, `heart`, `heartNote`). src/game/settlement plays it. The numbers are the
// design's first proposal.

export const SETTLER_IDS = ['hobb', 'dax', 'gus', 'wren', 'mina', 'tansy', 'holt'] as const;
export type SettlerId = (typeof SETTLER_IDS)[number];
export const isSettler = (id: string): id is SettlerId => (SETTLER_IDS as readonly string[]).includes(id);

/** Where a job is: a building of one of these kinds, tilled soil on the land, or a place of the region. */
export type Room = { kinds: readonly string[] } | { soil: true } | { place: string };

export interface JobDef {
  id: string;
  name: string;
  text: string;
  room: Room;
  /** "the kitchen": what to walk them to. */
  roomName: string;
}

/** The rule a wish is granted by. src/game/settlement reads each from the world. */
export type WishRule = 'river-kitchen' | 'gate-post' | 'rested-rows' | 'yard-water' | 'north-light' | 'no-taking' | 'hall-lamp';

export interface SettlerDef {
  who: SettlerId;
  name: string;
  /** The flag that brings them, or what has to stand on the land for the two who come because of it. */
  arrives: { flag: string } | { built: 'bees' | 'lamps' };
  /** The toast when they come. */
  arrival: string;
  /** They share a home with this settler. */
  household?: SettlerId;
  /** The kind of home they take first, when one stands. */
  prefers?: string;
  wish: { text: string; rule: WishRule };
  /** Two to choose from, by walking them to the room. Someone who came to do one thing has one, and starts it. */
  jobs: readonly JobDef[];
  /** The story's choice their job answers: `choice.<id>`, set to the job's id. */
  choice?: 'hobb' | 'dax' | 'mina';
  /** What you can tell from the road once they work. */
  road: string;
  /** Their ask at the dinner table, what they say when it is granted, and their one line when the other is. */
  ask?: { text: string; granted: string; other: string };
}

const KITCHENS = ['kitchen', 'oven'];

export const SETTLERS: readonly SettlerDef[] = [
  {
    who: 'hobb', name: 'Hobb', arrives: { flag: 'scene.18' }, arrival: 'Hobb and Dax have come to live on your land.',
    wish: { text: 'A kitchen window that looks at the river', rule: 'river-kitchen' },
    jobs: [
      { id: 'kitchen', name: 'The kitchen', text: 'A meal a day for everyone: extra hearts and stamina.', room: { kinds: KITCHENS }, roomName: 'the kitchen' },
      { id: 'smokehouse', name: 'The smokehouse', text: 'Travel meals that keep for a week, for the vaults and the road.', room: { kinds: ['smokehouse'] }, roomName: 'the smokehouse' },
    ],
    choice: 'hobb', road: 'Smoke from the chimney, and a bell at noon.',
    ask: { text: 'A window on the river side, Button. I cook blind in there.', granted: 'A window! I\'ll see the weather before it sees me.', other: 'Fine. I\'ll keep guessing. You\'ll know when I guess wrong.' },
  },
  {
    who: 'dax', name: 'Dax', arrives: { flag: 'scene.18' }, arrival: '', household: 'hobb',
    wish: { text: 'A post where he can see the gate and the road', rule: 'gate-post' },
    jobs: [
      { id: 'watch', name: 'The watch', text: 'Night visitors turn back at the fence. He comes when you call.', room: { kinds: ['watch_post'] }, roomName: 'the watch post' },
      { id: 'yard', name: 'The yard', text: 'He carries goods between any two chests you mark, before you have chutes.', room: { kinds: ['chest'] }, roomName: 'a chest' },
    ],
    choice: 'dax', road: 'A crate lid hung by the gate.',
    ask: { text: 'Lamps down the path. I can\'t watch what I can\'t see.', granted: 'Good. I\'ll walk it tonight.', other: 'Right. I\'ll walk it more.' },
  },
  {
    who: 'gus', name: 'Gus', arrives: { flag: 'fight.5.won' }, arrival: 'Gus has come home with you. He needs a bed under a roof.',
    wish: { text: 'One row in four left to rest', rule: 'rested-rows' },
    jobs: [
      { id: 'field', name: 'His own field', text: 'He rests rows, the bees stay, and in two weeks his field grows a seed nobody sells.', room: { soil: true }, roomName: 'your tilled field' },
      { id: 'shed', name: 'The seed shed', text: 'He replants whatever the arms and sprinklers cannot reach.', room: { kinds: ['seed_shed'] }, roomName: 'the seed shed' },
    ],
    road: 'A hat on the fence post, and a straight furrow.',
    ask: { text: 'East field wants three days\' rest. Three. Don\'t plant it, don\'t walk on it.', granted: 'Three days. The soil will thank you before I do.', other: 'Field\'ll still be tired next week. So will I.' },
  },
  {
    who: 'wren', name: 'Wren', arrives: { flag: 'fight.11.won' }, arrival: 'Wren has moved in, and Bramble with her.',
    wish: { text: 'Bramble\'s yard beside water', rule: 'yard-water' },
    jobs: [
      { id: 'beasts', name: 'The beast yard', text: 'A calmed beast settles in a day, and a second can share each strip.', room: { kinds: ['beast_yard'] }, roomName: 'the beast yard' },
      { id: 'wood', name: 'The wood', text: 'She walks the forest and brings back a creature you have no page for.', room: { place: 'camp.trees' }, roomName: 'the trees by your camp' },
    ],
    road: 'Bramble asleep across the path.',
    ask: { text: '(scratching the fox\'s ears) Your mossling pen\'s on Take. They\'re going grey. Turn it back to Give.', granted: 'They\'ll come back. They always do, if you let them.', other: 'They\'ll be gone by dawn, then. I\'ll count them for you.' },
  },
  {
    who: 'mina', name: 'Mina', arrives: { flag: 'quest.roofs.started' }, arrival: 'Mina has come up from the jetty with sixty years of delvers\' notes.', prefers: 'map_room',
    wish: { text: 'North light and a bigger table', rule: 'north-light' },
    jobs: [
      { id: 'maproom', name: 'The map room', text: 'She marks one small ruin a day, with what is in it.', room: { kinds: ['map_room'] }, roomName: 'the map room' },
      { id: 'survey', name: 'The survey', text: 'She reads your farms: the map shows each one\'s best rate and what is taking its creatures.', room: { soil: true }, roomName: 'your fields' },
    ],
    choice: 'mina', road: 'Maps pinned along the eaves to dry.',
    ask: { text: 'Take me into one ruin. One. I\'ll stand where you say and touch nothing.', granted: 'One! I\'m packing the big case.', other: 'One day you\'ll need a map of a ruin, and I\'ll have drawn it from the door.' },
  },
  {
    who: 'tansy', name: 'Tansy', arrives: { built: 'bees' }, arrival: 'A beekeeper has come up the road. Tansy asks to stay.',
    wish: { text: 'Seven days with nobody taking', rule: 'no-taking' },
    jobs: [{ id: 'bees', name: 'The hives', text: 'Bees give half again. She tells you when a hive thins.', room: { kinds: ['bee_box'] }, roomName: 'the bee boxes' }],
    road: 'Bees on her sleeves, and a veil on the gatepost.',
    ask: { text: 'Leave the far row to flowers this month. That\'s twenty-two more flowers. I worked it out.', granted: 'The bees heard you. Don\'t take it back.', other: 'Wheat, then. The bees will tell me what they think. Then I\'ll tell you.' },
  },
  {
    who: 'holt', name: 'Holt', arrives: { built: 'lamps' }, arrival: 'A lamplighter has stopped at your gate. Holt asks to stay.',
    wish: { text: 'A lamp at the Hall\'s door', rule: 'hall-lamp' },
    jobs: [{ id: 'lamps', name: 'The lamps', text: 'Plain lamps light at dusk with no sensor.', room: { kinds: ['lantern'] }, roomName: 'a lamp' }],
    road: 'Every lamp lit at dusk, a minute before you think of it.',
  },
];

export const SETTLER: Readonly<Record<SettlerId, SettlerDef>> = Object.fromEntries(SETTLERS.map((s) => [s.who, s])) as Record<SettlerId, SettlerDef>;

// ------------------------------------------------------------------------------------------ the buildings

/** One kind of thing the player builds for the settlement. Its item, placeable and prop share the kind. */
export interface BuildingDef {
  kind: string;
  /** An icon name from the manifest, for its item. */
  icon: string;
  name: string;
  prop: string;
  /** Blocks along x, y and z, from the prop's own size. */
  size: [number, number, number];
  /** The placeable's own words after "E:", or null. A building with a door has its prompt from the settlement. */
  prompt: string | null;
  /** Beds under its own roof. */
  beds?: number;
  /** A home that makes a household: kitchens and workrooms do not. */
  home?: boolean;
  bed?: true;
  lamp?: true;
  fire?: true;
  /** Light it gives off, 0 to 15. */
  light?: number;
  /** A placeable's station: a bed sleeps. */
  station?: string;
  needs: { id: string; count: number }[];
  description: string;
}

export const BUILDINGS: readonly BuildingDef[] = [
  { kind: 'fire_pit', icon: 'wood', name: 'Fire pit', prop: 'homeFire', size: [3, 1, 3], prompt: null, fire: true, light: 13, needs: [{ id: 'oak_log', count: 3 }], description: 'A ring of stones and a fire. Something to come home to.' },
  { kind: 'bedroll', icon: 'bed', name: 'Bedroll', prop: 'homeBedroll', size: [1, 1, 2], prompt: 'Sleep', bed: true, station: 'bed', needs: [{ id: 'fiber', count: 4 }, { id: 'moss_fiber', count: 2 }], description: 'Stuffed with moss. A bed, once it is under a roof.' },
  { kind: 'home_bed', icon: 'bed', name: 'Quilted bed', prop: 'homeBed', size: [1, 1, 2], prompt: 'Sleep', bed: true, station: 'bed', needs: [{ id: 'plank', count: 6 }, { id: 'moss_fiber', count: 3 }], description: 'A frame, a quilt and a pillow. A bed, under a roof.' },
  { kind: 'lantern', icon: 'lantern', name: 'Lamp', prop: 'homeLamp', size: [1, 3, 1], prompt: null, lamp: true, light: 12, needs: [{ id: 'plank', count: 1 }, { id: 'moss_fiber', count: 1 }], description: 'An amber lamp on a post. Everyone wants one by their door.' },
  { kind: 'oven', icon: 'bread', name: 'Clay oven', prop: 'homeOven', size: [2, 3, 2], prompt: null, light: 10, needs: [{ id: 'dirt', count: 8 }, { id: 'plank', count: 2 }], description: 'With a table beside it, a kitchen.' },
  { kind: 'prep_table', icon: 'workbench', name: 'Table', prop: 'homeTable', size: [3, 1, 1], prompt: null, needs: [{ id: 'plank', count: 4 }], description: 'Beside an oven it makes a kitchen. By a home it makes a bigger table.' },
  { kind: 'kitchen', icon: 'bread', name: 'Kitchen', prop: 'homeKitchen', size: [6, 4, 5], prompt: null, light: 12, needs: [{ id: 'plank', count: 24 }, { id: 'fiber', count: 10 }, { id: 'dirt', count: 8 }], description: 'An oven under a roof, a counter and a window. Hobb\'s.' },
  { kind: 'dinner_table', icon: 'workbench', name: 'Dinner table', prop: 'homeDinnerTable', size: [6, 1, 2], prompt: null, needs: [{ id: 'plank', count: 6 }], description: 'A long table on the green, with benches and lanterns. Every third evening, two people ask you for something here.' },
  { kind: 'table_bench', icon: 'plank', name: 'Bench', prop: 'homeBench', size: [2, 1, 1], prompt: null, needs: [{ id: 'plank', count: 3 }], description: 'Somewhere to sit at the table.' },
  { kind: 'cottage', icon: 'hammer', name: 'Cottage', prop: 'homeSmall', size: [5, 4, 5], prompt: null, beds: 3, home: true, light: 12, needs: [{ id: 'plank', count: 40 }, { id: 'fiber', count: 16 }, { id: 'dirt', count: 10 }], description: 'A home: a roof and three beds. One household.' },
  { kind: 'map_room', icon: 'map', name: 'Map room home', prop: 'homeMapRoom', size: [7, 5, 6], prompt: null, beds: 1, home: true, light: 12, needs: [{ id: 'plank', count: 50 }, { id: 'fiber', count: 20 }, { id: 'dirt', count: 12 }], description: 'A home with a map room, and a window at the back.' },
  { kind: 'smokehouse', icon: 'bread', name: 'Smokehouse', prop: 'homeSmokehouse', size: [4, 5, 5], prompt: null, light: 8, needs: [{ id: 'plank', count: 20 }, { id: 'fiber', count: 6 }, { id: 'dirt', count: 6 }], description: 'Meals that keep for a week, for the vaults and the road.' },
  { kind: 'seed_shed', icon: 'seed', name: 'Seed shed', prop: 'homeSeedShed', size: [4, 4, 4], prompt: null, needs: [{ id: 'plank', count: 16 }, { id: 'fiber', count: 6 }], description: 'Bins of seed, and someone to plant them.' },
  { kind: 'beast_yard', icon: 'hammer', name: 'Beast yard', prop: 'homeBeastYard', size: [8, 4, 6], prompt: null, needs: [{ id: 'plank', count: 20 }, { id: 'fiber', count: 8 }], description: 'A shelter and a yard for a calmed beast.' },
  { kind: 'watch_post', icon: 'lantern', name: 'Watch post', prop: 'homeWatchPost', size: [3, 3, 3], prompt: null, light: 10, needs: [{ id: 'plank', count: 14 }, { id: 'fiber', count: 4 }], description: 'A roofed post with a view of the gate and the road.' },
];

export const BUILDING: ReadonlyMap<string, BuildingDef> = new Map(BUILDINGS.map((b) => [b.kind, b]));

/** The settlement's buildings as placeables (src/game/content/placeables.ts takes them in). */
export const HOME_PLACEABLES: readonly PlaceableDef[] = BUILDINGS.map((b) => ({
  kind: b.kind, name: b.name, prop: b.prop, size: b.size, prompt: b.prompt,
  ...(b.station ? { station: b.station } : {}), ...(b.light ? { light: b.light } : {}),
}));

/** Each building is an item to set down (src/game/content/items.ts takes them in). */
export const HOME_ITEMS: readonly ItemDef[] = BUILDINGS.map((b) => ({
  id: b.kind as ItemId, name: b.name, icon: b.icon, stack: 9, description: b.description, placeable: b.kind,
}));

/** Each building is made at the workbench (src/game/content/recipes.ts takes them in). */
export const HOME_RECIPES: readonly Recipe[] = BUILDINGS.map((b) => ({
  id: b.kind, makes: { id: b.kind as ItemId, count: 1 }, needs: b.needs.map((n) => ({ id: n.id as ItemId, count: n.count })), station: 'workbench',
}));

// ------------------------------------------------------------------------------------------ food and hearts

/** Meals a food makes in the kitchen's larder. */
export const FOOD: Readonly<Partial<Record<ItemId, number>>> = { wheat: 1, carrot: 1, sunroot: 1, berry: 1, honey: 1, bread: 2, meal: 1 };
/** Meals Hobb brings from Saltgate. */
export const LARDER_BRINGS = 12;
/** The larder is stocked up to this many days of meals for everyone. */
export const LARDER_DAYS = 3;
/** Travel meals that wait at the smokehouse, at most. */
export const TRAVEL_MOST = 6;

export const HEARTS = {
  /** A granted ask at dinner. */
  dinner: 10,
  /** A wish come true. */
  wish: 10,
  /** Each glad settler, each morning. */
  glad: 1,
  /** And one more each when Hobb keeps the kitchen and fed them. */
  kitchen: 1,
} as const;

/** How near, in blocks: a lamp to a bed or a home, water to the kitchen or the yard, the watch post to the road. */
export const REACH = { lamp: 5, water: 7, post: 14, table: 5, room: 4, hallLamp: 6 } as const;

/** Holt comes when every home has a lamp and this many lamps stand on the land. */
export const HOLT_LAMPS = 6;
/** Tansy comes for three bee boxes, twenty flowers, and no farm on Take for three days. */
export const TANSY = { boxes: 3, flowers: 20, days: 3 } as const;

/** Every third evening, dinner, from this time of day until midnight. */
export const DINNER = { every: 3, from: 0.66 } as const;
/** The first dinner's two asks: the quest of the echo asks Gus's or Hobb's (`choice.dinner`). */
export const FIRST_DINNER: readonly [SettlerId, SettlerId] = ['gus', 'hobb'];

/** A settler's day: at work, at the table, at home. Hours of the day. */
export const SETTLED_DAY = { work: 6, table: 18, home: 21 } as const;

// ------------------------------------------------------------------------------------------ the Heartstone

export interface HeartStep {
  level: number;
  /** What has to be alive on the land, in words. */
  asks: string;
  /** What it puts in reach. */
  reach: string;
  /** The Custodian's line the first time the stone reaches it, or empty. */
  says: string;
}

export const HEART_LADDER: readonly HeartStep[] = [
  // The first step is the night's own: scene 14 has the Custodian explain the stone, so it says nothing more.
  { level: 1, asks: 'Water in a field, and a fire', reach: 'A grey fox', says: '' },
  { level: 2, asks: 'A kitchen, three beds and a living farm', reach: 'A thistlehog, a pack of foxes', says: 'A kitchen. Three beds. Something growing that wants to. Two.' },
  { level: 3, asks: 'Three living farms, and everyone\'s needs met', reach: 'The lynx', says: 'Three farms living, and nobody on your land wanting. Three. The quick grey thing will come to your hand now.' },
  { level: 4, asks: 'A wheel turning, and a terrace that out-yields a pumped field', reach: 'A rootsnare', says: 'A wheel nobody winds, and water going uphill. Four. She built one like it.' },
  { level: 5, asks: 'Three households, six living farms, goods that move by themselves, and 60 hearts', reach: 'Bramble, the boar', says: 'Three roofs. Six farms. Goods walking on their own. Five. The boar can be reached. Go.' },
  { level: 6, asks: 'The god of the land set free', reach: 'What lies past Greenhollow', says: 'Six. The land remembers what it was. So do I. A little.' },
];

export const HEART_NOTE = 'Steps 1 to 5 come from what lives on your land: farms on Give, and people whose needs are met. A farm on Take does not count. The sixth comes when the Stag is free.';
/** The Custodian, the first time the Order's pump holds the stone a step down. */
export const PUMP_LINE = 'That pump. The stone reads one lower while it runs. I said nothing. Now I have.';

/** The settlement's steps, each with its story moment. */
export const STEP_MOMENTS: Readonly<Record<'homestead' | 'hamlet' | 'freehold', { title: string; text: string }>> = {
  homestead: { title: 'Homestead', text: 'Smoke from Hobb\'s oven. Your camp has become a home.' },
  hamlet: { title: 'Hamlet', text: 'Three lit windows on one hillside. Three households make a hamlet.' },
  freehold: { title: 'Freehold', text: 'The queen\'s charter. The valley round your door is yours to keep.' },
};
