// Every id that act 1's systems share, as one list each, with a type made from the list. A wrong id is a type
// error: `'kichen'` is no QuestId. The lists come from the handbook's `playthrough/content.js` (quests, people,
// places, fights) and `playthrough/farms.js` (goods, parts, kit, farms), and docs/act1-foundation.md says
// which builder fills what.
//
// Add an id here, in the list it belongs to, before anything uses it. Nothing else in the game keeps a list of
// these: `src/game/content/items.ts` gives each item its name and icon, and a test checks the two match.

// ------------------------------------------------------------------------------------------ quests

/** The 21 quests of act 1, in the order they play. `night` keeps its old id: the Hall keys on `quest.night.*`. */
export const QUEST_IDS = [
  'grantday', 'ground', 'night', 'blessing', 'kitchen', 'greywood', 'bench', 'copper', 'count', 'echo', 'pump',
  'uphill', 'gallery', 'lights', 'seeds', 'itself', 'roofs', 'keystones', 'stag', 'green', 'pilgrimage',
] as const;
export type QuestId = (typeof QUEST_IDS)[number];

/** What a quest step asks the player to do, as chapter 27 names it. */
export type StepKind = 'film' | 'talk' | 'go' | 'do' | 'watch' | 'fight' | 'scene' | 'choice' | 'sleep';

/** The 38 scenes of chapter 22, by number. Scene n has played when the flag `scene.<n>` is set. */
export type SceneNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19
  | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38;

/** The twelve fights of chapter 23, by number. `src/game/content/greenhollow.ts` places them (`FIGHTS`). */
export type FightNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * The choices the story remembers, each the flag `choice.<id>` with one of its values. The kitchen's one step
 * asks two of them, Hobb's room and Dax's job, so nine choice steps make ten. The first value of each is the one
 * `quests.skipTo` picks for a quest it passes over.
 */
export const CHOICES = {
  weapon: ['sword', 'bow', 'staff'],
  pump: ['crated', 'running'],
  hobb: ['kitchen', 'smokehouse'],
  dax: ['watch', 'yard'],
  burrowers: ['give', 'take'],
  dinner: ['gus', 'hobb'],
  calla: ['kept', 'shown'],
  gearlings: ['give', 'take'],
  gus: ['gus', 'arm'],
  mina: ['maproom', 'survey'],
} as const;
export type ChoiceId = keyof typeof CHOICES;
export type ChoiceValue<C extends ChoiceId> = (typeof CHOICES)[C][number];

// ------------------------------------------------------------------------------------------ people

/** The people of act 1, as `content.js` has them. `elowen` is the Green Mother. */
export const PERSON_IDS = [
  'hero', 'custodian', 'hobb', 'dax', 'mina', 'guildmaster', 'tamsin', 'wren', 'maren', 'gus', 'tansy', 'holt',
  'elowen', 'calla', 'aldric', 'ren', 'stag', 'ilara', 'auren',
] as const;
export type PersonId = (typeof PERSON_IDS)[number];

/**
 * Whoever can stand in the world or speak a line: a person of act 1, a background
 * villager (`villager-3`), the speaker of a scene a system starts (`scene`), or a one-off voice in a scene
 * (`voice.girl`, `voice.old-woman`), who has a name in the dialogue and no place in the world.
 */
export type NpcId = PersonId | `villager-${number}` | 'scene' | `voice.${string}`;

// ------------------------------------------------------------------------------------------ places

/** The places on the Greenhollow map, as `PLACES` in `src/game/content/greenhollow.ts` lists them. A test keeps the two the same. */
export const MAP_PLACE_IDS = [
  'plot', 'hall', 'garden', 'town', 'chapel', 'landing', 'bridge', 'arches', 'highroad', 'foxes', 'boar', 'terraces', 'dawn',
  'caves', 'lampgallery', 'pumphouse', 'seedvault', 'shrine-oak', 'shrine-bend', 'shrine-knoll', 'shrine-forest',
  'shrine-marsh', 'shrine-terrace', 'ruin-tower', 'ruin-stair', 'ruin-mill', 'ruin-wall', 'ruin-post',
] as const;
export type MapPlaceId = (typeof MAP_PLACE_IDS)[number];
/** Saltgate is a day down the river, off the map: act 1 starts there. */
export type PlaceId = MapPlaceId | 'saltgate';
/** A place, or a spot inside one: `hall.heart`, `plot.pond`, `saltgate.quay`. */
export type PlaceRef = PlaceId | `${PlaceId}.${string}`;

export type ShrineId = Extract<MapPlaceId, `shrine-${string}`>;
export type RuinId = Extract<MapPlaceId, `ruin-${string}`>;
export type VaultId = Extract<MapPlaceId, 'pumphouse' | 'lampgallery' | 'seedvault'>;
/** The stones that remember: the Hall's under the mural, one in each vault, and the two small ruins that hold one. */
export type MemoryId = 'hall' | VaultId | 'ruin-tower' | 'ruin-stair';
export type KeystoneNumber = 1 | 2 | 3;

// ------------------------------------------------------------------------------------------ farms, goods and coin

/** The eleven farms of chapter 30, by `farms.js`'s ids. */
export const FARM_IDS = ['field', 'moss', 'quill', 'copper', 'seed', 'spring', 'pond', 'bee', 'dust', 'rope', 'plough'] as const;
export type FarmId = (typeof FARM_IDS)[number];
export type FarmMode = 'give' | 'take';

/** The four sections of the queen's ledger. */
export const LEDGER_SECTIONS = ['granary', 'mill', 'lamphouse', 'wheelwright'] as const;
export type LedgerSection = (typeof LEDGER_SECTIONS)[number];

/** Who buys goods: the granary, the market green, and your own kitchen. */
export type BuyerId = 'granary' | 'market' | 'kitchen';

/** The steps of the settlement, chapter 30. */
export const SETTLEMENT_STEPS = ['camp', 'homestead', 'hamlet', 'freehold'] as const;
export type SettlementStep = (typeof SETTLEMENT_STEPS)[number];

// ------------------------------------------------------------------------------------------ items

/** The items the game had before act 1, kept while something still uses them. */
export const BASE_ITEM_IDS = [
  'oak_log', 'plank', 'fiber', 'berry', 'wheat_seeds', 'bread', 'axe', 'hoe', 'watering_can', 'pickaxe',
  'workbench', 'bed', 'chest', 'fence', 'dirt', 'stone', 'cobble', 'oak_plank', 'lamp', 'glass', 'thatch',
  'plaster', 'stone_brick', 'sand', 'almanac', 'river_lamp',
] as const;

/** What farms make and what is found in the world. `moss_fiber` is what the old `moss_tuft` was. */
export const GOOD_IDS = [
  'wheat', 'carrot_seeds', 'carrot', 'sunroot_seeds', 'sunroot', 'moss_fiber', 'quill', 'copper', 'gear_spring',
  'frog_slick', 'honey', 'wax', 'glow_dust', 'vine_rope', 'old_brass', 'tusk_tip', 'shed_pelt', 'heartwood',
  'meal', 'travel_meal',
] as const;

/** Machine parts and simple builds, chapter 30. `sprinkler` was an item before act 1 and is one of these now. */
export const PART_IDS = [
  'spade', 'waterwheel', 'gear_shaft', 'lever', 'sprinkler', 'chute', 'collector_chest', 'pusher', 'sensor',
  'switch_lamp', 'harvester_arm', 'saw_arm', 'bee_box', 'post', 'clapper', 'hatch', 'rope_ladder',
] as const;

/** The six things the kit's three slots carry into a fight. */
export const KIT_IDS = ['quill_strip', 'lamp_post_kit', 'slick_patch', 'clapper_kit', 'pusher_plate', 'salve'] as const;

/** The settlement's buildings, each an item to set down: `BUILDINGS` in `src/game/content/people.ts`. */
export const HOME_IDS = [
  'fire_pit', 'bedroll', 'home_bed', 'lantern', 'oven', 'prep_table', 'kitchen', 'dinner_table', 'table_bench', 'cottage',
  'map_room', 'smokehouse', 'seed_shed', 'beast_yard', 'watch_post',
] as const;

export const ITEM_IDS = [...BASE_ITEM_IDS, ...GOOD_IDS, ...PART_IDS, ...KIT_IDS, ...HOME_IDS] as const;
export type GoodId = (typeof GOOD_IDS)[number];
export type PartId = (typeof PART_IDS)[number];
export type KitId = (typeof KIT_IDS)[number];
export type ItemId = (typeof ITEM_IDS)[number];

/** True when a string from outside (a save, the debug door, a URL) is an item id. */
export const isItemId = (id: string): id is ItemId => (ITEM_IDS as readonly string[]).includes(id);
export const isQuestId = (id: string): id is QuestId => (QUEST_IDS as readonly string[]).includes(id);
