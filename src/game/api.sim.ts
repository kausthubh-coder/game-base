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
export interface GameEvents {
  // world and movement, also heard by sound and effects
  footstep: { surface: Surface; at: Vec3 };
  jump: { at: Vec3 };
  land: { surface: Surface; at: Vec3 };
  'block.placed': { x: number; y: number; z: number; id: number; by: 'player' | 'world' };
  'block.broken': { x: number; y: number; z: number; id: number; by: 'player' | 'world' };
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
  items: ItemsApi;
  inventory: InventoryApi;
  actions: ActionsApi;
  interact: InteractApi;
  placeables: PlaceablesApi;
  crafting: CraftingApi;
  crops: CropsApi;
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
  move(from: number, to: number): void;
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
  /** The block being broken right now and how far along it is, 0 to 1, or null. */
  breaking(): { x: number; y: number; z: number; progress: number } | null;
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
}

export interface TimeApi {
  /** Seconds of real time one game day lasts. */
  readonly dayLength: number;
  /** True when the player may sleep: it is evening or night, and they are indoors by a bed. */
  canSleep(): boolean;
  /** Skips to the next morning. Crops, creatures and people catch up. */
  sleep(): void;
  /** Forces the weather for a scripted moment, or `null` to let it run. */
  setWeather(kind: 'clear' | 'breezy' | 'overcast' | 'rain' | 'storm' | 'fog' | null): void;
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
  /** Sends someone to a named place now, ahead of their routine. For story moments. */
  send(id: NpcId, place: string): void;
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
}
