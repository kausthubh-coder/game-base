// The contract between the game's systems. Every system in src/game/<name>/ implements one of the
// interfaces below and reaches the others only through `game.systems`. Nothing here draws.
//
// A system exports `install(game: Game): SimSystem` from src/game/<name>/index.sim.ts. Install sets
// `game.systems.<name>` and returns the object the kernel steps and saves.
//
// If your system needs one more method or event, add it here in your own section and say so in your report.

import type { Ambient, Surface, Vec3 } from '../engine/types.ts';
import type { RayHit, World } from '../features/world/world.sim.ts';

// ---------------------------------------------------------------------------------------- basics

export type ItemId = string;
export type NpcId = string;
export type QuestId = string;

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
  'talk.started': { npc: NpcId; conversation: string };
  'talk.ended': { npc: NpcId; conversation: string };
  'quest.started': { quest: QuestId };
  'quest.step': { quest: QuestId; step: string };
  'quest.completed': { quest: QuestId };
  'flag.changed': { flag: string; value: FlagValue };
  // time
  'day.started': { day: number };
  'night.started': { day: number };
  slept: { day: number };
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
  'festival.started': Record<string, never>;
  'act.ended': { act: number };
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
  /** Pulls the crop out of this soil block and puts its seed back in the bag. False when nothing grows there. */
  pull?(x: number, y: number, z: number): boolean;
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
  /** Jumps the clock. For the festival and for tests. */
  setTimeOfDay(timeOfDay: number): void;
  /**
   * Hears each clap of thunder in a storm, with the place the lightning struck. The clap comes later the
   * farther the strike. Returns a function that stops listening.
   * It is optional so that a fake without it still fits. The real system always has it.
   */
  onThunder?(listener: (at: Vec3) => void): () => void;
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
  portrait: string;
  voice: string;
  text: string;
  /** Up to three choices. Empty when the line just continues. */
  choices: string[];
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
}

export interface QuestStepView {
  id: string;
  text: string;
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
  steps: QuestStepView[];
}

export interface QuestsApi {
  all(): readonly QuestView[];
  /** The quest the tracker shows. */
  tracked(): QuestView | null;
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
