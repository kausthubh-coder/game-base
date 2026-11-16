// The world's fights: the twelve fights of handbook chapter 23 at their places, the night visitors at the fence,
// and the hero's health and stamina. The fight itself is the lab's rules in src/game/fight, fought on a stage made
// from the world where it starts, with no loading screen.
//
//   - A fight is armed while its quest step is open (content/quests.ts) and it is not yet won. It starts when the
//     hero comes near its place (`FIGHTS` in content/greenhollow.ts): the beasts come in where they stand.
//   - The Mark reaches as deep as the Heartstone (`HallApi.heart()`): fight 4's boar does not fight, and the hand
//     held out to it does nothing but say so. That sets `fight.4.denied`. At Heartstone 5 the boar of fight 11 calms.
//   - A beast fight ends won (`fight.<n>.won`), fell (the hero fainted: they wake at the circle's edge) or left
//     (walked out of the circle). A keeper or the Stag keeps what was broken while the hero faints.
//   - After a calm the story goes on: the fox follows the hero (its pact), the thistlehog, the rootsnare and Bramble
//     go home to work (`beast.<kind>.home`), and the gifts go in the bag.
//   - The keepers (7, 9, 10) are fought in their vaults' rooms, which the ruins build: `startKeeper(n, room)`, and the
//     Stag in its hall under the Rootworks: `startStag(x, z)`. Neither starts by itself at the vault's place on the
//     map, whose building is not their room. `begin(n)` fights one in its test room where the hero stands.
//   - About one night in three a Blighted beast, never deeper than the Heartstone, comes to the settlement's fence
//     while the hero is home. Dax on the watch turns it back.
//   - Fight 1 is the first night, played by the Hall: the fox calmed there marks it won.
//
// In the browser a view steps the running fight 60 times a second with the hero's body (`drive(true)`). With no
// view, as in `tools/sim.ts`, this system steps it, and the rule-made player can fight it (`autoplay`).

import type { Actor, FightsApi, FightState, Game, HeroStats, RunningFight, SimSystem } from '../api.sim.ts';
import {
  ACT1_COMPANIONS, ENCOUNTERS, HERO, HERO_STATS, VISITORS, beastOf, encounterOf,
  type Act1Companion, type EncounterDef, type KeeperKind,
} from '../content/fight.ts';
import { FLAG } from '../content/flags.ts';
import { STARTING_GEAR } from '../content/gear.ts';
import { FIGHTS, PLACES, toWorld } from '../content/greenhollow.ts';
import { BLOCKS } from '../../content/blocks.ts';
import { KIT_IDS, type FightNumber, type KitId, type QuestId } from '../content/ids.ts';
import { QUESTS } from '../content/quests.ts';
import type { Stage } from '../fight/arena.sim.ts';
import { createBot, type Bot, type BotLevel } from '../fight/bot.sim.ts';
import { createFight, type Fight, type FightEvent, type FightRecord } from '../fight/fight.sim.ts';
import { hallStage } from '../fight/hall-layout.sim.ts';
import { createKeeper, createKeeperBot, keeperRoom, type Keeper, type KeeperRoom } from '../fight/keepers.sim.ts';
import { createHallBot, createStagHall, type Hall } from '../fight/stag-hall.sim.ts';
import { worldStage } from '../fight/world-stage.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

export interface Fights {
  api: FightsApi;
  system: SimSystem;
}

/** The fight steps at this rate when this system steps it: the hero's body's rate. */
const SUB = 1 / 60;
/** Seconds a won fight goes on being drawn after it ends, for the moment of calming. */
const AFTER_WIN = 3.2;
/** Seconds the hero may stand outside the circle before the fight is left. */
const OUT_FOR = 1.5;
/** Blocks further than `near` the hero must walk before a fight that was left or lost can start again. */
const AWAY = 5;
/** A calmed beast that goes home walks there at this speed, and is taken out of the world once it is this close or this long gone. */
const HOME_SPEED = 3, HOME_NEAR = 4, HOME_MOST = 60;
/** The hero is home when this close to the plot's middle. */
const HOME = 40;

/** Where a fight is fought: its place of the plan, or its map point. */
export function fightPlace(n: number): { x: number; z: number } {
  const f = FIGHTS.find((one) => one.n === n);
  if (!f) throw new Error(`fights: the plan has no place for fight ${n}`);
  if (typeof f.at !== 'string') return toWorld(f.at);
  const p = PLACES.find((one) => one.id === f.at);
  if (!p) throw new Error(`fights: the plan has no place "${f.at}" for fight ${n}`);
  return p.world ?? toWorld(p.at);
}

/** The quest and the steps of it that arm fight n. */
export function armingSteps(n: number): { quest: QuestId; steps: string[] } | null {
  for (const q of QUESTS) {
    const steps = q.steps.filter((s) => s.fight === n).map((s) => s.id);
    if (steps.length > 0) return { quest: q.id, steps };
  }
  return null;
}

interface Save {
  picked?: string | null;
  /** The day of the last night a visitor came, or was tried for. */
  visitDay?: number;
}

/** A calmed beast walking home. */
interface Walker { actor: Actor; to: { x: number; z: number }; t: number }

export function createFights(game: Game): Fights {
  const { flags, events, systems } = game;
  const stats: HeroStats = { health: HERO.health, maxHealth: HERO.health, stamina: HERO.stamina, maxStamina: HERO.stamina };
  const places = new Map<number, { x: number; z: number }>();
  for (const e of ENCOUNTERS) if (e.kind !== 'hall') places.set(e.n, fightPlace(e.n));
  const arming = new Map<number, { quest: QuestId; steps: string[] }>();
  for (const e of ENCOUNTERS) { const a = armingSteps(e.n); if (a) arming.set(e.n, a); }

  let running: Running | null = null;
  let byView = false;
  let autoLevel: BotLevel | null = null;
  let picked: string | null = null;
  /** Fights the hero walked out of or fainted in: they wait until the hero has walked away. */
  const waiting = new Set<number>();
  const walkers: Walker[] = [];
  let visitDay = 0;
  let visitor: { kind: string; depth: number; x: number; z: number; t: number; actor: Actor } | null = null;
  /** Seconds after night falls before tonight's visitor comes, or -1 for none tonight. */
  let visitIn = -1;
  const states: FightState[] = ENCOUNTERS.map((e) => ({ n: e.n, armed: false, won: false, denied: false, at: places.get(e.n) ?? { x: 0, z: 0 } }));

  // ------------------------------------------------------------------ the hero's numbers

  function heroStats(): HeroStats {
    const gear = systems.bench?.gear() ?? STARTING_GEAR;
    let hearts = flags.get(FLAG.mealDay) === game.clock.day ? 1 : 0, pieces = 0;
    for (const p of PLACES) {
      if (p.kind !== 'shrine') continue;
      const pick = flags.get(`shrine.${p.id}`);
      if (pick === 'heart') hearts++;
      else if (pick === 'stamina') pieces++;
    }
    stats.maxHealth = HERO.health + (HERO_STATS.armor[gear.armor - 1] ?? 0) + HERO_STATS.heart * hearts;
    stats.maxStamina = HERO.stamina + HERO_STATS.staminaPiece * pieces;
    const f = running?.fight;
    stats.health = f ? f.hero.health : stats.maxHealth;
    stats.stamina = f ? f.hero.stamina : stats.maxStamina;
    return stats;
  }

  const heartstone = (): number => systems.hall?.heart().level ?? (Number(flags.get(FLAG.heartstone)) || 0);

  // ------------------------------------------------------------------ companions

  /** The companions the hero has, in the order the story brings them. */
  function companions(): Act1Companion[] {
    const have: Act1Companion[] = [];
    if (flags.is(FLAG.scene(18)) || flags.is(FLAG.questDone('kitchen'))) have.push('dax');
    if (flags.is(FLAG.scene(20)) || flags.is(FLAG.questDone('greywood'))) have.push('wren');
    if (flags.is(FLAG.fightWon(3)) || flags.is(FLAG.questDone('greywood'))) have.push('fox');
    if (flags.is(FLAG.fightWon(12))) have.push('stagling');
    return have;
  }

  /** Who comes into fight `def`: who the story puts there, else the one picked, else the first the hero has. */
  function companionFor(def: EncounterDef | null): string {
    const have = companions();
    if (def?.companion) return def.companion;
    if (picked && (have as string[]).includes(picked)) return picked;
    return have[have.length > 2 ? 2 : 0] ?? 'dax';
  }

  // ------------------------------------------------------------------ the ground

  /**
   * The world as a fight's stage reads it. Rises are walls and water is water, and a block a body bumps into where
   * the hero would stand (a tree's trunk, a post, a wall) is solid.
   */
  function ground(): Parameters<typeof worldStage>[0] {
    const world = game.world;
    const solidAt = (x: number, y: number, z: number): boolean => BLOCKS[world.getBlock(x, y, z)]?.solid === true;
    return {
      // A chunk the view has not loaded yet is made now, so the stage never reads empty ground.
      height: (x, z) => { if (!world.chunkAt(x >> 4, z >> 4)) world.load(x >> 4, z >> 4); return world.heightAt(x, z); },
      water: (x, z) => world.surfaceAt(x, z) === 'water',
      blocked: (x, z) => { const y = world.heightAt(x, z); return solidAt(x, y, z) || solidAt(x, y + 1, z); },
    };
  }

  // ------------------------------------------------------------------ a fight running

  interface Running extends RunningFight {
    n: FightNumber | 0;
    def: EncounterDef | null;
    fight: Fight;
    stage: Stage;
    keeper: Keeper | null;
    hall: Hall | null;
    over: number;
    result: 'won' | 'fell' | 'left' | null;
    bot: Bot | null;
    out: number;
    /** The hero fainted at this second of the fight, in a beast fight: it ends as fell once they are up. */
    fell: number;
    kind: string;
  }

  function start(n: FightNumber | 0, def: EncounterDef | null, stage: Stage, foes: { kind: string; depth?: number; passive?: boolean }[], keeper: KeeperKind | 'stag' | null, room: KeeperRoom | null, kind = ''): Running {
    const gear = systems.bench?.gear() ?? STARTING_GEAR;
    heroStats();
    const onEnd = (record: FightRecord): void => { if (record.result === 'calmed' && run.result === null) win(run); };
    const fight = createFight(stage, {
      way: 'hero', weapon: gear.weapon, companion: companionFor(def), reach: heartstone(), stats: { maxHealth: stats.maxHealth, maxStamina: stats.maxStamina },
      gear: { tier: gear.tier, fitting: gear.fitting }, kit: kitFor(gear.kit), plates: true, external: byView, random: () => game.random(), onEnd,
    });
    const run: Running = {
      n, def, fight, stage, keeper: null, hall: null, over: -1, result: null, bot: null, out: 0, fell: -1, kind,
      line: def?.line ?? 'It tests your fence.',
      step: (dt) => stepRunning(run, dt),
    };
    if (keeper === 'stag') {
      run.hall = createStagHall(fight, stage as ReturnType<typeof hallStage>, { random: () => game.random(), onEnd });
    } else if (keeper) {
      run.keeper = createKeeper(keeper, fight, room ?? keeperRoom(keeper, Math.floor(stage.center.x), Math.floor(stage.center.z)), { random: () => game.random(), onEnd });
    } else {
      fight.bringAll(foes);
    }
    // The hero fights from where they stand, or from the edge when they came in from outside the circle.
    const p = game.player.pos, inside = stage.inside(p.x, p.z) && !stage.solid(p.x, p.z);
    fight.placeHero(inside ? p.x : stage.start.x, inside ? p.z : stage.start.z);
    running = run;
    setBot(run);
    if (n) events.emit('fight.started', { fight: n });
    return run;
  }

  /** Kit things from the bag that went into this fight's slots: each one used comes out of the bag. */
  const fromBag: KitId[] = [];

  /**
   * The kit's three slots: what the bench put there, and an empty slot filled with a kit thing the bag holds, so a
   * quill strip made before the lynx is in hand for it.
   */
  function kitFor(slots: readonly (KitId | null)[]): (KitId | null)[] {
    const kit = [...slots];
    fromBag.length = 0;
    // Explicitly equipped things still belong to the bag and are consumed on placement.
    for (const id of kit) if (id !== null) fromBag.push(id);
    for (const id of KIT_IDS) {
      const have = (systems.inventory?.count(id) ?? 0) - kit.filter((k) => k === id).length;
      for (let i = 0; i < have; i++) {
        const free = kit.indexOf(null);
        if (free < 0) return kit;
        kit[free] = id;
        fromBag.push(id);
      }
    }
    return kit;
  }

  function setBot(run: Running): void {
    if (!autoLevel) { run.bot = null; return; }
    if (run.keeper) run.bot = createKeeperBot(run.fight, run.keeper);
    else if (run.hall) run.bot = createHallBot(run.fight, run.hall);
    else if (run.def?.kind === 'denial') run.bot = denialBot(run);
    else run.bot = createBot(run.fight, run.stage, { level: autoLevel, random: () => game.random() });
  }

  /** Fight 4's player: walk up to the boar and hold out the Mark. */
  function denialBot(run: Running): Bot {
    return {
      step() {
        const f = run.fight, b = f.beasts[0], input = f.input;
        input.moveX = input.moveZ = 0;
        input.calmHeld = false;
        if (!b) return;
        const dx = b.x - f.hero.x, dz = b.z - f.hero.z, d = Math.hypot(dx, dz);
        if (d - b.def.radius > HERO.calm.reach - 1) { input.moveX = dx / d; input.moveZ = dz / d; return; }
        input.calmHeld = true;
      },
    };
  }

  function begin(n: FightNumber, where?: { x: number; z: number }): boolean {
    const def = encounterOf(n);
    if (def.kind === 'hall' || running) return false;
    // A keeper's test room or the Stag's hall stands where the hero is; a beast fight is at its place.
    const here = { x: game.player.pos.x, z: game.player.pos.z - 4 };
    const at = where ?? (def.kind === 'keeper' || def.kind === 'stag' ? here : (places.get(n) as { x: number; z: number }));
    if (def.kind === 'keeper') {
      const kind = def.keeper as KeeperKind;
      const room = keeperRoom(kind, Math.floor(at.x), Math.floor(at.z));
      start(n, def, room.stage, [], kind, room);
      return true;
    }
    if (def.kind === 'stag') {
      start(n, def, hallStage(Math.floor(at.x), Math.floor(at.z)), [], 'stag', null);
      return true;
    }
    let stage = worldStage(ground(), { x: at.x + 0.5, z: at.z + 0.5, radius: def.radius, from: { x: game.player.pos.x, z: game.player.pos.z } });
    // A rooted beast cannot walk off an isolated rock pad. Use the same
    // traversable approach as the hero when the nominal den has no route.
    if (def.foes.some((foe) => beastOf(foe.kind).rooted) && systems.nav) {
      const to = { ...stage.den, y: game.world.heightAt(Math.floor(stage.den.x), Math.floor(stage.den.z)) };
      if (!systems.nav.path(game.player.pos, to, 20000)) {
        const route = systems.nav.toward(game.player.pos, to, 20000);
        const den = route?.filter((point) => stage.inside(point.x, point.z) && !stage.solid(point.x, point.z)).sort((a, b) => Math.hypot(a.x - to.x, a.z - to.z) - Math.hypot(b.x - to.x, b.z - to.z))[0];
        if (den && stage.inside(den.x, den.z) && !stage.solid(den.x, den.z)) stage = { ...stage, den: { x: den.x, z: den.z } };
      }
    }
    start(n, def, stage, def.foes.map((f) => ({ ...f, passive: def.kind === 'denial' })), null, null);
    return true;
  }

  function startStag(x: number, z: number): boolean {
    if (running || flags.is(FLAG.fightWon(12))) return false;
    return begin(12, { x, z });
  }

  function startKeeper(n: 7 | 9 | 10, room: KeeperRoom): boolean {
    if (running) return false;
    const def = encounterOf(n);
    if (def.keeper !== room.kind || flags.is(FLAG.fightWon(n))) return false;
    start(n, def, room.stage, [], room.kind, room);
    return true;
  }

  /** What the world does with what happened in a step of the fight. */
  function hear(run: Running, e: FightEvent): void {
    const n = run.n;
    if (e.type === 'beyond' && n) {
      events.emit('fight.denied', { fight: n, depth: e.n, heartstone: heartstone() });
      if (run.def?.kind === 'denial' && !flags.is(FLAG.fightDenied(n))) {
        flags.set(FLAG.fightDenied(n), true);
        end(run, 'left');
      }
    }
    if (e.type === 'faint' && !run.keeper && !run.hall) run.fell = run.fight.clock;
    // A kit thing from the bag is used up.
    const used = e.type === 'salve' ? 'salve' : e.type === 'rigPlaced' ? e.text : '';
    const at = fromBag.indexOf(used as KitId);
    if (at >= 0) { fromBag.splice(at, 1); systems.inventory?.remove(used as KitId, 1); }
  }

  function stepRunning(run: Running, dt: number): void {
    run.bot?.step(dt);
    run.fight.step(dt);
    if (run.keeper) {
      run.keeper.step(dt);
      run.keeper.events.length = 0;
    }
    if (run.hall) {
      run.hall.step(dt);
      for (const e of run.hall.events) if (e.type === 'phase' && run.n) flags.set(FLAG.fightPhase(run.n), Math.max(Number(flags.get(FLAG.fightPhase(run.n))) || 0, e.n));
      run.hall.events.length = 0;
    }
    for (let i = 0; i < run.fight.events.length; i++) hear(run, run.fight.events[i] as FightEvent);
    if (run.over >= 0) { run.over += dt; return; }
    // A hero who fainted in a beast fight is up again at the edge: it ends as fell.
    if (run.fell >= 0 && run.fight.hero.act !== 'faint') { end(run, 'fell'); return; }
    // Out of the circle for a moment: left.
    const h = run.fight.hero;
    if (!run.stage.inside(h.x, h.z) && h.act !== 'faint') {
      run.out += dt;
      if (run.out >= OUT_FOR) end(run, 'left');
    } else {
      run.out = 0;
    }
  }

  function win(run: Running): void {
    run.result = 'won';
    run.over = 0;
    const n = run.n, def = run.def;
    if (n) {
      if (n === 12) flags.set(FLAG.fightPhase(12), 3);
      flags.set(FLAG.fightWon(n), true);
      events.emit('fight.ended', { fight: n, result: 'won' });
    }
    for (const g of def?.gifts ?? (run.n === 0 ? [VISITORS.gift] : [])) systems.inventory?.add(g.item, g.count);
    const kind = run.kind || def?.foes[0]?.kind || '';
    if (def?.after === 'home' && kind) {
      flags.set(FLAG.beastHome(kind), true);
      for (const b of run.fight.beasts) walkHome(b.def.kind, b.x, b.z);
    }
    if (def?.after === 'follows') {
      // The fox's pact: the fox calmed on the first night comes to the hero's side.
      const fox = systems.pets?.all().find((p) => p.kind === 'leaftail' && !p.bonded);
      if (fox) systems.pets?.bond?.(fox.id);
    }
  }

  function end(run: Running, result: 'fell' | 'left'): void {
    run.result = result;
    // The boar of fight 4 turns away while the moment is seen; anything else goes at once.
    run.over = run.def?.kind === 'denial' ? 0 : AFTER_WIN;
    if (run.n) {
      events.emit('fight.ended', { fight: run.n, result });
      waiting.add(run.n);
    }
    if (run.n === 0 && visitor) removeVisitor();
  }

  /** A calmed beast walks home to the plot, and is taken out of the world when it gets there. */
  function walkHome(kind: string, x: number, z: number): void {
    const to = places.get(2) ?? { x: 0, z: 0 };
    const sprite = kind === 'boar' ? 'boar-calmed' : kind === 'thistlehog' ? 'thistlehog-calmed' : kind === 'rootsnare' ? 'rootsnare-calmed' : kind;
    const actor: Actor = { id: `fight:home:${kind}:${walkers.length}`, sprite, pos: { x, y: game.world.heightAt(x, z), z }, facing: 0, anim: 'walk', visible: true, mark: 'heart' };
    game.actors.set(actor.id, actor);
    walkers.push({ actor, to, t: 0 });
  }

  function stepWalkers(dt: number): void {
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i] as Walker, p = w.actor.pos, dx = w.to.x - p.x, dz = w.to.z - p.z, d = Math.hypot(dx, dz);
      w.t += dt;
      if (d < HOME_NEAR || w.t > HOME_MOST) { game.actors.delete(w.actor.id); walkers.splice(i, 1); continue; }
      const step = Math.min(d, HOME_SPEED * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      p.y = game.world.heightAt(p.x, p.z);
      w.actor.facing = Math.atan2(dx, -dz);
      if (w.t > 3) w.actor.mark = '';
    }
  }

  // ------------------------------------------------------------------ arming

  function armed(n: number): boolean {
    const def = encounterOf(n);
    if (def.kind === 'hall') return false;
    if (flags.is(FLAG.fightWon(n as FightNumber)) || (def.kind === 'denial' && flags.is(FLAG.fightDenied(n as FightNumber)))) return false;
    const a = arming.get(n);
    if (!a) return false;
    if (!flags.is(FLAG.questStarted(a.quest)) || flags.is(FLAG.questDone(a.quest))) return false;
    return a.steps.includes(String(flags.get(FLAG.questStep(a.quest)) ?? ''));
  }

  const dark = (): boolean => game.clock.timeOfDay >= 0.75 || game.clock.timeOfDay < 0.25;

  function lookForFights(): void {
    const p = game.player.pos;
    for (const s of states) {
      s.won = flags.is(FLAG.fightWon(s.n));
      s.denied = flags.is(FLAG.fightDenied(s.n));
      s.armed = armed(s.n);
      const def = encounterOf(s.n);
      const d = Math.hypot(p.x - s.at.x, p.z - s.at.z);
      if (waiting.has(s.n) && d > def.near + AWAY) waiting.delete(s.n);
      if (!s.armed || running || waiting.has(s.n) || game.player.busy) continue;
      if (def.night && !dark()) continue;
      // A keeper and the Stag wait in their rooms for the ruins to start them.
      if (def.kind === 'keeper' || def.kind === 'stag') continue;
      if (d <= def.near) begin(s.n);
    }
  }

  // ------------------------------------------------------------------ night visitors

  function plot(): { x: number; z: number } {
    return places.get(2) ?? { x: 0, z: 0 };
  }

  function stepVisitors(dt: number): void {
    const home = plot(), p = game.player.pos;
    if (visitIn >= 0) {
      visitIn -= dt;
      if (visitIn < 0) comeToFence();
    }
    if (!visitor) return;
    visitor.t += dt;
    const near = Math.hypot(p.x - visitor.x, p.z - visitor.z);
    if (!running && near < 9 && !game.player.busy) {
      const stage = worldStage(ground(), { x: visitor.x, z: visitor.z, radius: 12, from: { x: p.x, z: p.z } });
      const kind = visitor.kind;
      visitor.actor.visible = false;
      start(0, null, stage, [{ kind, depth: visitor.depth }], null, null, kind);
      return;
    }
    // It goes back into the dark at dawn, or after a while at the fence, or when the hero is far from home.
    if (!dark() || visitor.t > VISITORS.stays || Math.hypot(p.x - home.x, p.z - home.z) > HOME * 2) removeVisitor();
  }

  function comeToFence(): void {
    const home = plot(), p = game.player.pos;
    // Never while the hero is away, and Dax on the watch turns it back at the fence.
    if (Math.hypot(p.x - home.x, p.z - home.z) > HOME || flags.get(FLAG.job('dax')) === 'watch') return;
    const reach = heartstone();
    const can = VISITORS.kinds.filter((k) => beastOf(k).depth <= reach);
    if (can.length === 0) return;
    const kind = can[Math.floor(game.random() * can.length)] as string;
    const turn = game.random() * Math.PI * 2;
    const x = home.x + Math.sin(turn) * VISITORS.fence, z = home.z - Math.cos(turn) * VISITORS.fence;
    const sprite = kind === 'fox' ? 'fox-blighted' : kind === 'thistlehog' ? 'thistlehog-blighted' : kind;
    const actor: Actor = { id: 'fight:visitor', sprite, pos: { x, y: game.world.heightAt(x, z), z }, facing: Math.atan2(home.x - x, -(home.z - z)), anim: 'idle', visible: true, mark: 'alert' };
    game.actors.set(actor.id, actor);
    visitor = { kind, depth: beastOf(kind).depth, x, z, t: 0, actor };
  }

  function removeVisitor(): void {
    if (visitor) game.actors.delete(visitor.actor.id);
    visitor = null;
  }

  events.on('night.started', ({ day }) => {
    if (day <= visitDay) return;
    visitDay = day;
    // The settlement has to have begun: the Heartstone was seen.
    if (heartstone() < 1) return;
    visitIn = game.random() < VISITORS.chance ? VISITORS.after : -1;
  });

  // Fight 1 is the Hall's first night: the fox calmed there is the fight won.
  events.on('flag.changed', ({ flag, value }) => {
    if (flag === 'fox.calmed' && value === true && !flags.is(FLAG.fightWon(1))) flags.set(FLAG.fightWon(1), true);
  });

  // ------------------------------------------------------------------ the system

  const api: FightsApi = {
    hero: heroStats,
    active: () => (running && running.result === null && running.n ? running.n : null),
    states: () => states,
    running: () => running,
    drive(on) { byView = on; },
    begin,
    startKeeper,
    startStag,
    leave() { if (running && running.result === null) end(running, 'left'); },
    companions,
    companion: () => companionFor(null),
    pick(kind) {
      if (!(ACT1_COMPANIONS as readonly string[]).includes(kind) || !(companions() as string[]).includes(kind)) return false;
      picked = kind;
      return true;
    },
    autoplay(level) {
      autoLevel = level;
      if (running) setBot(running);
    },
    visitor: () => (visitor ? { kind: visitor.kind, depth: visitor.depth, x: visitor.x, z: visitor.z } : null),
  };

  const system: SimSystem = {
    step(dt) {
      stepWalkers(dt);
      stepVisitors(dt);
      const run = running;
      if (run) {
        // Its flag was set some other way (skipTo, the act's stub play): it ends quietly.
        if (run.n && run.result === null && (flags.is(FLAG.fightWon(run.n)) || (run.def?.kind === 'denial' && flags.is(FLAG.fightDenied(run.n))))) {
          run.result = 'won';
          run.over = AFTER_WIN;
        }
        if (!byView) {
          const p = game.player.pos;
          for (let t = 0; t < dt - 1e-9; t += SUB) {
            // With nobody playing it, the hero is wherever the player's body is.
            if (!run.bot) run.fight.placeHero(p.x, p.z);
            run.step(SUB);
            run.fight.events.length = 0;
          }
          if (run.bot) {
            // The rule-made player moves the hero: the body goes where the fight has them.
            const h = run.fight.hero;
            p.x = h.x;
            p.z = h.z;
            p.y = game.world.heightAt(h.x, h.z);
          }
        }
        if (run.over >= AFTER_WIN) running = null;
        return;
      }
      lookForFights();
    },
    save(): Save {
      return { picked, visitDay };
    },
    load(data) {
      const s = (data ?? {}) as Save;
      picked = typeof s.picked === 'string' ? s.picked : null;
      visitDay = typeof s.visitDay === 'number' ? s.visitDay : 0;
      running = null;
      visitIn = -1;
      removeVisitor();
      waiting.clear();
    },
  };
  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createFights(kernel.game);
  kernel.add('fights', api, system);
}
