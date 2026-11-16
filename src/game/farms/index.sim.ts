// Farms: the eleven farms of handbook chapter 30, each with its mode (Give or Take), whether it is living, its
// rate, its best rate and the one line that says what is wrong, and the creatures that walk its rule.
//
// - Every few seconds the ground is read (sites.sim.ts): each farm's layout, scored by its rule.
// - A farm makes its rate a day. Its creatures come in their part of the day (by day, by night, or all day), and
//   each drop is a good on the ground where the creature was, which the hero, a chute or a collector chest takes.
//   What the creatures did not drop by the end of their part of the day falls at once, so a farm left alone, or
//   slept through, still makes its rate: the night that sleep skips runs at once.
// - Give is the steady rate, and the farm counts as living. Take gives its goods at once, and then the creatures
//   stay away three days, and the farm does not count.
// - Watching a farm's creatures fills their page in the field book.
//
// It finishes the quest steps that a farm finishes by setting their `step.<quest>.<step>` flags.

import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { ALMANAC_BOOK } from '../content/almanac.ts';
import { FARMS, farmDef } from '../content/farms.ts';
import { FLAG } from '../content/flags.ts';
import { FARM_IDS, type FarmId, type FarmMode, type ItemId, type QuestId } from '../content/ids.ts';
import type { Actor, FarmView, FarmsApi, Game, Interactable, SimSystem } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { PUMPED_FIELD, readSites, type Site } from './sites.sim.ts';

/** Seconds between two readings of the ground. */
const READ_EVERY = 2;
/** Days the creatures stay away after a Take. */
const AWAY_DAYS = 3;
/** A pit wave: a tick a second, the Build tab's 44 ticks, then a rest before the next six come. */
const PIT_TICK = 1, PIT_REST = 16;
/** A night at the bait field: a burrower comes up every 4 seconds, and the night's wave lasts a minute. */
const BAIT_WAVE = 60, BAIT_GAP = 4, BAIT_EAT = 8, BAIT_SURFACE = 1.5;
/** Within this many blocks the hero sees a farm's creatures, and learns their page. */
const WATCH = 10;
/** Seconds of watching that teach what a creature comes to, and what it fears. */
const COMES_AFTER = 3, FEARS_AFTER = 8;
/** The length of each part of the day, in seconds of game time: 720 of light, 360 of night. */
const HOURS_SECONDS = { day: 720, night: 360, all: 1200 } as const;
const LAMP = blockId('lamp');

export interface FarmsSave {
  version: 1;
  farms: { id: FarmId; mode: FarmMode; away: number; best: number; carry: number; paid: number }[];
  made: string[];
  lamps: [number, number, number][];
  tuskDay: number;
}

interface Farm {
  view: FarmView;
  site: Site | null;
  /** The day the creatures come back after a Take, or 0. */
  awayUntil: number;
  /** The part of the rate not yet dropped in this part of the day, and what is left over from the last. */
  carry: number;
  paid: number;
  /** Seconds toward the next drop of a farm that drops at a steady pace. */
  pace: number;
  /** Seconds into the creatures' wave. */
  wave: number;
  /** True while its part of the day is on. */
  open: boolean;
  /** Seconds the hero has watched its creatures. */
  watched: number;
  actors: Actor[];
  target: Interactable;
}

const inHours = (hours: Site['hours'], t: number): boolean =>
  hours === 'all' ? true : hours === 'day' ? t >= 0.27 && t < 0.73 : t >= 0.78 || t < 0.22;

export function createFarms(game: Game): { api: FarmsApi; system: SimSystem } {
  const { flags, events } = game;
  const sys = game.systems;
  const made = new Set<string>();
  const lamps: Vec3[] = [];
  let readIn = 0;
  let wired = false;
  /** Seconds the hero has stood away from a terrace that runs itself. */
  let standing = 0;
  /** The day Bramble last shed a tusk tip on the gatepost, or 0 before he came home. */
  let tuskDay = 0;

  const farms = new Map<FarmId, Farm>();
  for (const id of FARM_IDS) {
    const def = farmDef(id);
    const interactionAt: Vec3 = { x: 0, y: -100, z: 0 };
    const farm: Farm = {
      view: { id, built: false, mode: 'give', living: false, rate: 0, best: 0, symptom: '', tag: '', sub: '', fix: '', at: null, take: 0, away: 0 },
      site: null, awayUntil: 0, carry: 0, paid: 0, pace: 0, wave: 0, open: false, watched: 0, actors: [],
      target: {
        id: `farm:${id}`,
        pos: () => {
          const at = farm.view.at;
          interactionAt.x = at?.x ?? 0;
          // The rate tag floats above the farm. E belongs on the ground with its goods.
          interactionAt.y = farm.site?.drop.y ?? -100;
          interactionAt.z = at?.z ?? 0;
          return interactionAt;
        },
        radius: 2.5,
        prompt: () => (farm.view.at ? `Look at the ${def.name.toLowerCase()}` : null),
        act: () => events.emit('ui.open', { panel: 'farm', detail: id }),
      },
    };
    farms.set(id, farm);
  }

  const taking = (id: FarmId): boolean => farms.get(id)?.view.mode === 'take';
  const hasBook = (): boolean => flags.is(ALMANAC_BOOK.flag) || (sys.inventory?.count(ALMANAC_BOOK.item) ?? 0) > 0;
  /** Finishes a quest step, only while it is the open step: a farm built early finishes it the moment it opens. */
  const step = (quest: QuestId, id: string): void => {
    if (flags.get(FLAG.questStep(quest)) === id) flags.set(FLAG.step(quest, id), true);
  };
  const knows = (page: string, fact: string): boolean => sys.almanac?.page(page)?.facts.some((f) => f.id === fact && f.known) ?? false;

  // ------------------------------------------------------------------------------------ goods

  function pay(farm: Farm, count: number, at?: Vec3, alreadyPaid = 0): void {
    const site = farm.site;
    if (!site || count <= 0) return;
    const where = at ?? site.drop;
    // Split the day's total, not each drop: single drops alternate honey and wax.
    if (site.also && site.farm === 'bee') {
      const honey = Math.ceil((alreadyPaid + count) / 2) - Math.ceil(alreadyPaid / 2);
      give(farm, site.item, honey, where);
      give(farm, site.also, count - honey, where);
    } else if (site.also) {
      give(farm, site.item, count, where);
      give(farm, site.also, 1, where);
    } else {
      give(farm, site.item, count, where);
    }
  }

  function give(farm: Farm, item: ItemId, count: number, at: Vec3): void {
    if (count <= 0) return;
    sys.machines?.drop(item, count, at);
    events.emit('good.made', { farm: farm.view.id, item, count, at: { x: at.x, y: at.y, z: at.z } });
    const p = game.player.pos;
    const page = farm.site ? farmDef(farm.view.id).page : '';
    if (page && hasBook() && distance2d(p, at) <= WATCH) sys.almanac?.learn(page, 'gives');
  }

  /** One drop the creatures made, if today's rate has room for it. */
  function spend(farm: Farm, at?: Vec3): void {
    if (farm.view.mode !== 'give' || farm.awayUntil > 0) return;
    if (farm.paid + 1 > farm.view.rate + farm.carry + 1e-6) return;
    farm.paid++;
    pay(farm, 1, at, farm.paid - 1);
  }

  /** The end of the creatures' part of the day: what they did not drop falls at once. */
  function settle(farm: Farm): void {
    if (farm.view.mode === 'give' && farm.awayUntil === 0 && farm.view.built) {
      const owed = farm.view.rate + farm.carry - farm.paid;
      const whole = Math.floor(owed + 1e-6);
      if (whole > 0) pay(farm, whole, undefined, farm.paid);
      farm.carry = Math.max(0, owed - whole);
    } else {
      farm.carry = 0;
    }
    farm.paid = 0;
    farm.pace = 0;
  }

  // ------------------------------------------------------------------------------------ the creatures

  function actorsFor(farm: Farm, n: number, sprite: string): Actor[] {
    while (farm.actors.length < n) {
      const i = farm.actors.length;
      const actor: Actor = { id: `farm:${farm.view.id}:${i}`, sprite, pos: { x: 0, y: -100, z: 0 }, facing: 0, anim: 'idle', visible: false };
      farm.actors.push(actor);
      game.actors.set(actor.id, actor);
    }
    for (let i = 0; i < farm.actors.length; i++) {
      const actor = farm.actors[i];
      actor.sprite = sprite;
      if (i >= n) actor.visible = false;
    }
    return farm.actors;
  }

  function hide(farm: Farm): void {
    for (const actor of farm.actors) actor.visible = false;
  }

  const facingOf = (dx: number, dz: number): number => Math.atan2(dx, -dz);

  function place(actor: Actor, at: Vec3, from: Vec3 | null, anim: string): void {
    if (from && (from.x !== at.x || from.z !== at.z)) actor.facing = facingOf(at.x - from.x, at.z - from.z);
    actor.pos.x = at.x;
    actor.pos.y = at.y;
    actor.pos.z = at.z;
    actor.anim = anim;
    actor.visible = true;
  }

  const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });

  /** Plays one farm's creatures for this step, and drops what they make at the moment they make it. */
  function play(farm: Farm, dt: number): void {
    const site = farm.site;
    const t = game.clock.timeOfDay;
    if (!site || farm.awayUntil > 0 || farm.view.mode === 'take') { hide(farm); return; }
    const plan = site.plan;
    if (plan.kind === 'none') { hide(farm); return; }
    const on = inHours(site.hours, t);

    if (plan.kind === 'pit') {
      const actors = actorsFor(farm, plan.run.g.length, 'gearling');
      if (!on) { hide(farm); farm.wave = 0; return; }
      const before = Math.floor(farm.wave / PIT_TICK);
      farm.wave += dt;
      const length = 44 * PIT_TICK + PIT_REST;
      if (farm.wave >= length) farm.wave = 0;
      const tick = Math.floor(farm.wave / PIT_TICK), f = (farm.wave % PIT_TICK) / PIT_TICK;
      plan.run.g.forEach((m, i) => {
        const actor = actors[i];
        const now = m.path[tick];
        if (!now || tick >= 44 || now.state === 'gone') { actor.visible = false; return; }
        const next = m.path[tick + 1] ?? now;
        const a = plan.cell(now.at[0], now.at[1]);
        const b = plan.cell(next.at[0], next.at[1]);
        const at = now.state === 'walking' ? lerp(a, b, f) : a;
        // A gearling stopped in a pit stands in the hole.
        if (now.state === 'stopped') at.y -= 0.7;
        place(actor, at, actor.visible ? { ...actor.pos } : null, now.state === 'walking' ? 'walk' : 'idle');
        // The moment it stops in the dark, it drops a spring. The moment one reaches the wheel, the wheel jams.
        if (tick !== before && tick === m.stoppedAt) spend(farm, a);
        if (tick !== before && now.state === 'jam' && m.path[tick - 1]?.state !== 'jam') sys.machines?.jam(plan.wheel);
      });
      return;
    }

    if (plan.kind === 'bait') {
      const out = plan.run.out;
      const actors = actorsFor(farm, out.length, 'burrower');
      if (!on) { hide(farm); farm.wave = 0; return; }
      const before = farm.wave;
      farm.wave = (farm.wave + dt) % BAIT_WAVE;
      out.forEach((b, i) => {
        const actor = actors[i];
        const s = farm.wave - i * BAIT_GAP;
        const door = plan.cell(b.door[0], b.door[1]);
        const end = plan.cell(b.path[b.path.length - 1][0], b.path[b.path.length - 1][1]);
        const tunnel = b.path.length - 1;
        if (s < 0) { actor.visible = false; return; }
        if (s < BAIT_SURFACE) { place(actor, door, null, 'surface'); return; }
        if (b.end === 'turned' || b.end === 'hungry') { actor.visible = false; return; }
        // Underground along its tunnel, then up at the carrot it wants.
        if (s < BAIT_SURFACE + tunnel) { actor.visible = false; return; }
        if (s < BAIT_SURFACE * 2 + tunnel) { place(actor, end, door, 'surface'); return; }
        if (s < BAIT_SURFACE * 2 + tunnel + BAIT_EAT) {
          place(actor, end, null, 'idle');
          const at = BAIT_SURFACE * 2 + tunnel + BAIT_EAT / 2;
          if (b.end === 'carrot' && before - i * BAIT_GAP < at && s >= at) spend(farm, end);
          return;
        }
        actor.visible = false;
      });
      return;
    }

    if (plan.kind === 'spots') {
      const actors = actorsFor(farm, plan.spots.length, plan.sprite);
      // Wings keep to their part of the day. Creatures on the ground stay in sight.
      if (plan.fly && !on) { hide(farm); return; }
      farm.wave += dt;
      plan.spots.forEach((spot, i) => {
        const a = farm.wave * 0.4 + i * 2.1;
        const r = plan.fly ? 0.9 : 0.25;
        const at = { x: spot.x + Math.cos(a) * r, y: spot.y + (plan.fly ? 0.6 + Math.sin(a * 2.3) * 0.25 : 0), z: spot.z + Math.sin(a * 0.8) * r };
        place(actors[i], at, { ...actors[i].pos }, plan.fly || Math.sin(a * 0.5) > 0.6 ? 'walk' : 'idle');
      });
      stepPace(farm, dt, on);
      return;
    }

    if (plan.kind === 'strip') {
      // A second beast on the strip walks it the other way.
      const [actor, second] = actorsFor(farm, plan.two ? 2 : 1, plan.sprite);
      const length = Math.max(1, Math.hypot(plan.to.x - plan.from.x, plan.to.z - plan.from.z));
      if (!on) {
        place(actor, plan.from, null, 'idle');
        if (plan.two) place(second, plan.to, null, 'idle');
        return;
      }
      const speed = plan.run ? 3 : 1;
      farm.wave = (farm.wave + dt * speed) % (length * 2);
      const along = farm.wave <= length ? farm.wave / length : 2 - farm.wave / length;
      place(actor, lerp(plan.from, plan.to, along), { ...actor.pos }, 'walk');
      if (plan.two) place(second, lerp(plan.from, plan.to, 1 - along), { ...second.pos }, 'walk');
      stepPace(farm, dt, on);
    }
  }

  /** A farm that drops at a steady pace through its part of the day. */
  function stepPace(farm: Farm, dt: number, on: boolean): void {
    const site = farm.site;
    if (!site || !on || farm.view.rate <= 0 || farm.view.id === 'seed' || farm.view.id === 'field') return;
    farm.pace += dt;
    const every = HOURS_SECONDS[site.hours] / farm.view.rate;
    if (farm.pace < every) return;
    farm.pace -= every;
    const actor = farm.actors.find((a) => a.visible);
    spend(farm, actor ? { x: actor.pos.x, y: Math.floor(actor.pos.y), z: actor.pos.z } : undefined);
  }

  // ------------------------------------------------------------------------------------ reading the ground

  function read(): void {
    const sites = readSites(game, taking, lamps);
    for (const farm of farms.values()) farm.site = null;
    for (const site of sites) {
      const farm = farms.get(site.farm);
      if (farm && !farm.site) farm.site = site;
    }
    for (const farm of farms.values()) update(farm);
    quests(sites);
  }

  function update(farm: Farm): void {
    const view = farm.view;
    const site = farm.site;
    const id = view.id;
    if (site?.built && !flags.is(FLAG.farmBuilt(id))) {
      flags.set(FLAG.farmBuilt(id), true);
      events.emit('farm.built', { farm: id });
    }
    view.built = flags.is(FLAG.farmBuilt(id));
    view.away = farm.awayUntil > 0 ? Math.max(0, farm.awayUntil - game.clock.day) : 0;
    view.at = site ? site.center : null;
    view.take = site && farmDef(id).takes && farm.awayUntil === 0 ? site.take : 0;
    if (!site) {
      view.rate = 0; view.tag = ''; view.sub = ''; view.symptom = ''; view.fix = '';
    } else if (farm.awayUntil > 0) {
      view.rate = 0;
      view.tag = `Quiet for ${view.away === 1 ? 'one more day' : `${view.away} more days`}`;
      view.sub = 'You took from it';
      view.symptom = 'The creatures stay away three days after a Take, and the ground there pales.';
      view.fix = 'Leave it be. On Give, they come back when the three days are out.';
    } else if (view.mode === 'take') {
      view.rate = 0;
      view.tag = `Take: ${site.score.tag}`;
      view.sub = 'Ready to take again';
      view.symptom = 'The farm is on Take. It makes nothing until you take again or switch back.';
      view.fix = 'Switch to Give for the steady rate. Only a farm on Give counts for the Heartstone.';
    } else {
      view.rate = site.score.rate;
      view.tag = site.score.tag;
      view.sub = site.score.sub;
      view.symptom = site.score.symptom;
      view.fix = site.score.fix;
    }
    if (view.mode === 'give' && farm.awayUntil === 0 && view.rate > view.best) view.best = view.rate;
    const living = view.built && view.mode === 'give' && farm.awayUntil === 0 && view.rate > 0 && site !== null;
    view.living = living;
    if (flags.get(FLAG.farmLiving(id)) !== living && (living || flags.get(FLAG.farmLiving(id)) !== undefined)) flags.set(FLAG.farmLiving(id), living);
    if (flags.get(FLAG.farmMode(id)) !== view.mode && (view.mode === 'take' || flags.get(FLAG.farmMode(id)) !== undefined)) flags.set(FLAG.farmMode(id), view.mode);
    if (site?.built && view.rate > 0 && hasBook()) sys.almanac?.learn(farmDef(id).page, 'proved');
  }

  /** The quest steps a farm finishes. */
  function quests(sites: readonly Site[]): void {
    const get = (id: FarmId) => farms.get(id) as Farm;
    const machines = sys.machines;
    if (knows('mossling', 'comes')) step('kitchen', 'mosslings');
    if (knows('burrower', 'comes')) step('copper', 'burrower');
    if (flags.is(FLAG.farmBuilt('moss'))) step('kitchen', 'pen');
    if (flags.is(FLAG.farmBuilt('quill'))) step('bench', 'posts');
    if (flags.is(FLAG.farmBuilt('seed'))) step('copper', 'hedge');
    if (get('copper').site?.score.symptom === 'Every burrower comes up in your carrots.') step('copper', 'bait');
    if (flags.is(FLAG.farmBuilt('bee')) && get('bee').view.rate > 0) step('echo', 'bees');
    if (machines?.turning()) step('uphill', 'wheel');
    if (get('spring').view.built && get('spring').view.best > 0) step('uphill', 'pit');
    if (flags.is(FLAG.farmBuilt('pond'))) step('uphill', 'slick');
    if (get('field').view.best > PUMPED_FIELD) step('uphill', 'terrace');
    if (flags.is(FLAG.farmBuilt('rope'))) step('lights', 'hatch');
    if (flags.is(FLAG.farmBuilt('dust'))) step('lights', 'trap');
    if (made.has('sensor') && made.has('switch_lamp')) step('lights', 'sensors');
    const lit = lamps.length + (machines?.parts().filter((p) => p.kind === 'switch_lamp').length ?? 0);
    if (lit >= 6 && get('copper').view.living) step('lights', 'ring');
    const arms = machines?.parts().filter((p) => p.kind === 'harvester_arm' && p.state === 'working') ?? [];
    if (arms.length) step('itself', 'arms');
    // Chutes down the terrace to a collector chest that holds its wheat.
    const chests = machines?.parts().filter((p) => p.kind === 'collector_chest') ?? [];
    const fed = chests.some((chest) => (machines?.chest(chest.id) ?? []).some((s) => s.id === 'wheat') && machines?.parts().some((c) => c.kind === 'chute' && Math.abs(c.x - chest.x) + Math.abs(c.z - chest.z) <= 1));
    if (fed) step('itself', 'chutes');
    void sites;
  }

  function stand(dt: number): void {
    if (flags.get(FLAG.questStep('itself')) !== 'stand') return;
    const field = farms.get('field')?.view.at;
    // Stand back: twenty blocks from the terrace for half a minute while its arms cut and its chutes carry.
    standing = field && distance2d(game.player.pos, field) > 20 ? standing + dt : 0;
    if (standing >= 30) step('itself', 'stand');
  }

  // ------------------------------------------------------------------------------------ give or take

  function setMode(id: FarmId, mode: FarmMode): boolean {
    const farm = farms.get(id);
    const def = farmDef(id);
    if (!farm || !def.takes) return false;
    if (mode === 'take') {
      if (farm.awayUntil > 0 || !farm.site) return false;
      const lump = farm.site.take;
      farm.view.mode = 'take';
      pay(farm, lump);
      farm.awayUntil = game.clock.day + AWAY_DAYS;
      farm.paid = 0;
      farm.carry = 0;
      if (id === 'spring') events.emit('toast', { text: 'The Custodian will not speak to you today.' });
    } else {
      farm.view.mode = 'give';
    }
    if (id === 'copper') flags.set(FLAG.choice('burrowers'), mode);
    if (id === 'spring') flags.set(FLAG.choice('gearlings'), mode);
    events.emit('farm.mode', { farm: id, mode });
    update(farm);
    return true;
  }

  // ------------------------------------------------------------------------------------ hearing the rest

  events.on('day.started', ({ day }) => {
    for (const farm of farms.values()) {
      if (farm.awayUntil > 0 && day >= farm.awayUntil) farm.awayUntil = 0;
      if (farm.site?.hours === 'all') settle(farm);
    }
    // The fox brings what it buried at dawn.
    const seed = farms.get('seed') as Farm;
    if (seed.site && seed.view.rate > 0) pay(seed, seed.view.rate);
    // Bramble roots up his strip each morning, and sheds a tusk tip every third day.
    const plough = farms.get('plough') as Farm;
    const strip = plough.site?.plan;
    if (plough.site && strip?.kind === 'strip') {
      const dx = Math.sign(strip.to.x - strip.from.x), dz = Math.sign(strip.to.z - strip.from.z);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(strip.from.x) + dx * i, z = Math.floor(strip.from.z) + dz * i;
        sys.crops?.till(x, Math.floor(strip.from.y) - 1, z);
      }
      if (tuskDay === 0 || day - tuskDay >= 3) {
        tuskDay = day;
        give(plough, 'tusk_tip', 1, plough.site.drop);
      }
      if (day % 2 === 0) give(plough, 'old_brass', 1, plough.site.drop);
    }
  });

  // A night skipped by sleep runs at once: every farm whose part of the day it was settles now.
  events.on('slept', () => {
    for (const farm of farms.values()) {
      if (farm.site?.hours === 'night') {
        settle(farm);
        // The night's goods were made: the next night starts fresh.
        farm.open = false;
      }
    }
  });

  // Dialogue and the farm panel must make the same choice in the living world.
  events.on('flag.changed', ({flag,value}) => {
    if(flag !== FLAG.choice('burrowers') || (value !== 'give' && value !== 'take')) return;
    if(farms.get('copper')?.view.mode !== value) setMode('copper', value);
  });

  events.on('item.crafted', ({ id }) => void made.add(id));
  events.on('block.placed', ({ x, y, z, id, by }) => {
    if (by === 'player' && id === LAMP) lamps.push({ x, y, z });
  });
  events.on('block.broken', ({ x, y, z }) => {
    const i = lamps.findIndex((l) => l.x === x && l.y === y && l.z === z);
    if (i >= 0) lamps.splice(i, 1);
  });

  // ------------------------------------------------------------------------------------ the api and the step

  const api: FarmsApi = {
    all() {
      return [...farms.values()].map((farm) => farm.view);
    },
    get: (id) => farms.get(id)?.view,
    setMode,
  };

  const system: SimSystem = {
    step(dt) {
      if (!wired && sys.interact) {
        for (const farm of farms.values()) sys.interact.add(farm.target);
        wired = true;
      }
      readIn -= dt;
      if (readIn <= 0) {
        readIn = READ_EVERY;
        read();
      }
      const t = game.clock.timeOfDay;
      const p = game.player.pos;
      for (const farm of farms.values()) {
        const site = farm.site;
        const open = site ? inHours(site.hours, t) : false;
        if (site && site.hours !== 'all' && farm.open && !open) settle(farm);
        farm.open = open;
        play(farm, dt);
        // Watching its creatures fills their page in the field book.
        if (site && hasBook() && farm.actors.some((a) => a.visible && distance2d(p, a.pos) <= WATCH)) {
          farm.watched += dt;
          const page = farmDef(farm.view.id).page;
          if (farm.watched >= COMES_AFTER) sys.almanac?.learn(page, 'comes');
          if (farm.watched >= FEARS_AFTER) sys.almanac?.learn(page, 'fears');
        }
      }
      stand(dt);
    },
    save(): FarmsSave {
      return {
        version: 1,
        farms: [...farms.values()].map((f) => ({ id: f.view.id, mode: f.view.mode, away: f.awayUntil, best: f.view.best, carry: f.carry, paid: f.paid })),
        made: [...made],
        lamps: lamps.map((l) => [l.x, l.y, l.z]),
        tuskDay,
      };
    },
    load(data) {
      const save = data as Partial<FarmsSave> | null;
      for (const saved of save?.farms ?? []) {
        const farm = farms.get(saved.id);
        if (!farm) continue;
        farm.view.mode = saved.mode === 'take' ? 'take' : 'give';
        farm.awayUntil = saved.away ?? 0;
        farm.view.best = saved.best ?? 0;
        farm.carry = saved.carry ?? 0;
        farm.paid = saved.paid ?? 0;
      }
      made.clear();
      for (const id of save?.made ?? []) made.add(id);
      lamps.length = 0;
      for (const [x, y, z] of save?.lamps ?? []) lamps.push({ x, y, z });
      tuskDay = save?.tuskDay ?? 0;
      readIn = 0;
    },
  };

  return { api, system };
}

/** The farm a field book page belongs to, for the page's "Best farm" line. */
export const farmOfPage = (page: string): FarmId | undefined => FARMS.find((farm) => farm.page === page)?.id;

export function install(kernel: Kernel): void {
  const { api, system } = createFarms(kernel.game);
  kernel.add('farms', api, system);
}
