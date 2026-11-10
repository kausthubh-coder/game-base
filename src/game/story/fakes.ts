// A small stage for tests: a real kernel, the real talk, quests and director, and plain fakes for every
// other system they call. Tests in talk, quests and story share it.

import { World } from '../../features/world/world.sim.ts';
import type { Vec3 } from '../../engine/types.ts';
import type {
  Actor, AlmanacPage, EventName, Game, GameEvents, ItemId, NpcId, NpcState, PetState, Place, Placed, Stack, Systems, UseContext,
} from '../api.sim.ts';
import { createKernel, STEP, type Kernel } from '../kernel.sim.ts';
import { install as installQuests } from '../quests/index.sim.ts';
import { install as installTalk } from '../talk/index.sim.ts';
import { install as installStory } from './index.sim.ts';

export const PLACES: Record<string, [number, number]> = {
  'grant.stone': [0, 0],
  'grant.center': [14, 14],
  'grant.rocks': [-8, 6],
  'dead.garden': [70, 10],
  'town.gate': [0, -140],
  'town.square': [0, -170],
  lodge: [-20, -165],
  granary: [20, -165],
  bakery: [10, -180],
  'gus.field': [45, -175],
  carpenter: [-15, -185],
  kennel: [-30, -180],
  'river.bank': [0, -190],
  ferry: [30, -200],
};

const HOMES: Record<NpcId, string> = {
  tamsin: 'grant.stone', maren: 'granary', odo: 'bakery', gus: 'gus.field', mira: 'carpenter', wren: 'kennel',
  juniper: 'town.square', brack: 'ferry', 'villager-1': 'town.square', 'villager-2': 'town.square',
};

/** The height everything in the fake region stands at: open air high in the one loaded chunk. */
export const GROUND = 60;

export interface Stage {
  kernel: Kernel;
  game: Game;
  /** Every event sent, in order. */
  heard: { name: EventName; data: GameEvents[EventName] }[];
  bag: Map<ItemId, number>;
  /** True makes every gift bounce off a full bag. */
  bagFull: boolean;
  people: Map<NpcId, NpcState>;
  marks: Map<NpcId, string>;
  holding: Set<NpcId>;
  sent: { npc: NpcId; place: string; offset?: { x: number; z: number } }[];
  placed: Placed[];
  pet: PetState;
  crops: { x: number; y: number; z: number; state: { crop: string; stage: number; wet: number; ripe: boolean } }[];
  /** Every weather the story asked for, in order. */
  weather: (string | null)[];
  /** Steps the kernel and the fake clock. */
  run(seconds: number): void;
  /** Puts the player at a named place. A bonded pet comes along. */
  moveTo(place: string): void;
  /** Talks to someone and clicks through, taking this choice whenever one is offered. Returns the lines seen. */
  talk(npc: NpcId, choice?: number): string[];
  /** Clicks through the open conversation. */
  through(choice?: number): string[];
  /** The id of the conversation the last talk started. */
  lastConversation(): string | undefined;
  /** Uses an item from the bag with the secondary button. */
  use(item: ItemId): boolean;
  events(name: EventName): GameEvents[EventName][];
}

export function stage(options: { story?: boolean } = {}): Stage {
  const world = new World(7);
  world.load(0, 0);
  const kernel = createKernel(world, 7);
  const { game } = kernel;
  const heard: Stage['heard'] = [];
  game.events.onAny((name, data) => heard.push({ name, data }));

  const at = (name: string): Vec3 => ({ x: PLACES[name][0] + 0.5, y: GROUND, z: PLACES[name][1] + 0.5 });
  const places: Place[] = Object.keys(PLACES).map((name) => ({ name, at: at(name), label: name }));

  const bag = new Map<ItemId, number>();
  const people = new Map<NpcId, NpcState>();
  const marks = new Map<NpcId, string>();
  const holding = new Set<NpcId>();
  const sent: Stage['sent'] = [];
  const placed: Placed[] = [];
  const crops: Stage['crops'] = [];
  const weather: (string | null)[] = [];
  const handlers: ((context: UseContext) => boolean)[] = [];
  const pet: PetState = { id: 'pet:leaftail:1', kind: 'leaftail', name: 'Leaftail', pos: at('dead.garden'), trust: 0, bonded: false, startled: false };

  for (const [id, home] of Object.entries(HOMES)) {
    const name = id[0].toUpperCase() + id.slice(1);
    people.set(id, { id, name, sprite: id, portrait: id, voice: id, pos: at(home), place: home, friendship: 0 });
    game.actors.set(`npc:${id}`, { id: `npc:${id}`, sprite: id, pos: people.get(id)!.pos, facing: 0, anim: 'idle', visible: true, mark: '' } satisfies Actor);
  }

  const fact = (id: string, column: 'needs' | 'gives') => ({ id, column, text: id, known: false });
  const page = (id: string, kind: AlmanacPage['kind']): AlmanacPage => ({
    id, title: id, picture: id, kind, facts: [fact('needs', 'needs'), fact('gives', 'gives')], complete: false, seen: false,
  });
  const pages = new Map<string, AlmanacPage>([['mossling', page('mossling', 'creature')]]);
  for (const id of ['tamsin', 'maren', 'odo', 'gus', 'mira', 'wren', 'juniper', 'brack']) pages.set(id, page(id, 'person'));

  const stageBag = { full: false };
  const fakes: Partial<Systems> = {
    inventory: {
      slots: [],
      selected: 0,
      held: (): Stack | null => null,
      add(id, count) {
        if (stageBag.full) return count;
        bag.set(id, (bag.get(id) ?? 0) + count);
        game.events.emit('item.gained', { id, count });
        game.events.emit('inventory.changed', {});
        return 0;
      },
      remove(id, count) {
        if ((bag.get(id) ?? 0) < count) return false;
        bag.set(id, bag.get(id)! - count);
        game.events.emit('item.lost', { id, count });
        game.events.emit('inventory.changed', {});
        return true;
      },
      count: (id) => bag.get(id) ?? 0,
      move() {},
    },
    people: {
      all: () => [...people.values()],
      get: (id) => people.get(id),
      send(id, place, offset) {
        const npc = people.get(id);
        if (!npc) return;
        sent.push(offset ? { npc: id, place, offset } : { npc: id, place });
        npc.place = place;
        Object.assign(npc.pos, at(place));
      },
      hold(id, held) {
        if (held) holding.add(id);
        else holding.delete(id);
      },
      befriend(id, amount) {
        const npc = people.get(id);
        if (npc) npc.friendship += amount;
      },
      setMark(id, mark) {
        marks.set(id, mark ?? '');
        const actor = game.actors.get(`npc:${id}`);
        if (actor) actor.mark = mark ?? '';
      },
    },
    region: {
      spawn: () => at('grant.stone'),
      places: () => places,
      place(name) {
        const found = places.find((p) => p.name === name);
        if (!found) throw new Error(`no place ${name}`);
        return found;
      },
      grant: () => ({ x: 0, z: 0, width: 28, depth: 28 }),
      isProtected: () => false,
    },
    almanac: {
      pages: () => [...pages.values()],
      page: (id) => pages.get(id),
      learn(id, factId) {
        const p = pages.get(id);
        const f = p?.facts.find((entry) => entry.id === factId);
        if (!p || !f || f.known) return;
        f.known = true;
        p.seen = true;
        game.events.emit('fact.learned', { page: id, column: f.column, fact: f.id });
        if (p.facts.every((entry) => entry.known)) {
          p.complete = true;
          game.events.emit('page.completed', { page: id });
        }
      },
      meet(id) {
        const p = pages.get(id);
        if (p) p.seen = true;
      },
    },
    placeables: {
      defs: () => [],
      all: () => placed,
      place(kind, x, y, z, quarterTurns) {
        const made: Placed = { id: `${kind}:${placed.length}`, kind, x, y, z, quarterTurns };
        placed.push(made);
        game.events.emit('placeable.placed', { kind, x, y, z });
        return made;
      },
      remove(id) {
        const i = placed.findIndex((p) => p.id === id);
        if (i >= 0) placed.splice(i, 1);
      },
      at: (x, y, z) => placed.find((p) => p.x === x && p.y === y && p.z === z) ?? null,
      near: (station, point, radius) => placed.some((p) => p.kind === station && Math.hypot(p.x - point.x, p.z - point.z) <= radius),
    },
    pets: {
      all: () => [pet],
      companion: () => (pet.bonded ? pet : null),
      feed: () => false,
      bond(id) {
        if (id !== pet.id || pet.bonded) return false;
        pet.trust = 3;
        pet.bonded = true;
        game.events.emit('pet.bonded', { pet: pet.id });
        game.flags.set('pet.leaftail.bonded', true);
        return true;
      },
    },
    crops: {
      defs: () => [],
      till: () => false,
      plant: () => false,
      water: () => false,
      harvest: () => false,
      at: () => null,
      all: () => crops,
    },
    time: {
      dayLength: 720,
      canSleep: () => true,
      sleep() {
        game.clock.day += 1;
        game.clock.timeOfDay = 0.27;
        game.events.emit('slept', { day: game.clock.day });
      },
      setWeather(kind) {
        weather.push(kind);
        game.ambient.rain = kind === 'rain' ? 0.6 : 0;
      },
      setTimeOfDay(timeOfDay) {
        game.clock.timeOfDay = timeOfDay;
      },
    },
    actions: {
      use(context) {
        if (game.player.busy) return false;
        return handlers.some((handler) => handler(context));
      },
      addHandler: (handler) => void handlers.push(handler),
      hold: () => false,
      breaking: () => null,
      reach: 5,
    },
  };
  Object.assign(game.systems, fakes);

  installTalk(kernel);
  installQuests(kernel);
  if (options.story !== false) installStory(kernel);

  Object.assign(game.player.pos, at('grant.stone'));
  game.clock.timeOfDay = 0.27;

  const self: Stage = {
    kernel, game, heard, bag, people, marks, holding, sent, placed, pet, crops, weather,
    get bagFull() {
      return stageBag.full;
    },
    set bagFull(value: boolean) {
      stageBag.full = value;
    },
    run(seconds) {
      for (let i = 0, steps = Math.round(seconds / STEP); i < steps; i++) {
        game.clock.seconds += STEP;
        game.clock.timeOfDay = (game.clock.timeOfDay + STEP / 720) % 1;
        kernel.step();
      }
    },
    moveTo(place) {
      Object.assign(game.player.pos, at(place));
      // A bonded pet follows.
      if (pet.bonded) Object.assign(pet.pos, game.player.pos);
    },
    talk(npc, choice = 0) {
      game.systems.talk.talkTo(npc);
      return self.through(choice);
    },
    through(choice = 0) {
      const talk = game.systems.talk;
      const lines: string[] = [];
      for (let guard = 0; talk.active && guard < 100; guard++) {
        const line = talk.current()!;
        lines.push(line.text);
        if (line.choices.length) talk.choose(Math.min(choice, line.choices.length - 1));
        else talk.advance();
      }
      return lines;
    },
    lastConversation() {
      const started = self.events('talk.started') as GameEvents['talk.started'][];
      return started[started.length - 1]?.conversation;
    },
    use(item) {
      return game.systems.actions.use({ hit: null, held: { id: item, count: bag.get(item) ?? 0 }, button: 'secondary' });
    },
    events: (name) => heard.filter((event) => event.name === name).map((event) => event.data),
  };
  return self;
}
