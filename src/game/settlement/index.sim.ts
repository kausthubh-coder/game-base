// The settlement: who lives on the player's land, their needs, jobs and wishes, the dinner table, the steps from
// camp to freehold, and the Heartstone (handbook chapters 27, 28 and 30). It owns the Heartstone's number, 0 to 6;
// `HallApi.heart()` asks it, so the gauge, the Hall's light and the Custodian's lines all read this one number.
//
// Everything is read from the world, a look a second: the buildings the player set down (BUILDINGS in
// content/people.ts, placed through build mode), whether a bed has a roof over it, a lamp by a door, water
// by the kitchen. The data is the second half of content/people.ts; the ladder is ./ladder.sim.ts.
//
//   - People come when their flag is set (Hobb and Dax after scene 18, Gus after the lynx, Wren after the boar,
//     Mina with the quest of the three roofs), or, for Tansy and Holt, when what they came for stands on the land.
//   - Each needs a bed under a roof, a meal a day and a lamp. Glad and at work, they give a heart each morning.
//   - Each has two jobs, chosen by walking them to the room: `lead()`. The job is the flag `job.<id>`.
//   - Every third evening from the first dinner, two of them ask for something at the table. One is granted.
//   - The settlement grows from camp to homestead (Hobb's kitchen), hamlet (three lit households) and freehold
//     (the queen's charter, scene 34).
//
// It finishes the quest steps that are its own by setting their flags: the kitchen, the beds, the first meal,
// Hobb's and Dax's rooms, Gus's bed, the first dinner, Holt and Tansy, the three roofs, Mina's room, Wren's yard.

import type { Vec3 } from '../../engine/types.ts';
import { blockId } from '../../content/blocks.ts';
import type {
  DinnerView, Game, Heart, HeartNextView, HomeView, Interactable, JobView, NeedId, Placed, SettlementApi, SettlerView, SimSystem,
  Systems,
} from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import { FARM_IDS, SETTLEMENT_STEPS, type ItemId, type PersonId, type SettlementStep } from '../content/ids.ts';
import {
  BUILDING, DINNER, FIRST_DINNER, FOOD, HEART_LADDER, HEARTS, HOLT_LAMPS, LARDER_BRINGS, LARDER_DAYS, PUMP_LINE, REACH,
  SETTLED_DAY, SETTLER, SETTLERS, STEP_MOMENTS, TANSY, TRAVEL_MOST, isSettler, type BuildingDef, type JobDef, type SettlerDef,
  type SettlerId,
} from '../content/people.ts';
import { SPEAKERS } from '../content/dialogue.ts';
import { footprint } from '../content/placeables.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { roofOver } from '../time/index.sim.ts';
import { NO_FACTS, heartLevel, landLevel, nextStep, type HeartFacts } from './ladder.sim.ts';
import { tableLayout, type Seat } from './table.sim.ts';

export interface Settlement {
  api: SettlementApi;
  system: SimSystem;
}

/** Seconds between two looks at the land. */
const LOOK = 1;
/** A settler being walked to a room gives up after this many seconds, or when the hero is this far ahead. */
const LEAD_TIME = 240, LEAD_FAR = 40;
/** The hero and the settler both within this many blocks of the room: the job is theirs. Settler within FOLLOW of the hero. */
const FOLLOW = 12;

const TILLED = blockId('tilled_soil'), WATER = blockId('water');
const LAMP_BLOCKS = new Set([blockId('lamp'), blockId('lantern_light')]);
/** The buildings with a prompt at their door, and how far from the door it shows. */
const DOORS = new Set(['oven', 'kitchen', 'dinner_table', 'smokehouse', 'cottage', 'map_room']);
const DOOR_RADIUS = 2.2;
/** Placed things of other systems that are lamps or beds. */
const OTHER_LAMPS = new Set(['switch_lamp', 'lamp_post_kit']);
const OTHER_BEDS = new Set(['bed']);
const NEED_IDS: readonly NeedId[] = ['bed', 'meal', 'lamp'];

interface Record_ {
  who: SettlerId;
  /** The day they came. */
  day: number;
  job: string | null;
  wish: boolean;
  hearts: number;
  /** The last day the kitchen fed them. */
  fed: number;
  /** Dinners they asked at. */
  asked: number;
  /** Not saved: the job they are being walked to, and since when. */
  leading: string | null;
  leadSince: number;
}

/** A building of the settlement standing on the land, as the last look found it. */
interface Building {
  placed: Placed;
  def: BuildingDef | null;
  kind: string;
  /** The footprint after turning, the middle, and the spot before its front. */
  sx: number; sy: number; sz: number;
  center: Vec3;
  door: Vec3;
  top: Vec3;
  /** For a home: the household it belongs to, and who sleeps in it. */
  owner: SettlerId | null;
  residents: SettlerId[];
  lit: boolean;
  view: HomeView | null;
}

/** Where a settler sleeps: a home, or a loose bed under a roof. */
interface Sleep {
  home: Building | null;
  bed: Building | null;
}

interface Dinner {
  day: number;
  asks: SettlerId[];
  open: boolean;
  granted: SettlerId | null;
}

interface SettlementSave {
  v: 1;
  settlers: Omit<Record_, 'leading' | 'leadSince'>[];
  larder: number;
  travel: number;
  lastDay: number;
  supperDay: number;
  lastTake: number;
  dinnerFrom: number;
  dinner: Dinner | null;
  said: number[];
  pumpSaid: boolean;
}

const STEP_INDEX = (step: SettlementStep): number => SETTLEMENT_STEPS.indexOf(step);

export function createSettlement(game: Game): Settlement {
  const { clock, events, flags, player, world } = game;
  const others = game.systems as Partial<Systems>;

  const records: Record_[] = [];
  const byWho = new Map<SettlerId, Record_>();
  const settlerIds: PersonId[] = [];
  let buildings: Building[] = [];
  let homes: Building[] = [];
  const homeViews: HomeView[] = [];
  const sleeps = new Map<SettlerId, Sleep>();
  const needs = new Map<SettlerId, Record<NeedId, boolean>>();
  let kitchen: Building | null = null;
  /** Beds under a roof: loose beds with a roof over them, and the beds of every home. */
  let bedCount = 0;
  let table: Building | null = null;
  /** The seats round the dinner table, when the table is one: a settler's seat is their place in `records`. */
  let seats: readonly Seat[] = [];
  let larder = 0, travel = 0;
  let lastDay = -1, supperDay = -1, lastTake = 0, dinnerFrom = -1;
  let dinner: Dinner | null = null;
  const said = new Set<number>();
  let pumpSaid = false;
  let facts: HeartFacts = { ...NO_FACTS };
  const heart: { level: number; parts: Heart['parts'] } = { level: 0, parts: [] };
  /** The level at the last look, or -1 before a look in play. A level only counts as risen from one seen. */
  let heartWas = -1;
  let sinceLook = LOOK;
  let looks = 0;
  /** A flag changed since the stone was last weighed: the next ask weighs it again, so a quest reads it at once. */
  let dirty = true;
  events.on('flag.changed', ({ flag }) => {
    if (flag !== FLAG.heartstone && flag !== FLAG.hearts) dirty = true;
  });
  /** The prompt at each building's door, by its placed id. The words are worked out each look. */
  const doors = new Map<string, { target: Interactable; at: Vec3; text: string | null }>();
  /** Each settler's spot by their routine, kept as one object while it does not change. */
  const spots = new Map<SettlerId, { key: string; place: string; at: Vec3; seat?: number }>();

  // ------------------------------------------------------------------------------------ small helpers

  const place = (name: string): Vec3 | null => {
    try {
      return others.region?.place(name)?.at ?? null;
    } catch {
      return null;
    }
  };
  const say = (text: string, icon?: string): void => {
    if (text) events.emit('toast', icon ? { text, icon } : { text });
  };
  const custodian = (text: string): void => say(`${SPEAKERS.custodian ?? 'The Custodian'}: ${text}`);
  const hearts = (): number => Number(flags.get(FLAG.hearts)) || 0;
  function addHearts(who: SettlerId | null, amount: number): void {
    if (amount <= 0) return;
    flags.add(FLAG.hearts, amount);
    if (!who) return;
    const rec = byWho.get(who);
    if (!rec) return;
    const before = Math.floor(rec.hearts / 10);
    rec.hearts += amount;
    // A heart in friendship for every ten given.
    const gained = Math.floor(rec.hearts / 10) - before;
    if (gained > 0) others.people?.befriend(who, gained);
  }
  const setOnce = (flag: string, value: string | number | boolean = true): void => {
    if (flags.get(flag) === undefined || flags.get(flag) === false) flags.set(flag, value);
  };
  const here = (who: SettlerId): boolean => byWho.has(who);
  const nameOf = (who: SettlerId): string => SETTLER[who].name;

  /** The distance in blocks from a point to a building's footprint, flat. */
  function reachOf(b: Building, at: Vec3): number {
    const p = b.placed;
    const dx = at.x < p.x ? p.x - at.x : at.x > p.x + b.sx ? at.x - p.x - b.sx : 0;
    const dz = at.z < p.z ? p.z - at.z : at.z > p.z + b.sz ? at.z - p.z - b.sz : 0;
    return Math.hypot(dx, dz);
  }

  /** True when a block of one of these ids stands in the columns within `r` of the point, near its height. */
  function blockNear(at: Vec3, r: number, ids: ReadonlySet<number>, top: boolean): boolean {
    const x0 = Math.floor(at.x - r), x1 = Math.floor(at.x + r), z0 = Math.floor(at.z - r), z1 = Math.floor(at.z + r);
    const y = Math.floor(at.y);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (top) {
          // The surface of the column: water sits on it, tilled soil is it.
          const h = world.heightAt(x, z);
          if (ids.has(world.getBlock(x, h, z)) || ids.has(world.getBlock(x, h - 1, z))) return true;
        } else {
          for (let dy = -1; dy <= 4; dy++) if (ids.has(world.getBlock(x, y + dy, z))) return true;
        }
      }
    }
    return false;
  }
  const WATER_IDS = new Set([WATER]);

  // ------------------------------------------------------------------------------------ the look at the land

  function survey(): void {
    const all = others.placeables?.all() ?? [];
    const next: Building[] = [];
    for (const placed of all) {
      const def = BUILDING.get(placed.kind) ?? null;
      if (!def && !OTHER_BEDS.has(placed.kind) && !OTHER_LAMPS.has(placed.kind) && placed.kind !== 'chest' && placed.kind !== 'bee_box') continue;
      const size = def?.size ?? [1, 1, OTHER_BEDS.has(placed.kind) ? 2 : 1];
      const [sx, sy, sz] = footprint(size, placed.quarterTurns);
      const center = { x: placed.x + sx / 2, y: placed.y, z: placed.z + sz / 2 };
      // The front faces north at no turns, and each turn goes clockwise seen from above.
      const t = placed.quarterTurns & 3;
      const fx = t === 1 ? 1 : t === 3 ? -1 : 0, fz = t === 0 ? -1 : t === 2 ? 1 : 0;
      const door = { x: center.x + fx * (sx / 2 + 1), y: placed.y, z: center.z + fz * (sz / 2 + 1) };
      next.push({ placed, def, kind: placed.kind, sx, sy, sz, center, door, top: { x: center.x, y: placed.y + sy + 0.6, z: center.z }, owner: null, residents: [], lit: false, view: null });
    }
    buildings = next;
    homes = buildings.filter((b) => b.def?.home);

    // The kitchen: a kitchen, or an oven with a table beside it.
    kitchen = buildings.find((b) => b.kind === 'kitchen') ?? null;
    if (!kitchen) {
      for (const oven of buildings) {
        if (oven.kind !== 'oven') continue;
        if (buildings.some((b) => b.kind === 'prep_table' && reachOf(b, oven.center) <= REACH.table)) { kitchen = oven; break; }
      }
    }
    table = buildings.find((b) => b.kind === 'dinner_table') ?? kitchen;
    seats = table && table.kind === 'dinner_table'
      ? tableLayout(table.center, table.sx, table.sz, [Math.sign(table.door.x - table.center.x), Math.sign(table.door.z - table.center.z)]).seats
      : [];

    // Lamps: the lamps set down, and the lamp blocks by each home and bed.
    const lamps = buildings.filter((b) => b.def?.lamp || OTHER_LAMPS.has(b.kind));
    const litAt = (b: Building): boolean => lamps.some((l) => l !== b && reachOf(b, l.center) <= REACH.lamp) || blockNear(b.center, Math.max(b.sx, b.sz) / 2 + REACH.lamp, LAMP_BLOCKS, false);
    for (const b of buildings) if (b.def?.home || b.def?.bed || OTHER_BEDS.has(b.kind) || b.kind === 'kitchen') b.lit = litAt(b);

    house();
    feelNeeds();
  }

  /** Who sleeps where: households take a home each, lodgers take a spare bed in one, the rest a bed under a roof. */
  function house(): void {
    sleeps.clear();
    const free = new Map<Building, number>(homes.map((h) => [h, h.def?.beds ?? 0]));
    const households: SettlerId[][] = [];
    for (const rec of records) {
      const head = SETTLER[rec.who].household;
      const group = head && here(head) ? households.find((g) => g[0] === head) : undefined;
      if (group) group.push(rec.who);
      else households.push([rec.who]);
    }
    const take = (group: SettlerId[], home: Building): void => {
      home.owner = group[0];
      for (const who of group) {
        home.residents.push(who);
        sleeps.set(who, { home, bed: null });
      }
      free.set(home, (free.get(home) ?? 0) - group.length);
    };
    const open = (home: Building, size: number): boolean => home.owner === null && (free.get(home) ?? 0) >= size;
    // Someone who wants a kind of home has it first, then the rest in the order they came.
    for (const group of households) {
      const prefers = SETTLER[group[0]].prefers;
      const home = prefers ? homes.find((h) => h.kind === prefers && open(h, group.length)) : undefined;
      if (home) take(group, home);
    }
    for (const group of households) {
      if (sleeps.has(group[0])) continue;
      const home = homes.find((h) => open(h, group.length));
      if (home) take(group, home);
    }
    // A spare bed in someone's home, then a bed under a roof.
    const beds = buildings.filter((b) => (b.def?.bed || OTHER_BEDS.has(b.kind)) && roofOver(world, b.placed.x, b.placed.y + b.sy, b.placed.z));
    bedCount = beds.length + homes.reduce((n, h) => n + (h.def?.beds ?? 0), 0);
    for (const rec of records) {
      if (sleeps.has(rec.who)) continue;
      const home = homes.find((h) => h.owner !== null && (free.get(h) ?? 0) > 0);
      if (home) {
        home.residents.push(rec.who);
        free.set(home, (free.get(home) ?? 0) - 1);
        sleeps.set(rec.who, { home, bed: null });
        continue;
      }
      const bed = beds.shift();
      if (bed) {
        bed.residents.push(rec.who);
        sleeps.set(rec.who, { home: null, bed });
      }
    }
    // The homes view: each home anyone sleeps in.
    homeViews.length = 0;
    for (const h of homes) {
      if (h.residents.length === 0) continue;
      h.view = { id: h.placed.id, kind: h.kind, name: h.def?.name ?? h.kind, top: h.top, door: h.door, residents: h.residents, lit: h.lit };
      homeViews.push(h.view);
    }
  }

  function feelNeeds(): void {
    const fedSince = clock.day - 1;
    for (const rec of records) {
      const sleep = sleeps.get(rec.who);
      const where = sleep?.home ?? sleep?.bed ?? null;
      const n = needs.get(rec.who) ?? { bed: false, meal: false, lamp: false };
      n.bed = where !== null;
      n.lamp = where !== null && where.lit;
      n.meal = rec.fed >= fedSince;
      needs.set(rec.who, n);
      // The story's walk-up lines say a need while its flag holds (content/dialogue.ts, `needs`).
      for (const what of NEED_IDS) {
        const flag = FLAG.need(rec.who, what), unmet = !n[what];
        if (unmet ? flags.get(flag) !== true : flags.is(flag)) flags.set(flag, unmet);
      }
    }
  }

  const gusOnArm = (): boolean => flags.get(FLAG.choice('gus')) === 'arm';
  const metAll = (who: SettlerId): boolean => {
    const n = needs.get(who);
    return !!n && n.bed && n.meal && n.lamp;
  };
  /** Every need met, at work, and nothing stopping their hearts. */
  const glad = (rec: Record_): boolean => metAll(rec.who) && rec.job !== null && !(rec.who === 'gus' && gusOnArm());

  // ------------------------------------------------------------------------------------ the Heartstone

  function gather(): void {
    const farms = others.farms?.all();
    let living = 0;
    if (farms && farms.length > 0) {
      for (const farm of farms) if (farm.living && farm.mode !== 'take') living++;
    } else {
      for (const id of FARM_IDS) if (flags.is(FLAG.farmLiving(id)) && flags.get(FLAG.farmMode(id)) !== 'take') living++;
    }
    const parts = others.machines?.parts() ?? [];
    const moving = parts.some((p) => (p.kind === 'chute' || p.kind === 'pusher' || p.kind === 'collector_chest') && p.state === 'working');
    let met = 0;
    for (const rec of records) if (metAll(rec.who)) met++;
    const wetSoil = (others.crops?.soil?.() ?? []).some((s) => s.wet > 0);
    facts = {
      seen: flags.is('heart.seen'),
      // The ditch and the camp of the quest on the first day, or what stands on the land now.
      water: wetSoil || flags.is(FLAG.step('ground', 'ditch')) || flags.is(FLAG.farmBuilt('field')) || flags.is(FLAG.questDone('ground')),
      fire: buildings.some((b) => b.def?.fire) || flags.is(FLAG.step('ground', 'camp')) || flags.is(FLAG.questDone('ground')),
      kitchen: kitchen !== null,
      beds: bedCount,
      living,
      settlers: records.length,
      met,
      wheel: (others.machines?.turning() ?? false) || flags.is(FLAG.step('uphill', 'wheel')) || flags.is(FLAG.questDone('uphill')),
      terrace: flags.is(FLAG.step('uphill', 'terrace')) || flags.is(FLAG.questDone('uphill')),
      households: homes.filter((h) => h.owner !== null).length,
      moving: moving || flags.is(FLAG.step('itself', 'chutes')) || flags.is(FLAG.questDone('itself')),
      hearts: hearts(),
      stag: flags.is(FLAG.fightWon(12)) || flags.is(FLAG.scene(33)),
      pump: flags.get(FLAG.pumpRunning) === true,
    };
  }

  function weigh(): void {
    const level = heartLevel(facts);
    heart.level = level;
    heart.parts = [
      { label: 'living farm', count: facts.living, worth: 0 },
      { label: 'settler', count: facts.settlers, worth: 0 },
      { label: 'heart', count: facts.hearts, worth: 0 },
    ];
    if (flags.get(FLAG.heartstone) !== level) flags.set(FLAG.heartstone, level);
    // The Custodian marks each step the first time the stone reaches it, once it is awake to see.
    if (!flags.is('custodian.awake')) {
      heartWas = -1;
      return;
    }
    if (heartWas >= 0 && level > heartWas) {
      for (let at = heartWas + 1; at <= level; at++) {
        if (said.has(at)) continue;
        said.add(at);
        if (HEART_LADDER[at - 1].says) custodian(HEART_LADDER[at - 1].says);
      }
    }
    if (facts.pump && !pumpSaid && landLevel(facts) > level) {
      pumpSaid = true;
      custodian(PUMP_LINE);
    }
    heartWas = level;
  }

  // ------------------------------------------------------------------------------------ people coming

  function bees(): boolean {
    const boxes = buildings.filter((b) => b.kind === 'bee_box').length;
    let flowers = 0;
    for (const crop of others.crops?.all() ?? []) if (crop.state.crop === 'sunroot' || crop.state.crop.includes('flower')) flowers++;
    for (const p of others.placeables?.all() ?? []) if (p.kind.includes('flower')) flowers++;
    // The bee farm counts the flowers in the boxes' reach, open meadow too, and is living only with twenty of them
    // and nothing on Take nearby (src/game/farms, the bee boxes).
    const bee = others.farms?.get('bee');
    const flowered = flowers >= TANSY.flowers || (bee?.living ?? false);
    return boxes >= TANSY.boxes && flowered && clock.day - lastTake >= TANSY.days;
  }

  function lamps(): boolean {
    const posts = buildings.filter((b) => b.def?.lamp || OTHER_LAMPS.has(b.kind)).length;
    return homes.length > 0 && homes.every((h) => h.lit) && posts >= HOLT_LAMPS;
  }

  function comes(def: SettlerDef): boolean {
    const a = def.arrives;
    if ('flag' in a) return flags.is(a.flag);
    return a.built === 'bees' ? bees() : lamps();
  }

  function arrive(def: SettlerDef): void {
    const rec: Record_ = { who: def.who, day: clock.day, job: null, wish: false, hearts: 0, fed: clock.day, asked: 0, leading: null, leadSince: 0 };
    // Someone who came to do one thing starts it at once.
    if (def.jobs.length === 1) rec.job = def.jobs[0].id;
    records.push(rec);
    byWho.set(def.who, rec);
    settlerIds.push(def.who);
    flags.set(FLAG.settler(def.who), true);
    if (rec.job) flags.set(FLAG.job(def.who), rec.job);
    if (def.who === 'hobb') larder += LARDER_BRINGS;
    if (def.who === 'holt') setOnce(FLAG.step('lights', 'holt'));
    if (def.who === 'tansy') setOnce(FLAG.step('itself', 'tansy'));
    events.emit('settler.arrived', { who: def.who });
    say(def.arrival);
  }

  function arrivals(): void {
    for (const def of SETTLERS) if (!byWho.has(def.who) && comes(def)) arrive(def);
  }

  // ------------------------------------------------------------------------------------ wishes

  function wishHolds(rec: Record_): boolean {
    switch (SETTLER[rec.who].wish.rule) {
      case 'river-kitchen': {
        const k = buildings.find((b) => b.kind === 'kitchen') ?? kitchen;
        return k !== null && blockNear(k.center, Math.max(k.sx, k.sz) / 2 + REACH.water, WATER_IDS, true);
      }
      case 'gate-post': {
        const gate = place('grant.stone');
        return gate !== null && buildings.some((b) => b.kind === 'watch_post' && reachOf(b, gate) <= REACH.post);
      }
      case 'rested-rows': {
        const rest = restedRows();
        return rest.tilled >= 8 && rest.resting * 4 >= rest.tilled;
      }
      case 'yard-water':
        return buildings.some((b) => b.kind === 'beast_yard' && blockNear(b.center, Math.max(b.sx, b.sz) / 2 + REACH.water, WATER_IDS, true));
      case 'north-light':
        // The map room's tall pane is at its back: with its front to the south, the back takes the north light.
        return buildings.some((m) => m.kind === 'map_room' && (m.placed.quarterTurns & 3) === 2
          && buildings.some((b) => (b.kind === 'prep_table' || b.kind === 'dinner_table') && reachOf(m, b.center) <= REACH.table));
      case 'no-taking':
        return clock.day - Math.max(lastTake, rec.day) >= 7;
      case 'hall-lamp': {
        const door = place('shut.door');
        return door !== null && buildings.some((b) => (b.def?.lamp || OTHER_LAMPS.has(b.kind)) && distance2d(b.center, door) <= REACH.hallLamp);
      }
    }
  }

  /** Tilled soil on the grant, and how much of it has nothing growing. */
  function restedRows(): { tilled: number; resting: number } {
    const grant = others.region?.grant();
    if (!grant) return { tilled: 0, resting: 0 };
    let tilled = 0, planted = 0;
    for (let x = grant.x; x < grant.x + grant.width; x++) {
      for (let z = grant.z; z < grant.z + grant.depth; z++) {
        const h = world.heightAt(x, z) - 1;
        if (world.getBlock(x, h, z) !== TILLED) continue;
        tilled++;
        if (others.crops?.at(x, h, z)) planted++;
      }
    }
    return { tilled, resting: tilled - planted };
  }

  function wishes(): void {
    for (const rec of records) {
      if (rec.wish || !wishHolds(rec)) continue;
      rec.wish = true;
      flags.set(FLAG.wish(rec.who), true);
      if (rec.who === 'wren') setOnce(FLAG.step('roofs', 'yard'));
      addHearts(rec.who, HEARTS.wish);
      events.emit('wish.granted', { who: rec.who });
      say(`${nameOf(rec.who)}'s wish has come true: ${SETTLER[rec.who].wish.text.toLowerCase()}.`, 'heart');
    }
  }

  // ------------------------------------------------------------------------------------ jobs

  function jobOf(who: SettlerId, job: string): JobDef | undefined {
    return SETTLER[who].jobs.find((j) => j.id === job);
  }

  /** Where the job's room is nearest to `near`, or null when nothing of it stands. */
  function roomAt(job: JobDef, near: Vec3): Vec3 | null {
    const room = job.room;
    if ('place' in room) return place(room.place);
    if ('soil' in room) {
      const grant = others.region?.grant();
      if (!grant) return null;
      let best: Vec3 | null = null, bestD = Infinity;
      for (let x = grant.x; x < grant.x + grant.width; x++) {
        for (let z = grant.z; z < grant.z + grant.depth; z++) {
          const h = world.heightAt(x, z) - 1;
          if (world.getBlock(x, h, z) !== TILLED) continue;
          const d = Math.hypot(x + 0.5 - near.x, z + 0.5 - near.z);
          if (d < bestD) { bestD = d; best = { x: x + 0.5, y: h + 1, z: z + 0.5 }; }
        }
      }
      return best;
    }
    // The kitchen is a kitchen, or an oven with a table by it: an oven alone is not one.
    if (room.kinds.includes('oven')) return kitchen ? kitchen.door : null;
    let best: Building | null = null, bestD = Infinity;
    for (const b of buildings) {
      if (!room.kinds.includes(b.kind)) continue;
      const d = reachOf(b, near);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? best.door : null;
  }

  function lead(who: PersonId, job: string): string | null {
    if (!isSettler(who)) return 'They do not live here.';
    const rec = byWho.get(who);
    const def = jobOf(who, job);
    if (!rec || !def) return 'They do not live here.';
    if (!roomAt(def, player.pos)) return 'soil' in def.room ? 'Till a field on your land first.' : `Build ${def.roomName.replace(/^the |^a /, 'a ')} first.`;
    rec.leading = job;
    rec.leadSince = clock.seconds;
    others.people?.lead?.(who, true);
    say(`Walk ${nameOf(who)} to ${def.roomName}.`);
    return null;
  }

  function stopLeading(rec: Record_): void {
    rec.leading = null;
    others.people?.lead?.(rec.who, false);
  }

  function setJob(rec: Record_, job: string): void {
    rec.job = job;
    flags.set(FLAG.job(rec.who), job);
    const choice = SETTLER[rec.who].choice;
    if (choice) setOnce(FLAG.choice(choice), job);
    say(`${nameOf(rec.who)} takes ${jobOf(rec.who, job)?.roomName ?? job}.`);
  }

  function leading(): void {
    for (const rec of records) {
      if (!rec.leading) continue;
      const job = jobOf(rec.who, rec.leading);
      const npc = others.people?.get(rec.who);
      if (!job || !npc) { stopLeading(rec); continue; }
      const room = roomAt(job, player.pos);
      if (!room || clock.seconds - rec.leadSince > LEAD_TIME || distance2d(npc.pos, player.pos) > LEAD_FAR) {
        stopLeading(rec);
        say(`${nameOf(rec.who)} went back.`);
        continue;
      }
      const near = 'kinds' in job.room ? REACH.room + 2 : REACH.room;
      if (distance2d(player.pos, room) <= near && distance2d(npc.pos, player.pos) <= FOLLOW) {
        stopLeading(rec);
        setJob(rec, job.id);
      }
    }
  }

  // ------------------------------------------------------------------------------------ the day

  /** Each evening the kitchen feeds everyone the larder can. Each morning the glad give hearts. */
  function day(): void {
    const d = clock.day;
    if (lastDay < 0) lastDay = d;
    if (d !== lastDay) {
      lastDay = d;
      morning(d);
    }
    if (clock.timeOfDay >= DINNER.from && supperDay !== d) {
      supperDay = d;
      supper(d);
    }
    // A farm on Take: Tansy will not come for three days, and her wish waits seven.
    for (const id of FARM_IDS) if (flags.get(FLAG.farmMode(id)) === 'take') lastTake = d;
  }

  function supper(d: number): void {
    if (!kitchen || !here('hobb')) return;
    for (const rec of records) {
      if (larder < 1) break;
      larder--;
      rec.fed = d;
    }
  }

  function morning(d: number): void {
    const kitchenJob = byWho.get('hobb')?.job === 'kitchen';
    for (const rec of records) {
      if (!glad(rec)) continue;
      addHearts(rec.who, HEARTS.glad + (kitchenJob && rec.fed >= d - 1 ? HEARTS.kitchen : 0));
    }
    // Hobb at the smokehouse leaves a travel meal each morning, from the larder.
    if (byWho.get('hobb')?.job === 'smokehouse' && buildings.some((b) => b.kind === 'smokehouse') && larder >= 1 && travel < TRAVEL_MOST) {
      larder--;
      travel++;
    }
  }

  // ------------------------------------------------------------------------------------ dinner

  function canDine(): boolean {
    return records.length >= 2 && table !== null && flags.is(FLAG.questStarted('echo'));
  }

  function pickAsks(): SettlerId[] {
    const open = (who: SettlerId): boolean => here(who) && !!SETTLER[who].ask && !flags.is(FLAG.dinner(who));
    if (!flags.get(FLAG.choice('dinner')) && FIRST_DINNER.every(open)) return [...FIRST_DINNER];
    const list = SETTLERS.filter((s) => open(s.who)).map((s) => byWho.get(s.who)!);
    list.sort((a, b) => a.asked - b.asked);
    return list.slice(0, 2).map((r) => r.who);
  }

  function dinnerTime(): void {
    const d = clock.day;
    if (dinner && dinner.day !== d) dinner = null;
    if (clock.timeOfDay < DINNER.from || dinner) return;
    if (!canDine()) return;
    if (dinnerFrom < 0) dinnerFrom = d;
    if ((d - dinnerFrom) % DINNER.every !== 0) return;
    const asks = pickAsks();
    if (asks.length < 2) return;
    dinner = { day: d, asks, open: false, granted: null };
    say('Dinner is on the table.', 'bread');
  }

  /** The day of the next dinner, for the line at the table. */
  function nextDinnerDay(): number {
    if (dinnerFrom < 0) return -1;
    const since = clock.day - dinnerFrom;
    return clock.day + ((DINNER.every - (since % DINNER.every)) % DINNER.every || DINNER.every);
  }

  function sitDown(): void {
    if (dinner && dinner.granted === null) {
      dinner.open = true;
      events.emit('dinner.asked', { asks: [dinner.asks[0], dinner.asks[1]] });
      return;
    }
    if (dinner) { say(`Dinner is over. The next is on day ${nextDinnerDay()}.`); return; }
    if (records.length < 2) { say('Nobody asks you for anything at dinner until two people live here.'); return; }
    const next = nextDinnerDay();
    say(next > 0 ? `Dinner is every third evening. The next is on day ${next}.` : 'Dinner is in the evening.');
  }

  function grant(who: PersonId): string | null {
    if (!dinner || !dinner.open || dinner.granted !== null || !isSettler(who) || !dinner.asks.includes(who)) return null;
    const other = dinner.asks[0] === who ? dinner.asks[1] : dinner.asks[0];
    dinner.granted = who;
    for (const asker of dinner.asks) byWho.get(asker)!.asked++;
    flags.set(FLAG.dinner(who), true);
    if (!flags.get(FLAG.choice('dinner')) && FIRST_DINNER.includes(who) && FIRST_DINNER.includes(other)) flags.set(FLAG.choice('dinner'), who);
    addHearts(who, HEARTS.dinner);
    others.people?.befriend(who, 1);
    const line = SETTLER[other].ask?.other ?? '';
    events.emit('dinner.granted', { who, other, line });
    return line;
  }

  // ------------------------------------------------------------------------------------ the kitchen and the doors

  function stock(item: ItemId, count: number): number {
    const worth = FOOD[item];
    if (!worth || count <= 0) return 0;
    const room = Math.max(0, Math.ceil((Math.max(2, records.length) * LARDER_DAYS - larder) / worth));
    const took = Math.min(room, count);
    larder += took * worth;
    return took;
  }

  function useKitchen(): void {
    if (!here('hobb')) { say('Nobody cooks here yet.'); return; }
    if (dinner && dinner.granted === null && table === kitchen) { sitDown(); return; }
    if (flags.get(FLAG.mealDay) !== clock.day && larder >= 1) {
      larder--;
      flags.set(FLAG.mealDay, clock.day);
      setOnce(FLAG.step('kitchen', 'meal'));
      say('Hobb\'s cooking. You eat, and feel stronger for the day.', 'bread');
      return;
    }
    // Stock the larder from the bag.
    const bag = others.inventory;
    let given = 0;
    if (bag) {
      for (const id of Object.keys(FOOD) as ItemId[]) {
        const have = bag.count(id);
        if (have <= 0) continue;
        const took = stock(id, have);
        if (took > 0) { bag.remove(id, took); given += took; }
      }
    }
    if (given > 0) say(`Into the larder. It holds ${larder} meals.`, 'bread');
    else say(`The larder holds ${larder} meals. Hobb cooks wheat, carrots, sunroot, berries, honey and bread.`);
  }

  function useSmokehouse(): void {
    if (travel <= 0) { say(byWho.get('hobb')?.job === 'smokehouse' ? 'Nothing smoked yet. Come back in the morning.' : 'Cold. Nobody works the smokehouse.'); return; }
    const left = others.inventory?.add('travel_meal', travel) ?? travel;
    const took = travel - left;
    travel = left;
    if (took > 0) say(`${took} travel meal${took === 1 ? '' : 's'}, wrapped for the road.`, 'bread');
  }

  /** What "E" at a building's door does now, in the words of its prompt, or null. */
  function promptOf(b: Building): string | null {
    const kind = b.kind;
    if (kind === 'kitchen' || (kind === 'oven' && b === kitchen)) {
      if (!here('hobb')) return 'Kitchen';
      if (dinner && dinner.granted === null && table === kitchen) return 'Sit down to dinner';
      return flags.get(FLAG.mealDay) !== clock.day && larder >= 1 ? 'Eat Hobb\'s cooking' : 'Stock the larder';
    }
    if (kind === 'oven') return 'Oven';
    if (kind === 'dinner_table') return dinner && dinner.granted === null ? 'Sit down to dinner' : 'Dinner table';
    if (kind === 'smokehouse') return travel > 0 ? 'Take the travel meals' : 'Smokehouse';
    if (b.residents.length === 0) return `Empty ${b.def?.name.toLowerCase() ?? 'home'}`;
    const names = b.residents.map(nameOf);
    return `${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}'s home`;
  }

  function useBuilding(id: string): void {
    const b = buildings.find((x) => x.placed.id === id);
    if (!b || player.busy) return;
    const kind = b.kind;
    if (kind === 'kitchen' || (kind === 'oven' && b === kitchen)) useKitchen();
    else if (kind === 'oven') say('An oven wants a table beside it to make a kitchen.');
    else if (kind === 'dinner_table') sitDown();
    else if (kind === 'smokehouse') useSmokehouse();
    else if (b.residents[0]) events.emit('settler.opened', { who: b.residents[0] });
    else say('Nobody lives here yet.');
    words();
  }

  /** Brings the door prompts in line with the buildings standing. */
  function syncDoors(): void {
    const interact = others.interact;
    if (!interact) return;
    for (const b of buildings) {
      if (!DOORS.has(b.kind)) continue;
      const id = b.placed.id;
      let door = doors.get(id);
      if (!door) {
        const at = { x: 0, y: 0, z: 0 };
        const made: { target: Interactable; at: Vec3; text: string | null } = {
          at, text: null,
          target: { id: `home:${id}`, pos: () => at, radius: DOOR_RADIUS, prompt: () => made.text, act: () => useBuilding(id) },
        };
        door = made;
        doors.set(id, door);
        interact.add(door.target);
      }
      door.at.x = b.door.x; door.at.y = b.door.y; door.at.z = b.door.z;
    }
    for (const [id, door] of doors) {
      if (buildings.some((b) => b.placed.id === id)) continue;
      interact.remove(door.target.id);
      doors.delete(id);
    }
    words();
  }

  /** The words of every door's prompt, for now. */
  function words(): void {
    for (const b of buildings) {
      const door = doors.get(b.placed.id);
      if (door) door.text = promptOf(b);
    }
  }

  // ------------------------------------------------------------------------------------ steps and quest steps

  function grow(): void {
    const now = api.step();
    let step: SettlementStep = now;
    if (step === 'camp' && kitchen && here('hobb')) step = 'homestead';
    if (step === 'homestead' && facts.households >= 3 && homes.filter((h) => h.owner !== null).every((h) => h.lit)) step = 'hamlet';
    if (step === 'hamlet' && flags.is(FLAG.scene(34))) step = 'freehold';
    if (STEP_INDEX(step) <= STEP_INDEX(now)) return;
    flags.set(FLAG.settlementStep, step);
    events.emit('settlement.step', { step });
    if (step !== 'camp') say(STEP_MOMENTS[step].text);
  }

  function questSteps(): void {
    if (here('hobb') && kitchen) setOnce(FLAG.step('kitchen', 'kitchen'));
    if (here('hobb') && here('dax') && sleeps.has('hobb') && sleeps.has('dax')) setOnce(FLAG.step('kitchen', 'beds'));
    if (here('gus') && sleeps.has('gus')) setOnce(FLAG.step('count', 'gus'));
    const gusHome = homes.find((h) => h.owner === 'gus');
    if (gusHome && facts.households >= 3) setOnce(FLAG.step('roofs', 'houses'));
  }

  // ------------------------------------------------------------------------------------ where they stand

  /** A settler's place at the table: their own seat round a dinner table, or the door of a kitchen. */
  function atTable(rec: Record_, at: Building): { key: string; at: Vec3; seat?: number } {
    const i = records.indexOf(rec);
    const seat = seats[i];
    if (!seat) return { key: `table:${at.placed.id}`, at: at.door };
    return { key: `seat:${at.placed.id}:${i}`, at: { x: seat.x, y: at.center.y, z: seat.z }, seat: seat.facing };
  }

  function standAt(rec: Record_): { key: string; place: string; at: Vec3; seat?: number } | null {
    const hour = clock.timeOfDay * 24;
    const sleep = sleeps.get(rec.who);
    const homeSpot = sleep?.home ? { key: `home:${sleep.home.placed.id}`, at: sleep.home.door } : sleep?.bed ? { key: `bed:${sleep.bed.placed.id}`, at: sleep.bed.door } : null;
    const camp = place('camp.seat');
    const fallback = homeSpot ?? (camp ? { key: 'camp', at: camp } : null);
    let pick: { key: string; at: Vec3; seat?: number } | null = fallback;
    let where = 'grant.center';
    if (dinner && dinner.granted === null && hour >= DINNER.from * 24 && table) {
      // A dinner evening: everyone comes to the table, not only the two who ask.
      pick = atTable(rec, table);
    } else if (hour >= SETTLED_DAY.work && hour < SETTLED_DAY.table) {
      if (rec.who === 'gus' && gusOnArm()) {
        // An arm on his field: he walks to town each morning.
        const field = place('gus.field');
        if (field) { pick = { key: 'town', at: field }; where = 'gus.field'; }
      } else if (rec.job) {
        const job = jobOf(rec.who, rec.job);
        const at = job ? roomAt(job, homeSpot?.at ?? player.pos) : null;
        if (at) pick = { key: `work:${rec.job}:${Math.floor(at.x)},${Math.floor(at.z)}`, at };
        if (job && 'place' in job.room) where = job.room.place;
      }
    } else if (hour >= SETTLED_DAY.table && hour < SETTLED_DAY.home && table) {
      pick = atTable(rec, table);
    }
    if (!pick) return null;
    const old = spots.get(rec.who);
    if (old && old.key === pick.key) return old;
    const spot = { key: pick.key, place: where, at: { x: pick.at.x, y: pick.at.y, z: pick.at.z }, ...(pick.seat === undefined ? {} : { seat: pick.seat }) };
    spots.set(rec.who, spot);
    return spot;
  }

  // ------------------------------------------------------------------------------------ the views

  function settlerView(who: PersonId): SettlerView | null {
    if (!isSettler(who)) return null;
    const rec = byWho.get(who);
    if (!rec) return null;
    const def = SETTLER[who];
    const n = needs.get(who) ?? { bed: false, meal: false, lamp: false };
    const jobs: JobView[] = def.jobs.map((j) => ({ id: j.id, name: j.name, text: j.text, room: j.roomName, ready: roomAt(j, player.pos) !== null }));
    const missing = (['bed', 'meal', 'lamp'] as const).filter((k) => !n[k]);
    let note = '';
    if (who === 'gus' && gusOnArm()) note = 'With an arm on his field, Gus walks to town each morning. His hearts stop.';
    else if (missing.length > 0) note = `Needs ${missing.map((k) => (k === 'bed' ? 'a bed under a roof' : k === 'meal' ? 'a meal' : 'a lamp')).join(' and ')} to work.`;
    else if (!rec.job) note = 'Choose a job, and walk them to it.';
    const sleep = sleeps.get(who);
    return {
      who, name: def.name, needs: { ...n }, glad: glad(rec),
      wish: { text: def.wish.text, granted: rec.wish },
      jobs, job: rec.job, leading: rec.leading, home: sleep?.home?.view ?? null, hearts: rec.hearts, road: def.road, note,
    };
  }

  const api: SettlementApi = {
    heartstone() {
      fresh();
      return heart;
    },
    step(): SettlementStep {
      const step = flags.get(FLAG.settlementStep);
      return (SETTLEMENT_STEPS as readonly unknown[]).includes(step) ? (step as SettlementStep) : 'camp';
    },
    settlers: () => settlerIds,
    settler: settlerView,
    homes: () => homeViews,
    next(): HeartNextView | null {
      fresh();
      return nextStep(facts);
    },
    lead,
    dinner(): DinnerView | null {
      if (!dinner || !dinner.open) return null;
      return { day: dinner.day, asks: dinner.asks.map((who) => ({ who, text: SETTLER[who].ask?.text ?? '' })), granted: dinner.granted };
    },
    grant,
    stock,
    larder: () => ({ meals: larder, travel }),
    spot(who) {
      if (!isSettler(who)) return null;
      const rec = byWho.get(who);
      return rec && !rec.leading ? spots.get(who) ?? null : null;
    },
  };

  /** Weighs the stone again when a flag changed since: a quest step or the gauge reads it at once. */
  function fresh(): void {
    if (!dirty) return;
    dirty = false;
    gather();
    weigh();
  }

  /** One look at the land and the people: the order matters, each part reads what the one before found. */
  function look(): void {
    looks++;
    arrivals();
    survey();
    day();
    gather();
    weigh();
    dirty = false;
    leading();
    // Wishes read the most of the world, so every other look.
    if (looks % 2 === 0) wishes();
    dinnerTime();
    grow();
    questSteps();
    syncDoors();
    for (const rec of records) if (!standAt(rec)) spots.delete(rec.who);
  }

  const system: SimSystem = {
    step(dt) {
      sinceLook += dt;
      if (sinceLook < LOOK) return;
      sinceLook = 0;
      look();
    },
    save(): SettlementSave {
      return {
        v: 1,
        settlers: records.map(({ who, day, job, wish, hearts, fed, asked }) => ({ who, day, job, wish, hearts, fed, asked })),
        larder, travel, lastDay, supperDay, lastTake, dinnerFrom,
        dinner: dinner ? { ...dinner, asks: [...dinner.asks], open: false } : null,
        said: [...said], pumpSaid,
      };
    },
    load(data) {
      const save = data as Partial<SettlementSave> | null;
      for (const rec of records) if (rec.leading) others.people?.lead?.(rec.who, false);
      records.length = 0;
      byWho.clear();
      settlerIds.length = 0;
      spots.clear();
      for (const s of save?.settlers ?? []) {
        if (!isSettler(s.who) || byWho.has(s.who)) continue;
        const rec: Record_ = {
          who: s.who, day: Number(s.day) || 1, job: typeof s.job === 'string' ? s.job : null, wish: !!s.wish,
          hearts: Number(s.hearts) || 0, fed: Number(s.fed) || 0, asked: Number(s.asked) || 0, leading: null, leadSince: 0,
        };
        records.push(rec);
        byWho.set(rec.who, rec);
        settlerIds.push(rec.who);
      }
      const num = (v: unknown, d: number): number => (Number.isFinite(Number(v)) ? Number(v) : d);
      larder = num(save?.larder, 0);
      travel = num(save?.travel, 0);
      lastDay = num(save?.lastDay, -1);
      supperDay = num(save?.supperDay, -1);
      lastTake = num(save?.lastTake, 0);
      dinnerFrom = num(save?.dinnerFrom, -1);
      const d = save?.dinner;
      dinner = d && Array.isArray(d.asks) && d.asks.length === 2 && d.asks.every(isSettler) ? { day: num(d.day, 0), asks: [...d.asks], open: false, granted: d.granted && isSettler(d.granted) ? d.granted : null } : null;
      said.clear();
      for (const n of save?.said ?? []) said.add(Number(n));
      pumpSaid = !!save?.pumpSaid;
      heartWas = -1;
      sinceLook = LOOK;
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createSettlement(kernel.game);
  kernel.add('settlement', api, system);
}
