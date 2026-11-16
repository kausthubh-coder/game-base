// The contract between the game's systems. Every system in src/game/<name>/ implements one of the
// interfaces below and reaches the others only through `game.systems`. Nothing here draws.
//
// A system exports `install(game: Game): SimSystem` from src/game/<name>/index.sim.ts. Install sets
// `game.systems.<name>` and returns the object the kernel steps and saves.
//
// If your system needs one more method or event, add it here in your own section and say so in your report.
//
// Act 1 (docs/act1-foundation.md): each of the seven new systems has its own section at the end of this file,
// marked with a line of `=`. A section adds its events to `GameEvents` and its api to `Systems` by declaring
// those interfaces again: TypeScript merges every declaration of an interface in one file. A builder edits
// only its own section, so two builders never touch the same lines.

import type { Ambient, Surface, Vec3 } from '../engine/types.ts';
import type { RayHit, World } from '../features/world/world.sim.ts';
import type { FittingId, Gear, GearTier, WeaponKind } from './content/gear.ts';
import type {
  BuyerId, FarmId, FarmMode, FightNumber, ItemId, KitId, LedgerSection, MemoryId, NpcId, PersonId, QuestId, RuinId,
  SceneNumber, SettlementStep, ShrineId, VaultId,
} from './content/ids.ts';

// ---------------------------------------------------------------------------------------- basics

/** Every id is one of the lists in src/game/content/ids.ts, so a wrong one fails the type check. */
export type { ItemId, NpcId, QuestId };

export interface Stack {
  id: ItemId;
  count: number;
}

/** Something the sprite layer draws. Systems add and remove actors. The view copies them to sprites. */
export interface Actor {
  /** Unique, for example `npc:tamsin`, `pet:leaftail:1`, `creature:mossling:3`, `player`. */
  id: string;
  /** A sprite name from public/assets/manifest.json. */
  sprite: string;
  pos: Vec3;
  /** Physical feet for lighting when pos follows the painted surface. Defaults to pos.y. */
  lightY?: number;
  /** The way it faces, in radians around the up axis. 0 faces north (-z), and it turns clockwise seen from above. */
  facing: number;
  /** An animation name from the manifest, usually `idle` or `walk`. */
  anim: string;
  visible: boolean;
  /** A small symbol the interface floats above it: a quest mark, a heart, a zzz. Empty for none. */
  mark?: '' | 'quest' | 'talk' | 'heart' | 'alert' | 'sleep';
}

export interface Player {
  pos: Vec3;
  facing: number;
  onGround: boolean;
  inWater: boolean;
  /** True while a panel or a conversation has the player's attention. Movement and actions pause. */
  busy: boolean;
}

export interface Clock {
  /** Days since the game began, starting at 1. */
  day: number;
  /** 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
  timeOfDay: number;
  /** Seconds of game time since the game began. */
  seconds: number;
}

// ---------------------------------------------------------------------------------------- events

/** Every event the game's systems send. The key is the event's name, the value is what it carries. */
/** A box of whole blocks, max exclusive. */
export interface TreeBox { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

export interface GameEvents {
  // world and movement, also heard by sound and effects
  footstep: { surface: Surface; at: Vec3 };
  jump: { at: Vec3 };
  land: { surface: Surface; at: Vec3 };
  'block.placed': { x: number; y: number; z: number; id: number; by: 'player' | 'world' };
  'block.broken': { x: number; y: number; z: number; id: number; by: 'player' | 'world' };
  /** A whole tree came down. x, y, z is its lowest log; the box is the space it stood in, max exclusive. */
  'tree.felled': { x: number; y: number; z: number; id: number; logs: number; leaves: number; box: TreeBox };
  // items
  'item.gained': { id: ItemId; count: number; at?: Vec3 };
  'item.lost': { id: ItemId; count: number };
  'inventory.changed': Record<string, never>;
  'item.crafted': { id: ItemId; count: number; station: string };
  // farming
  'soil.tilled': { x: number; y: number; z: number };
  'crop.planted': { x: number; y: number; z: number; crop: string };
  'crop.watered': { x: number; y: number; z: number };
  'crop.grew': { x: number; y: number; z: number; crop: string; stage: number };
  'crop.harvested': { x: number; y: number; z: number; crop: string };
  // living things
  'fact.learned': { page: string; column: 'needs' | 'gives'; fact: string };
  'page.completed': { page: string };
  'creature.gave': { kind: string; item: ItemId; at: Vec3 };
  'pet.fed': { pet: string; trust: number };
  'pet.startled': { pet: string };
  'pet.bonded': { pet: string };
  // people and story
  /** `npc` is empty for a conversation with nobody in the world. */
  'talk.started': { npc: NpcId | ''; conversation: string };
  'talk.ended': { npc: NpcId | ''; conversation: string };
  'quest.started': { quest: QuestId };
  'quest.step': { quest: QuestId; step: string };
  'quest.completed': { quest: QuestId };
  'flag.changed': { flag: string; value: FlagValue };
  // time
  'day.started': { day: number };
  'night.started': { day: number };
  /** The player slept to the next morning. `skipped` is the seconds of game time the night skipped, for systems that catch up. */
  slept: { day: number; skipped: number };
  'placeable.placed': { kind: string; x: number; y: number; z: number };
  // building
  /** Build mode went on or off. */
  'build.mode': { active: boolean };
  /** A stroke was applied, or the last one was undone. `count` is the cells that changed. `build.last()` lists them. */
  'build.applied': { kind: StrokeKind; count: number; undone: boolean };
  /** A sprinkler wet the soil around it. x, y, z is its own cell; `reach` is how many blocks it wets each way. */
  'sprinkler.ran': { x: number; y: number; z: number; reach: number };
  // interface
  toast: { text: string; icon?: string };
  hint: { id: string; text: string };
  'ui.sound': { sound: 'click' | 'open' | 'close' };
  /** Asks the interface to open a panel: `make` from a workbench, `bag`, `almanac` (detail is a page id), `quests`. */
  'ui.open': { panel: string; detail?: string };
  'act.ended': { act: number };
  /** Scene n of chapter 22 played to its end, as talk, staged or film. Its flag `scene.<n>` is set first. */
  'scene.played': { scene: SceneNumber };
}

export type EventName = keyof GameEvents;

export interface Events {
  emit<K extends EventName>(name: K, data: GameEvents[K]): void;
  /** Returns a function that stops listening. */
  on<K extends EventName>(name: K, listener: (data: GameEvents[K]) => void): () => void;
  /** Hears every event. For the quest system, sound, effects and tests. */
  onAny(listener: (name: EventName, data: GameEvents[EventName]) => void): () => void;
}

export type FlagValue = boolean | number | string;

/** Named facts about this playthrough. Dialogue conditions and quest steps read them. */
export interface Flags {
  get(flag: string): FlagValue | undefined;
  set(flag: string, value: FlagValue): void;
  is(flag: string): boolean;
  /** Adds to a number flag, starting from 0. Returns the new value. */
  add(flag: string, amount: number): number;
}

// ---------------------------------------------------------------------------------------- the game

export interface SimSystem {
  /** Called 20 times a second with dt = 0.05, in install order. */
  step?(dt: number): void;
  /** Plain data that JSON can hold. */
  save?(): unknown;
  load?(data: unknown): void;
}

export interface Game {
  readonly world: World;
  readonly events: Events;
  readonly flags: Flags;
  readonly player: Player;
  readonly clock: Clock;
  readonly ambient: Ambient;
  /** Every actor to draw, by id. */
  readonly actors: Map<string, Actor>;
  readonly systems: Systems;
  /** A repeatable random number from 0 to 1. Never use Math.random in a system. */
  random(): number;
}

/** Filled in by each system's install(). A system may read another only after that one is installed. */
export interface Systems {
  trees: import('./trees/index.sim.ts').TreesApi;
  items: ItemsApi;
  inventory: InventoryApi;
  actions: ActionsApi;
  interact: InteractApi;
  placeables: PlaceablesApi;
  crafting: CraftingApi;
  crops: CropsApi;
  build: BuildApi;
  time: TimeApi;
  creatures: CreaturesApi;
  almanac: AlmanacApi;
  pets: PetsApi;
  nav: NavApi;
  people: PeopleApi;
  talk: TalkApi;
  quests: QuestsApi;
  region: RegionApi;
  hall: HallApi;
}

// ---------------------------------------------------------------------------------------- items

export type ToolKind = 'axe' | 'pickaxe' | 'shovel' | 'hoe' | 'can' | 'hammer';

export interface ItemDef {
  id: ItemId;
  name: string;
  /** An icon name from the manifest. */
  icon: string;
  /** How many fit in one slot. */
  stack: number;
  description: string;
  /** Set when using the item places a block. */
  block?: number;
  /** Set when using the item places a station or a piece of furniture. */
  placeable?: string;
  tool?: { kind: ToolKind; tier: number };
  /** Set when the item is a seed. The value is a crop id. */
  seed?: string;
  /** Set when a pet will eat it. */
  treat?: boolean;
  food?: { stamina: number };
}

export interface ItemsApi {
  get(id: ItemId): ItemDef;
  all(): readonly ItemDef[];
}

export interface InventoryApi {
  /** 36 slots. The first 9 are the quick slots. */
  readonly slots: readonly (Stack | null)[];
  /** The selected quick slot, 0 to 8. */
  selected: number;
  held(): Stack | null;
  /** Returns how many did not fit. `at` is where in the world it came from, and `item.gained` carries it. */
  add(id: ItemId, count: number, at?: Vec3): number;
  /** Removes only if all of them are there. */
  remove(id: ItemId, count: number): boolean;
  count(id: ItemId): number;
  /**
   * Moves the stack in `from` to `to`: onto the same item it merges up to the stack size, onto another it swaps.
   * With `count`, only that many go, onto an empty slot or the same item. Nothing moves when they would have to swap.
   */
  move(from: number, to: number, count?: number): void;
}

/** What the player points at when they click. */
export interface UseContext {
  /** The block under the pointer within reach, or null. */
  hit: RayHit | null;
  held: Stack | null;
  /** `primary` is the left button: break, gather, hit. `secondary` is the right button: place, use. */
  button: 'primary' | 'secondary';
}

export interface ActionsApi {
  /**
   * The player clicked. Handlers run in the order they were added until one returns true.
   * Breaking and placing blocks is the last handler, so crops, placeables and pets get the click first.
   */
  use(context: UseContext): boolean;
  addHandler(handler: (context: UseContext) => boolean): void;
  /**
   * The player is holding the primary button on a block. Call it every step while they do.
   * Breaking takes time, so this fills a meter and breaks the block when it is full. Returns true when it broke.
   */
  hold(context: UseContext, dt: number): boolean;
  /**
   * The block being broken right now and how far along it is, 0 to 1, or null. When it is a tree being
   * felled, `tree` is the box the whole tree stands in, and x, y, z is its lowest log.
   */
  breaking(): { x: number; y: number; z: number; progress: number; tree?: TreeBox | null } | null;
  /** How far the player reaches, in blocks. */
  readonly reach: number;
}

export interface Interactable {
  id: string;
  pos(): Vec3;
  /** Within this many blocks the prompt shows. */
  radius: number;
  /** The words after "E:", such as "Talk to Tamsin". Null hides it. */
  prompt(): string | null;
  act(): void;
}

export interface InteractApi {
  add(target: Interactable): void;
  remove(id: string): void;
  /** The closest one in range with a prompt, or null. */
  nearest(): Interactable | null;
  /** Runs the nearest one. Returns false when there is none. */
  act(): boolean;
}

export interface PlaceableDef {
  kind: string;
  name: string;
  /** A prop kind from src/content/props.ts that draws it. */
  prop: string;
  /** Size in blocks along x, y and z. */
  size: [number, number, number];
  /** The words after "E:", or null when it does nothing. */
  prompt: string | null;
  /** A station name that crafting recipes ask for, or `bed`, `chest`. */
  station?: string;
  /** Light it gives off, 0 to 15. */
  light?: number;
  /** It joins the same kind beside it into one run, as a fence does. In build mode it is laid in a line. */
  joins?: boolean;
  /** In build mode it turns its back to a wall beside it, as a chest does. */
  backs?: boolean;
  /** It keeps tilled soil wet this many blocks each way from its own cell. */
  waters?: number;
}

export interface Placed {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  quarterTurns: number;
}

export interface PlaceablesApi {
  defs(): readonly PlaceableDef[];
  all(): readonly Placed[];
  /** Places one with its corner at this block. Returns null when the space is taken. */
  place(kind: string, x: number, y: number, z: number, quarterTurns: number): Placed | null;
  remove(id: string): void;
  at(x: number, y: number, z: number): Placed | null;
  /** True when a station of this name stands within `radius` blocks of the point. */
  near(station: string, at: Vec3, radius: number): boolean;
  /**
   * Hears every use of a placed thing, by "E" or by the secondary button. The interface opens its panel here.
   * A workbench and a chest show their prompt only while somebody listens. Returns a function that stops listening.
   * It is optional so that a fake without it still fits. The real system always has it.
   */
  onUse?(listener: (placed: Placed) => void): () => void;
}

export interface Recipe {
  id: string;
  makes: Stack;
  needs: Stack[];
  /** `hand` needs nothing. Otherwise a station name such as `workbench`. */
  station: string;
}

export interface CraftingApi {
  recipes(): readonly Recipe[];
  /** Recipes the player could make at the stations within reach, whether or not they have the materials. */
  available(): readonly Recipe[];
  canMake(id: string): boolean;
  make(id: string): boolean;
}

// ---------------------------------------------------------------------------------------- farming and time

export interface CropDef {
  id: string;
  name: string;
  seed: ItemId;
  /** Stage 0 is just planted. The last stage is ripe. */
  stages: number;
  /** Seconds of game time in wet soil to gain one stage. */
  secondsPerStage: number;
  gives: Stack[];
}

export interface CropState {
  crop: string;
  stage: number;
  /** Seconds of water left in the soil. */
  wet: number;
  ripe: boolean;
}

export interface CropsApi {
  defs(): readonly CropDef[];
  /** Turns grass or dirt into tilled soil. The coordinates are the soil block. */
  till(x: number, y: number, z: number): boolean;
  plant(x: number, y: number, z: number, seed: ItemId): boolean;
  water(x: number, y: number, z: number): boolean;
  harvest(x: number, y: number, z: number): boolean;
  /** The crop growing on this soil block, or null. */
  at(x: number, y: number, z: number): CropState | null;
  /** Every crop, for drawing. Coordinates are the soil block. */
  all(): readonly { x: number; y: number; z: number; state: CropState }[];

  // ---- added for build mode. Each is optional so that a fake without it still fits. The real system always has them.
  /** Wets this one soil block and sends nothing. False when it is not tilled soil. */
  wet?(x: number, y: number, z: number): boolean;
  /** Pulls the crop out of this soil block and puts its seed back in the bag. False when nothing grows there, or the seed has no room. */
  pull?(x: number, y: number, z: number): boolean;
  /** Every soil block that is wet or planted, with the seconds of water it has left. The same array and objects on every call. */
  soil?(): readonly { readonly x: number; readonly y: number; readonly z: number; readonly wet: number }[];
}

// ---------------------------------------------------------------------------------------- building

/** What a stroke does to each cell: nothing, till it, plant a seed, wet it, set a block on it, stand a placeable on it. */
export type StrokeKind = 'none' | 'till' | 'plant' | 'water' | 'block' | 'place';
/** Which cells a stroke covers between where it was pressed and where the pointer is: a filled rectangle, a straight line, or the one cell under the pointer. */
export type StrokeShape = 'area' | 'line' | 'one';

/** What the held item does in build mode. */
export interface BuildTool {
  kind: StrokeKind;
  shape: StrokeShape;
  /** The held item, or null with an empty hand. */
  item: ItemId | null;
  /** True when every cell it changes takes one of the item from the bag. */
  costs: boolean;
  /** The block it sets, for `block`. */
  block: number;
  /** The placeable it stands, for `place`. */
  placeable: PlaceableDef | null;
}

/**
 * What a stroke would do to one cell.
 * `ok` it changes. `short` it would, but the bag runs out before it. `skip` there is nothing to do: tilled already,
 * planted already. `far` out of reach. `town` the town's land. `ground` no level ground at the stroke's height.
 * `wrong` the wrong kind of ground: stone under a hoe, grass under a seed. `blocked` something is in the way.
 */
export type CellVerdict = 'ok' | 'short' | 'skip' | 'far' | 'town' | 'ground' | 'wrong' | 'blocked';

export interface PlanCell {
  x: number;
  z: number;
  verdict: CellVerdict;
}

/** What a stroke would do if the button came up now. The same object and the same cells on every call: copy what you keep. */
export interface BuildPlan {
  tool: BuildTool;
  /** The height of the ground blocks the stroke works on. A block or a placeable goes one above. */
  y: number;
  /** True while the button is down. False for the plan under a pointer that only hovers. */
  dragging: boolean;
  /** The cells, nearest the press first. */
  cells: readonly PlanCell[];
  /** Cells with each verdict. */
  ok: number;
  short: number;
  skip: number;
  refused: number;
  /** How many of the item the bag holds, when the tool costs. */
  have: number;
  /** The quarter turns a placeable would stand with, as in `Placed.quarterTurns`. */
  turns: number;
  /** The corner the placeable would stand at, which is not the pointed cell for a turned thing longer than a block. */
  ax: number;
  az: number;
  /** A placed thing under the pointer that a press would take back into the bag, or null. */
  lift: Placed | null;
}

/** One cell a stroke changed, as `build.last()` lists it. `y` is the cell that changed: the soil, or the block or placeable above it. */
export interface BuildChange {
  kind: StrokeKind;
  x: number;
  y: number;
  z: number;
}

/** Where the pointer is: the block it hit and the face, as a ray cast gives it. */
export interface BuildPoint {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
}

export interface BuildApi {
  /** True while the player is in build mode. */
  readonly active: boolean;
  /** Turns build mode on or off. Turning it off cancels a stroke in progress. It stays off while the player is busy. */
  setActive(on: boolean): void;
  /** Tells where the pointer is, or `null` when it is on nothing. During a stroke it moves the stroke's far end. */
  point(at: BuildPoint | null): void;
  /**
   * The button went down. On a placed thing it takes that back into the bag and into the hand. Elsewhere it
   * starts a stroke with the held item at the pointed cell. False when it did neither.
   */
  press(): boolean;
  /** The button came up: the stroke is judged again against the world as it is now, and applied. Returns the cells it changed, or -1 when there was no stroke. */
  release(): number;
  /** Drops the stroke in progress and changes nothing. False when there was none. */
  cancel(): boolean;
  /** True from a press that started a stroke until its release or cancel. */
  readonly dragging: boolean;
  /** What a release would do now, or what a press and release on the pointed cell would do. Null outside build mode or with the pointer on nothing. */
  plan(): BuildPlan | null;
  /** Turns the held placeable a quarter turn: 1 clockwise seen from above, -1 the other way. From then it keeps that turn until the held item changes. */
  turn(direction: 1 | -1): void;
  /** Takes back the last stroke: every cell that is still as the stroke left it goes back, and its item returns to the bag. False when there is nothing to take back. */
  undo(): boolean;
  readonly canUndo: boolean;
  /** The cells the last stroke changed, or the last undo put back. The same array until the next one. */
  last(): readonly BuildChange[];
  /** True while a stroke or an undo is changing cells, so a listener can tell a burst of events from single ones. */
  readonly applying: boolean;
}

export interface TimeApi {
  /** Seconds of real time one game day lasts. */
  readonly dayLength: number;
  /** True when the player may sleep: it is evening or night, and a bed is in reach with a roof over it or over the player. */
  canSleep(): boolean;
  /** Skips to the next morning. Crops, creatures and people catch up. */
  sleep(): void;
  /**
   * Forces the weather for a scripted moment, or `null` to let it run. The weather comes in as a front, over
   * most of a minute. `now` settles a kind at once with no front, for a moment that skips time.
   */
  setWeather(kind: 'clear' | 'breezy' | 'overcast' | 'rain' | 'storm' | 'fog' | null, now?: boolean): void;
  /** Jumps the clock. For a scripted moment and for tests. */
  setTimeOfDay(timeOfDay: number): void;
  /**
   * Hears each clap of thunder in a storm, with the place the lightning struck. The clap comes later the
   * farther the strike. Returns a function that stops listening.
   * It is optional so that a fake without it still fits. The real system always has it.
   */
  onThunder?(listener: (at: Vec3) => void): () => void;
  /**
   * Asks before the player sleeps. `sleep()` calls each guard, and the first that returns words keeps the
   * player awake: the words go out as a toast. For a story moment that will not let the night pass yet.
   * It is optional so that a fake without it still fits. The real system always has it.
   */
  guardSleep?(guard: () => string | null): void;
}

// ---------------------------------------------------------------------------------------- living things

export interface AlmanacFact {
  id: string;
  column: 'needs' | 'gives';
  text: string;
  known: boolean;
}

export interface AlmanacPage {
  id: string;
  title: string;
  /** A sprite or icon name to picture it. */
  picture: string;
  kind: 'creature' | 'pet' | 'crop' | 'person' | 'place';
  facts: AlmanacFact[];
  complete: boolean;
  seen: boolean;
}

export interface AlmanacApi {
  pages(): readonly AlmanacPage[];
  page(id: string): AlmanacPage | undefined;
  /** Marks a fact as seen. Sends `fact.learned`, and `page.completed` when it was the last one. */
  learn(page: string, fact: string): void;
  /** Marks a page as met, so it shows in the book with its facts still hidden. */
  meet(page: string): void;
}

export interface CreatureState {
  id: string;
  kind: string;
  pos: Vec3;
  /** What it is doing, in one word: `idle`, `wander`, `eat`, `flee`, `give`, `sleep`. */
  doing: string;
}

export interface CreaturesApi {
  all(): readonly CreatureState[];
  /** How many of this kind are within `radius` of the point. */
  countNear(kind: string, at: Vec3, radius: number): number;
}

export interface PetState {
  id: string;
  kind: string;
  name: string;
  pos: Vec3;
  /** 0 to 3. At 3 it bonds. */
  trust: number;
  bonded: boolean;
  /** True while it backs away after being startled. */
  startled: boolean;
}

export interface PetsApi {
  all(): readonly PetState[];
  /** The pet that follows the player, or null. */
  companion(): PetState | null;
  /** Offers the held treat to the nearest wild pet in reach. */
  feed(petId: string): boolean;
  /**
   * Bonds a wild pet now, without feeding it: full trust, its flag, `pet.bonded`, and it comes to the player's
   * side. For `quests.skipTo` and the debug door. False when there is no such pet or it has bonded already.
   * It is optional so that a fake without it still fits. The real system always has it.
   */
  bond?(petId: string): boolean;
}

export interface NavApi {
  /** A walkable route of block centers from one point to another, or null when there is none within `limit` steps. */
  path(from: Vec3, to: Vec3, limit?: number): Vec3[] | null;
  /** True when something can stand at this block: solid below, two blocks of air. */
  standable(x: number, y: number, z: number): boolean;
  /**
   * Like `path`, but when the goal cannot be reached it returns the route to the closest point it found.
   * Null only when there is nowhere to stand at `from`.
   */
  toward(from: Vec3, to: Vec3, limit?: number): Vec3[] | null;
  /** The route between two named places of the region, kept until a block on it changes. Do not change the array. */
  route(from: string, to: string): readonly Vec3[] | null;
  /**
   * The center of the nearest block to stand on within `radius` blocks of a point, or null.
   * `skip` rejects blocks, for example the ones somebody else stands on.
   */
  near(at: Vec3, radius: number, skip?: (x: number, z: number) => boolean): Vec3 | null;
}

export interface NpcState {
  id: NpcId;
  name: string;
  /** A sprite and a portrait name from the manifest. */
  sprite: string;
  portrait: string;
  /** A voice id for the sound engine. */
  voice: string;
  pos: Vec3;
  /** Where the routine has them now, as a place name from the region. */
  place: string;
  /** 0 to 5. */
  friendship: number;
}

export interface PeopleApi {
  all(): readonly NpcState[];
  get(id: NpcId): NpcState | undefined;
  /**
   * Sends someone to a named place now, ahead of their routine. For story moments. `offset` is blocks east
   * and south of the place to stand at, so a crowd sent to one place does not stand on one spot.
   */
  send(id: NpcId, place: string, offset?: { x: number; z: number }): void;
  /** Holds someone in place and out of their routine until released. */
  hold(id: NpcId, held: boolean): void;
  befriend(id: NpcId, amount: number): void;
  /** The symbol floating over someone's head. The quest system sets it. */
  setMark(id: NpcId, mark: Actor['mark']): void;
}

/** The line on screen right now. The dialogue box draws exactly this. */
export interface TalkLine {
  npc: NpcId | null;
  /** The speaker's name, portrait and voice id. Empty strings for the narrator. */
  name: string;
  /** The portrait with the line's face, `hobb-glad`, and the plain one to fall back on, `hobb`. */
  portrait: string;
  face: string;
  voice: string;
  text: string;
  /** Up to three choices. Empty when the line just continues. */
  choices: string[];
  /** How the conversation is shown: talk in the box, staged with the camera on the people, or a film. */
  kind: 'talk' | 'staged' | 'film';
  /** The scene of chapter 22 it is part of, or 0. */
  scene: number;
}

/** A line that was said, for the log of the conversation so far. */
export interface TalkLogEntry {
  name: string;
  text: string;
  /** The choice the player took on this line, if it had choices. */
  chose?: string;
}

export interface TalkApi {
  /** Picks the right conversation for this person now and starts it. */
  talkTo(npc: NpcId): void;
  /** Starts a named conversation, with or without a speaker in the world. */
  start(conversation: string, npc?: NpcId): void;
  readonly active: boolean;
  /** The line showing now, or null when nobody is talking. */
  current(): TalkLine | null;
  /** Moves to the next line. Ends the conversation after the last one. */
  advance(): void;
  /** Picks a choice by its index and moves on. */
  choose(index: number): void;
  /** Ends a film at once, with everything it does done: each line's effects, the first choice where one is asked. */
  skip(): void;
  /** What has been said, oldest first: this conversation and the ones before it, up to the last 80 lines. */
  log(): readonly TalkLogEntry[];
}

export interface QuestStepView {
  id: string;
  text: string;
  /** One more line for the quest log, when the step text alone does not say how. */
  hint?: string;
  done: boolean;
  /** Progress such as 7 of 20, when the step counts something. */
  have?: number;
  need?: number;
  /** Where to point the waypoint for this step, when it has a place. */
  at?: Vec3;
}

export interface QuestView {
  id: QuestId;
  title: string;
  summary: string;
  state: 'hidden' | 'active' | 'done';
  /** The chapter of act 1 it is in, 1 to 5. */
  chapter?: number;
  steps: QuestStepView[];
}

export interface QuestsApi {
  all(): readonly QuestView[];
  /** The quest the tracker shows: the one the player picked while it is open, else the first open one. */
  tracked(): QuestView | null;
  /** Follows this open quest in the tracker, when more than one is open. */
  track?(id: QuestId): void;
  start(id: QuestId): void;
  /** For tests and the debug panel: finishes steps up to this quest's start. */
  skipTo(id: QuestId): void;
}

export interface Place {
  name: string;
  /** A block to stand on. */
  at: Vec3;
  /** A short label for the map, or empty to keep it off the map. */
  label: string;
}

/** How alive the player's land is: the number the Heartstone shows, and what it is made of. */
export interface Heart {
  /** 0 to 6, by chapter 30's ladder. */
  level: number;
  /** Each kind of living thing on the land: how many there are, and what one is worth. */
  parts: readonly { label: string; count: number; worth: number }[];
}

/** Ilara's Hall: the Shut Door, the first night, the Mark, the Custodian and the Heartstone. */
export interface HallApi {
  /** The Heartstone. The settlement owns the number (`SettlementApi.heartstone`); the Hall shows it. */
  heart(): Heart;
  /** Where the Blighted fox of the first night is, or null when it is not about. */
  fox(): Vec3 | null;
}

export interface RegionApi {
  /** Where a new game starts. */
  spawn(): Vec3;
  places(): readonly Place[];
  place(name: string): Place;
  /** The corner and size of the player's grant. Blocks placed inside it stay. */
  grant(): { x: number; z: number; width: number; depth: number };
  /** True inside a town or another place the player may not change. */
  isProtected(x: number, y: number, z: number): boolean;

  // ---- added by the region system. Each is optional so that a fake without it still fits. The real system always has them.
  /** Every berry bush, the same objects on every call: `ripe` changes when one is picked and when it regrows. */
  berryBushes?(): readonly BerryBush[];
  /** The props of the stamped buildings (doors, windows, signs, furniture) and of the town, for a view to draw. */
  props?(): readonly RegionProp[];
  /** How the wild props are scattered over the region. */
  scatter?(): RegionScatter;
  /** The middle of the town and how far it reaches. The sound plays the town arrangement inside it. */
  townCenter?(): { x: number; z: number; radius: number };
  /** The way a new hero faces at `spawn()`, in radians like `Player.facing`. */
  spawnFacing?(): number;
}

// ---------------------------------------------------------------------------------------- the region's own data

export interface BerryBush {
  /** `bush:0` and up. It is also the id of its target in the interact system. */
  id: string;
  /** The middle of its block, at the height of the ground. */
  x: number;
  y: number;
  z: number;
  /** True while it has berries to pick. */
  ripe: boolean;
}

/** A prop the region wants drawn. The fields from `kind` to `scale` are the arguments of the props feature's `place`. */
export interface RegionProp {
  /** A prop kind from src/content/props.ts. */
  kind: string;
  variant: number;
  /** Meters. `y` is the height of its foot. */
  x: number;
  y: number;
  z: number;
  /** Radians around y. At 0 its front faces south. A building's turn is already in it. */
  rotation: number;
  scale: number;
  /** The quarter turns of the building it belongs to, counter-clockwise seen from above. 0 for a prop that stands alone. */
  quarterTurns: number;
  /** The id of its building in the region plan, or an empty string. */
  building: string;
}

export interface RegionScatter {
  /** 1 is the usual amount of everything. */
  density: number;
  /**
   * True where nothing may be scattered: the grant, the path, the town, the dead garden's beds, and the
   * spots where the region put its own trees, bushes and rocks. Around those sites it is also true for
   * the one column in nine where the scatter rules would stand a tree, so the land there keeps its
   * grass and grows no tree between the camera and the hero.
   */
  blocked(x: number, z: number): boolean;
  /**
   * How much forest a place is, 0 for open meadow to 1 for deep forest. It follows the woods the terrain
   * grew as blocks, and is 0 around the grant, the dead garden, the town and the path, so they stay in view.
   */
  forest(x: number, z: number): number;
}

// ======================================================================================== act 1: fights
// The fights builder's section. The world's encounters: which of the twelve fights is armed, running and done,
// and the hero's numbers. The 60 Hz fight itself is the lab's code in src/game/fight, run by a view.

export interface GameEvents {
  'fight.started': { fight: FightNumber };
  /** `won`: calmed, shut down or freed. `fell`: the hero fainted and woke at the stage's wake point. `left`: walked out of the circle. */
  'fight.ended': { fight: FightNumber; result: 'won' | 'fell' | 'left' };
  /** The Mark was held out to a beast deeper than the Heartstone. */
  'fight.denied': { fight: FightNumber; depth: number; heartstone: number };
}

export interface Systems {
  fights: FightsApi;
}

/**
 * The hero's health and stamina outside the lab. The fights system owns them and works them out from the
 * gear record's armour tier (`BenchApi.gear().armor`), today's meal (the flag `meal.day`) and the shrine
 * picks (the flags `shrine.<id>` = `heart` or `stamina`). A heart is a step of health.
 */
export interface HeroStats {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
}

export interface FightsApi {
  hero(): HeroStats;
  /** The fight running now, or null. A night visitor at the fence is a fight with no number: see `running()`. */
  active(): FightNumber | null;

  // ---- added by the fights builder. Optional, so a fake without them still fits; the real system has them all.
  /** Each of the twelve fights: whether its quest step has armed it, and how it came out. */
  states?(): readonly FightState[];
  /** The fight running now, with its rules, for the view that draws it and steps it. Null when none is. */
  running?(): RunningFight | null;
  /** A view that steps the running fight itself, 60 times a second with the hero's body, says so here. Without one the system steps it. */
  drive?(byView: boolean): void;
  /** Starts fight n now, where the hero stands, whether or not its step is open: the debug door and the tests. False for fight 1, the Hall's. */
  begin?(n: FightNumber): boolean;
  /**
   * Starts a vault's keeper (fights 7, 9 and 10) in the room the ruins built for it, with its step open or not.
   * Nothing else starts a keeper in the world; `begin(n)` fights it in its test room where the hero stands.
   */
  startKeeper?(n: 7 | 9 | 10, room: import('./fight/keepers.sim.ts').KeeperRoom): boolean;
  /** Starts the Verdant Stag (fight 12) in its hall, round this point: the ruins call it under the Rootworks. */
  startStag?(x: number, z: number): boolean;
  /** Walks away from the fight running now: it ends as left, and arms again once the hero is well away. */
  leave?(): void;
  /** The companions the hero has (Dax, Wren, the fox, the Stag's young), the one picked to come next, and picking one. */
  companions?(): readonly string[];
  companion?(): string | null;
  pick?(kind: string): boolean;
  /** The rule-made player fights the running fight: for the sim's scenarios and the debug door. Null hands it back. */
  autoplay?(level: 'perfect' | 'middle' | 'clumsy' | null): void;
  /** Tonight's visitor at the fence, or null. */
  visitor?(): { kind: string; depth: number; x: number; z: number } | null;
}

/** One of the twelve fights as the world has it. */
export interface FightState {
  n: FightNumber;
  /** Its quest step is open: it starts when the hero comes near its place. */
  armed: boolean;
  won: boolean;
  denied: boolean;
  /** Where it is fought. */
  at: { x: number; z: number };
}

/** A fight running in the world. */
export interface RunningFight {
  /** Its number, or 0 for a night visitor. */
  readonly n: FightNumber | 0;
  readonly fight: import('./fight/fight.sim.ts').Fight;
  readonly stage: import('./fight/arena.sim.ts').Stage;
  /** A vault's keeper, or the Stag's hall, when it is one of those. */
  readonly keeper: import('./fight/keepers.sim.ts').Keeper | null;
  readonly hall: import('./fight/stag-hall.sim.ts').Hall | null;
  /** The fight's one line: what it teaches. */
  readonly line: string;
  /** Seconds since it ended, or -1 while it goes on. */
  readonly over: number;
  /** One step of the rules: the rule-made player when it plays, the fight, the keeper or the hall, and what the world does with what happened. */
  step(dt: number): void;
}

// ======================================================================================== act 1: settlement
// The settlement builder's section. Who lives on the player's land, their needs, jobs and wishes, the dinner
// table, the settlement's step, and the Heartstone, which `HallApi.heart()` passes on.

export interface GameEvents {
  'settler.arrived': { who: PersonId };
  'settlement.step': { step: SettlementStep };
  'wish.granted': { who: PersonId };
  /** Dinner: two settlers ask, the player grants one. */
  'dinner.asked': { asks: readonly [PersonId, PersonId] };
}

export interface GameEvents {
  /** "E" on a settler or on their home: the interface shows their card. */
  'settler.opened': { who: PersonId };
  /** "E" on the Heartstone, or a click on its gauge: the interface shows what the next step asks for. */
  'heartstone.opened': Record<string, never>;
  /** A dinner ask was granted. `other` says `line`, once. */
  'dinner.granted': { who: PersonId; other: PersonId; line?: string };
}

export interface Systems {
  settlement: SettlementApi;
}

/** The three needs a settler shows on their door. */
export type NeedId = 'bed' | 'meal' | 'lamp';

export interface JobView {
  id: string;
  name: string;
  /** What the job does, in a line. */
  text: string;
  /** What to walk them to, as "the kitchen". */
  room: string;
  /** False while nothing of that kind stands on the land. */
  ready: boolean;
}

/** A building of the settlement that someone sleeps in, or works in. */
export interface HomeView {
  /** The placed thing's id. */
  id: string;
  kind: string;
  name: string;
  /** The middle of its roof, for a tag over it, and the spot before its door. */
  top: Vec3;
  door: Vec3;
  /** Who sleeps in it. */
  residents: readonly PersonId[];
  /** A lamp stands by it. */
  lit: boolean;
}

export interface SettlerView {
  who: PersonId;
  name: string;
  needs: Readonly<Record<NeedId, boolean>>;
  /** Every need met and nothing stopping their work: they give a heart each morning. */
  glad: boolean;
  wish: { text: string; granted: boolean };
  /** The two jobs to choose from, or none for someone who came to do one thing. */
  jobs: readonly JobView[];
  job: string | null;
  /** The job they are being walked to, or null. */
  leading: string | null;
  /** The home they sleep in, or null for a bed under a roof somewhere else, or no bed. */
  home: HomeView | null;
  /** Hearts they have given. */
  hearts: number;
  /** What you can tell from the road once they work. */
  road: string;
  /** Why they are not glad, or something else worth a line, or empty. */
  note: string;
}

export interface DinnerView {
  day: number;
  asks: readonly { who: PersonId; text: string }[];
  /** Who was granted, once the player picked. */
  granted: PersonId | null;
}

/** What the next level of the Heartstone asks for. */
export interface HeartNextView {
  level: number;
  /** What it puts in reach: "The lynx". */
  reach: string;
  parts: readonly { label: string; have: number; need: number }[];
  /** The Order's pump is running, so the stone reads one step lower. */
  pump: boolean;
}

export interface SettlementApi {
  /** The Heartstone, 0 to 6, and what it is made of. Also written to the flag `heartstone`. */
  heartstone(): Heart;
  step(): SettlementStep;
  /** Who lives on the player's land. */
  settlers(): readonly PersonId[];
  /** One settler's needs, wish and work, or null for someone who does not live here. */
  settler(who: PersonId): SettlerView | null;
  /** The homes that someone sleeps in. The same array on every call until the land changes. */
  homes(): readonly HomeView[];
  /** What the next level of the Heartstone asks for, or null at 6. */
  next(): HeartNextView | null;
  /**
   * Starts walking a settler to a job's room: they follow the hero, and the job is theirs once both stand by the
   * room. Returns why not (no such room yet), or null when they are on their way.
   */
  lead(who: PersonId, job: string): string | null;
  /** Tonight's dinner once the hero sat down to it, or null. */
  dinner(): DinnerView | null;
  /** Grants one of tonight's asks: ten hearts. Returns the other's one line, or null when it cannot. */
  grant(who: PersonId): string | null;
  /** Food into the kitchen's larder, from a buyer or a delivery. Returns how many it took. */
  stock(item: ItemId, count: number): number;
  /** Meals in the larder, travel meals waiting at the smokehouse. */
  larder(): { meals: number; travel: number };
  /**
   * Where a settler stands now by their routine, or null. The people system walks them there. With `seat` they sit
   * there, facing that way (0 north, clockwise seen from above): a seat at the dinner table.
   */
  spot(who: PersonId): { key: string; place: string; at: Vec3; seat?: number } | null;
}

/** The people system walks a settler behind the hero while the settlement leads them to a room. */
export interface PeopleApi {
  lead?(id: NpcId, on: boolean): void;
}

// ======================================================================================== act 1: farms
// The farms builder's section. Every farm of chapter 30: its mode, whether it is living, its rate and what is
// wrong with it.

export interface GameEvents {
  'farm.built': { farm: FarmId };
  'farm.mode': { farm: FarmId; mode: FarmMode };
  /** A farm made goods. `at` is where they dropped. */
  'good.made': { farm: FarmId; item: ItemId; count: number; at: Vec3 };
}

export interface Systems {
  farms: FarmsApi;
}

export interface FarmView {
  id: FarmId;
  built: boolean;
  mode: FarmMode;
  /** On Give and running, so it counts for the Heartstone. */
  living: boolean;
  /** Goods a day (20 minutes), now and at best. */
  rate: number;
  best: number;
  /** The one line on the rate tag that says what is wrong, or empty. */
  symptom: string;

  // ---- the farm panel and the rate tag (the farms builder's view)
  /** The tag's words, such as `6 springs a day`, and the line under them. Empty while the farm is not on the ground. */
  tag: string;
  sub: string;
  /** How to put the symptom right: one press away on the tag, never shown first. */
  fix: string;
  /** Where the tag hangs, or null while nothing of the farm is on the ground. */
  at: Vec3 | null;
  /** What Take would give at once, and the days its creatures stay away after one. 0 when it cannot take. */
  take: number;
  away: number;
}

export interface FarmsApi {
  all(): readonly FarmView[];
  get(id: FarmId): FarmView | undefined;
  /** Give or Take. Take gives its goods at once and sends the creatures away three days. False for a farm that cannot. */
  setMode?(id: FarmId, mode: FarmMode): boolean;
}

// ======================================================================================== act 1: machines
// The farms builder's section too. Shafts, power and the parts on them, ditches, and goods on the move.

export interface GameEvents {
  /** A placed part's state changed. `part` is its `Placed.id`. */
  'machine.state': { part: string; state: MachineState };
}

export interface Systems {
  machines: MachinesApi;
}

export interface PlaceableDef {
  /** Drawn by that system's own view, with its state and its moving piece. The stations view leaves it. */
  drawnBy?: 'machines';
}

export interface CropsApi {
  /**
   * Cuts a ripe crop where it stands and plants its seed again, for a harvester arm. Returns what it gave, which
   * the caller drops on the ground, or null when nothing ripe grows on this soil block.
   */
  cut?(x: number, y: number, z: number): readonly Stack[] | null;
}

export type MachineState = 'working' | 'starved' | 'backed up' | 'off';

/** What a sensor watches the cell in front of it for. The shaft it is on runs while it sees it. */
export type SensorMode = 'creature' | 'good' | 'ripe' | 'dry' | 'light' | 'dark' | 'room';

export interface MachinePart {
  /** The placed thing's id. */
  id: string;
  kind: string;
  state: MachineState;
  /** Power it has, and power it asks for. A wheel's `power` is what it makes. */
  power: number;
  wants: number;
  x: number;
  y: number;
  z: number;
  quarterTurns: number;
  /** How fast its shaft runs, 0 to 1: the power made over the power asked for, at most 1. 0 when switched off. */
  speed: number;
  /** The shaft it is on, as an index into `shafts()`, or -1 when it is on none. */
  shaft: number;
}

/** One shaft: the parts joined to each other, the power its wheels make and what its parts ask for. */
export interface Shaft {
  power: number;
  wants: number;
  speed: number;
  /** False while a lever on it is down or a sensor on it sees nothing. */
  on: boolean;
}

/** A hole the spade dug. It fills when water is beside it, level or higher, and then it is a ditch. */
export interface Hole {
  x: number;
  y: number;
  z: number;
  wet: boolean;
}

/** A good lying on the ground, where a creature left it or a chute dropped it. */
export interface LooseGood {
  id: number;
  item: ItemId;
  count: number;
  x: number;
  y: number;
  z: number;
}

export interface MachinesApi {
  parts(): readonly MachinePart[];
  /** True when any wheel turns: the Heartstone's "a wheel turning". */
  turning(): boolean;

  // ---- what the rest of the farms builder's systems and views use
  part(id: string): MachinePart | undefined;
  shafts(): readonly Shaft[];
  /** How strongly the working sprinklers wet this soil block, 0 to 1: the speed of the best one that reaches it. */
  sprinkled(x: number, y: number, z: number): number;
  holes(): readonly Hole[];
  /** True when the spade dug this block out and it is still open. */
  hole(x: number, y: number, z: number): Hole | undefined;
  loose(): readonly LooseGood[];
  /** Drops goods on the ground at a point. Chutes, chests and the player pick them up. */
  drop(item: ItemId, count: number, at: Vec3): void;
  /** What a collector chest holds, or null when there is no such chest. */
  chest(id: string): readonly Stack[] | null;
  /** Moves what a collector chest holds into the bag, as far as there is room. Returns how many moved. */
  empty(id: string): number;
  /** Items a collector chest holds at most. */
  readonly chestSize: number;
  /** A gearling walked into this wheel: it stops, and its shaft with it, for a while. */
  jam(wheelId: string): void;
  jammed(wheelId: string): boolean;
  lever(id: string): boolean;
  sensor(id: string): SensorMode | null;
  /** A hatch lets the sun in. Open on a running shaft, or as the player left it. */
  hatchOpen(id: string): boolean;
  /** The farms set the state of the builds they run (a post, a clapper, a bee box), so the view shows it. */
  mark(id: string, state: MachineState): void;
  /** The power a wheel standing here would make: 6 where the water drops, 4 on flat water, 0 with none. */
  wheelPower(x: number, y: number, z: number): number;
}

// ======================================================================================== act 1: bench
// The farms builder's section too. The bench's four steps, fittings, the other weapons, and the kit.

export interface GameEvents {
  /** The bench made a weapon at a step with a fitting, or a step of armour. */
  'gear.made': { what: WeaponKind | 'armor'; tier: GearTier; fitting: FittingId | null };
}

export interface Systems {
  bench: BenchApi;
}

/** One thing the bench makes: a weapon at a step with one of the step's two fittings, or a step of armour. */
export type BenchMake = { what: WeaponKind; tier: GearTier; fitting: FittingId } | { what: 'armor'; tier: GearTier };

export interface BenchApi {
  /** The gear record (src/game/content/gear.ts). The fights read it. */
  gear(): Gear;

  // ---- the bench panel and the kit panel (the farms builder's views)
  /** The weapons the hero owns, each at its own step with its own fitting. The first is the one picked on grant day. */
  weapons(): readonly { weapon: WeaponKind; tier: GearTier; fitting: FittingId | null }[];
  /** The goods and found things a make takes, the fitting's good among them. */
  cost(make: BenchMake): readonly Stack[];
  /** Null when it can be made now, or the reason it cannot, in a few words for the panel. */
  why(make: BenchMake): string | null;
  make(make: BenchMake): boolean;
  /** Takes another owned weapon in hand. */
  wield(weapon: WeaponKind): boolean;
  /** Puts a kit thing in one of the three slots, or empties it with null. The thing must be in the bag. */
  equip(slot: 0 | 1 | 2, kit: KitId | null): boolean;
}

// ======================================================================================== act 1: goods
// The goods builder's section. Coin, the buyers, the queen's ledger and the Order's pump.

export interface GameEvents {
  'goods.sold': { buyer: BuyerId; item: ItemId; count: number; coin: number };
  'coin.changed': { coin: number; by: number };
  'ledger.filled': { section: LedgerSection };
  'pump.set': { running: boolean };
  /** A standing order of the ledger was delivered, or a pack order is all in the bag. `times` counts the deliveries. */
  'order.filled': { order: import('./content/goods.ts').OrderId; times: number };
  /** Market day's rush order was posted at dawn, or met. */
  'rush.posted': { item: ItemId; count: number };
  'rush.met': { item: ItemId; count: number };
}

export interface Systems {
  goods: GoodsApi;
}

export interface LedgerView {
  section: LedgerSection;
  /** What the section asks for, and how much of each has been delivered. */
  needs: readonly { item: ItemId; count: number; have: number }[];
  filled: boolean;
}

/** What a buyer in town takes today. */
export interface BuyerView {
  buyer: import('./content/goods.ts').TownBuyer;
  /** Each good it takes: its price, what it has taken today, and today's cap. */
  goods: readonly { item: ItemId; price: number; taken: number; cap: number }[];
  marketDay: boolean;
}

/** A standing order of the ledger, once its four sections are filled. */
export interface OrderView {
  id: import('./content/goods.ts').OrderId;
  /** `have` is what the bag holds now. */
  needs: readonly { item: ItemId; count: number; have: number }[];
  /** For a pack order: kit slots filled, of three. -1 when it asks for no kit. */
  kit: number;
  /** Deliveries made, or 1 for a pack order the bag holds in full. */
  times: number;
  /** It can be delivered now, or for a pack order, the bag holds it all. */
  ready: boolean;
}

/** Market day's rush order: twice a farm's daily rate of one good, by nightfall. */
export interface RushView {
  day: number;
  item: ItemId;
  count: number;
  met: boolean;
  /** Seconds of game time left before nightfall, 0 once it has passed. */
  left: number;
}

/** Something coin buys, as the panels show it. */
export interface ShopView {
  id: import('./content/goods.ts').ShopId;
  coin: number;
  /** Null when it can be bought now, or why not, in a few words. */
  why: string | null;
}

/** The Order's pump: running in the field, or in its crate. */
export interface PumpView {
  running: boolean;
  /** Where it stands, or its crate, on the ground. Null before the blessing offers it. */
  at: Vec3 | null;
  /** How grey the ground round it is, 1 while it runs, falling to 0 over three days once it is out. */
  grey: number;
  /** Where the grey ring is, the spot it last ran at. */
  greyAt: Vec3 | null;
}

export interface GoodsApi {
  coin(): number;
  ledger(): readonly LedgerView[];
  /** True while the Order's pump runs in the player's field. */
  pumpRunning(): boolean;

  // ---- selling
  buyer(id: import('./content/goods.ts').TownBuyer): BuyerView;
  /** Sells up to `count` from the bag. Returns how many the buyer took. */
  sell(id: import('./content/goods.ts').TownBuyer, item: ItemId, count: number): number;
  marketDay(): boolean;
  /** Wheat in the bag that grew while the pump ran: the granary takes it, the ledger does not. */
  pumpWheat(): number;

  // ---- the ledger
  /** The section the player picked to work on, or null before the first pick. */
  picked(): LedgerSection | null;
  pick(section: LedgerSection): void;
  /** Delivers what the bag holds toward a section: clean wheat only. Returns how many went in. */
  deliver(section: LedgerSection): number;
  orders(): readonly OrderView[];
  /** Delivers one standing order. False when the bag is short or it is not open. */
  fill(order: import('./content/goods.ts').OrderId): boolean;
  /** Today's rush order, or null when there is none. */
  rush(): RushView | null;
  /** Delivers the rush order at the market. False when the bag is short, it is met, or night has come. */
  meetRush(): boolean;

  // ---- what coin buys
  shop(): readonly ShopView[];
  /** Buys one. Null when it was bought, or why not. A guide needs `vault`, the vault to walk to. */
  buy(id: import('./content/goods.ts').ShopId, vault?: VaultId): string | null;
  /** Furniture in the player's homes, 1 to 3, and the hearts each use gives. */
  furniture(): { grade: number; hearts: number };

  // ---- the pump
  pump(): PumpView;
  /** Sets the pump running in the field, or pulls it out into its crate. False when nothing changed. */
  setPump(running: boolean): boolean;
}

// ======================================================================================== act 1: ruins
// The ruins builder's section. Small ruins, shrines, memory stones, the vaults, keystones and the Rootworks.

export interface Systems {
  ruins: RuinsApi;
}

export type RuinState = 'unknown' | 'found' | 'sealed' | 'cleared';

export interface RuinsApi {
  /** A small ruin's or a vault's state. */
  state(id: RuinId | VaultId): RuinState;
  /** What a shrine gave, or null while it is dormant. */
  shrine(id: ShrineId): 'heart' | 'stamina' | null;
  /** True once the memory stone's scene has played. */
  remembered(id: MemoryId): boolean;
  keystones(): number;

  // ---- added by the ruins builder. Optional, so a fake without them still fits; the real system has them all.
  /** What the rooms and the Old Gate show now, for the views. */
  view?(): RuinsView;
  /** Restores a shrine with what the player picked from it. False when it is not theirs to restore. */
  restore?(shrine: ShrineId, gift: 'heart' | 'stamina'): boolean;
  /** Takes the hero into a room, at its door: the debug door and the tests. */
  enter?(room: string): void;
}

export interface GameEvents {
  /**
   * The hero went through a door of the ruins: into a room, out of one, or between two. `game.player.pos` is there
   * already; a view moves the hero's body there too and makes the land round it.
   */
  'ruins.moved': { x: number; y: number; z: number; facing: number; room: string | null };
  /** The player put their marked hand on a dormant shrine: the interface asks heart or stamina, and calls `restore`. */
  'shrine.asked': { shrine: ShrineId };
}

/** The rooms as they are now. */
export interface RuinsView {
  /** The room the hero is in, or null. */
  room: string | null;
  /** The Pump House's lever is pulled: the stair is dry, and its sprays run. */
  lever: boolean;
  /** The Lamp Gallery's glass eyes that have seen the hero, 0 to 6. Each lights two lamps. */
  eyes: number;
  /** The Rootworks' three machines rebuilt, by level. */
  machines: readonly boolean[];
  /** The deepest level of the Rootworks the hero has climbed down to, 0 before the first. */
  deepest: number;
  /** The Old Gate stands open. */
  gate: boolean;
  /** The keystone of each vault taken from its dais. */
  taken: Readonly<Record<VaultId, boolean>>;
  /** The Hall's second level is open. */
  below: boolean;
  /** Each memory stone that is still there to be touched (one shown to Calla is ash). */
  stones: readonly MemoryId[];
}

// ======================================================================================== act 1: the opening
// The opening builder's section. The film's end, grant day at Saltgate and the ferry up the Mere (src/game/opening).

export interface GameEvents {
  /** The opening moved on: `saltgate` once the film is over, `ferry` when the ferry pushes off, `landed` at the landing. */
  'opening.stage': { stage: OpeningStage };
  /** Grant day asks something a panel answers: the hero's look at the mirror, or their name on the deed. */
  'opening.ask': { ask: OpeningAsk };
  /** A swing at Dax in the bout. `landed` is false when his crate lid took it. `guard` is what is left of his guard. */
  'opening.swing': { landed: boolean; guard: number };
}

export interface Systems {
  opening: OpeningApi;
}

export type OpeningStage = 'film' | 'saltgate' | 'ferry' | 'landed';
export type OpeningAsk = 'mirror' | 'deed';
/** The four looks of the hero's sheet (`assets-src/concept/people-home/hero.webp`), picked at the mirror. */
export type HeroLook = 'a' | 'b' | 'c' | 'd';

export interface OpeningApi {
  stage(): OpeningStage;
  /** The name written on the deed (empty until then) and the look picked at the mirror. */
  hero(): { name: string; look: HeroLook };
  /** The film played to its end or was skipped. The hero wakes in the bunk room. */
  filmDone(): void;
  /** The panel the player has open, or null. */
  asking(): OpeningAsk | null;
  /** The mirror's answer. Ends scene 1 the first time. */
  setLook(look: HeroLook): void;
  /** The deed's answer: the name, trimmed to 20 letters. A blank name is refused and returns false. */
  sign(name: string): boolean;
  /** Closes the panel without an answer. */
  cancel(): void;
  /** A swing at Dax in the bout. True when it emptied a pip of his guard. */
  swing(): boolean;
  /** The bout with Dax: whether it is on, and his guard left, from 3. */
  bout(): { on: boolean; guard: number };
  /** The river is behind: the hero stands at the landing. The view has moved them there. */
  ferryDone(): void;
  /** A spot of Saltgate in the world, feet height. */
  spot(id: string): Vec3 | null;
  /** True while the hero stands in Saltgate. */
  inSaltgate(at: Vec3): boolean;
}
