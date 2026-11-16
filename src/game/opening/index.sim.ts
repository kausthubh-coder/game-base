// The opening of act 1 as rules: grant day at Saltgate, from waking in the bunk room to the ferry pushing off,
// then the landing. Quest `grantday`'s steps are done by playing here (handbook chapter 27, quest 1):
//
//   film       story.opening        the film played or was skipped (`filmDone`, from the opening's view)
//   wake       scene.1              Hobb wakes you; the mirror by your bunk is where you pick your look
//   breakfast  step.grantday.breakfast, meal.day   Hobb's porridge on the kitchen table
//   lock       scene.2              Dax and the last lock
//   map        scene.3              Mina and the map wall
//   rack       choice.weapon        the rack in the yard: sword, bow or staff
//   spar       scene.4              safe weapon practice: real hits empty the crate lid's guard
//   deed       scene.5, hero.name   the grant; the deed is signed in a panel as the scene ends
//   quay       scene.6              Hobb and Dax at the berth
//   river      step.grantday.river  the day up the river, which the view plays; then scene 7 at the landing
//
// The scenes are the story director's (src/game/story): it starts `scene.<n>` as the player comes near the place
// the scene names, `saltgate.bunks`, `saltgate.locks` and so on, and this system answers where those are by
// wrapping the region's `place`. The bout is this system's: Dax's "Go on. Hit me" (`scene.4.before`) starts it as
// the rack's choice ends, and its end (`grantday.bout`, content/opening.ts) ends scene 4. Walking up to someone plays
// their walk-up line through the talk system. Saltgate's land is ./land.sim.ts; its people are actors this system
// places, and while the director stands someone in for a scene, this system's own stands aside. It implements
// `OpeningApi`.
import type { Vec3 } from '../../engine/types.ts';
import type { Actor, Game, HeroLook, Interactable, NpcId, OpeningApi, OpeningAsk, OpeningStage, RunningFight, SimSystem } from '../api.sim.ts';
import { weaponOf } from '../content/fight.ts';
import { STARTING_GEAR } from '../content/gear.ts';
import { FLAG } from '../content/flags.ts';
import { PLACE_SPOTS, TALK } from '../content/opening.ts';
import { CROWD, PEOPLE, SPOTS, type SpotId } from '../content/saltgate.ts';
import type { Kernel } from '../kernel.sim.ts';
import { createFight, type Target } from '../fight/fight.sim.ts';
import { worldStage } from '../fight/world-stage.sim.ts';
import { inSaltgate as inLand, saltgateAt } from './land.sim.ts';

/** The order of grant day's steps, as quest `grantday` lists them. */
export const STEPS = ['film', 'wake', 'breakfast', 'lock', 'map', 'rack', 'spar', 'deed', 'quay', 'river'] as const;
export type GrantStep = (typeof STEPS)[number] | 'done';

/** Guard pips: three quick weapon hits empty the lid, or fewer stronger held moves. */
export const GUARD = 3;
/** How close the hero must stand to a thing to be offered it, and to a person: across a table will do. */
const REACH = 2.2, TALK_REACH = 3.2;
/** The longest name the deed takes. */
export const NAME_MAX = 20;
/** Saltgate's clock stands still in the morning however long grant day takes, so the river only moves it on. */
export const MORNING_HOLD = 0.33;
/** The landing is reached in the afternoon, with light left to dig a ditch and pitch a tent before dark. */
export const LANDING_TIME = 0.4;

const LOOKS: readonly HeroLook[] = ['a', 'b', 'c', 'd'];

type Who = keyof typeof PEOPLE;

/** Where each of the guild's people stands at each step, in the quarter's grid, and the way they face. */
const PLACES: Record<Who, Partial<Record<GrantStep, readonly [x: number, z: number, facing: number]>>> = {
  hobb: { film: [26.4, 10, Math.PI / 4], wake: [26.4, 10, Math.PI / 4], breakfast: [19.4, 8.2, -Math.PI / 2], lock: [19.4, 8.2, -Math.PI / 2], map: [19.4, 8.2, -Math.PI / 2], rack: [19.4, 8.2, -Math.PI / 2], spar: [20, 20.4, Math.PI * 0.75], deed: [36.6, 24.4, Math.PI / 2], quay: [49.6, 62.6, Math.PI] },
  dax: { film: [40.6, 13.4, -Math.PI / 2], wake: [40.6, 13.4, -Math.PI / 2], breakfast: [40.6, 13.4, -Math.PI / 2], lock: [40.6, 13.4, -Math.PI / 2], map: [30.6, 24.5, -Math.PI / 2], rack: [30.6, 24.5, -Math.PI / 2], spar: [30.6, 24.5, -Math.PI / 2], deed: [32.4, 26.4, Math.PI / 2], quay: [53.4, 62.6, Math.PI] },
  mina: { film: [39, 6.6, 0], wake: [39, 6.6, 0], breakfast: [39, 6.6, 0], lock: [39, 6.6, 0], map: [39, 6.6, 0], rack: [39, 7, Math.PI], spar: [39, 7, Math.PI], deed: [39, 7, Math.PI] },
  guildmaster: { film: [41.2, 22, -Math.PI / 2], wake: [41.2, 22, -Math.PI / 2], breakfast: [41.2, 22, -Math.PI / 2], lock: [41.2, 22, -Math.PI / 2], map: [41.2, 22, -Math.PI / 2], rack: [41.2, 22, -Math.PI / 2], spar: [41.2, 22, -Math.PI / 2], deed: [41.2, 22, -Math.PI / 2] },
};

/** Whose scene each step is: they carry the quest mark. */
const MOMENTS: Partial<Record<GrantStep, Who>> = { lock: 'dax', map: 'mina', spar: 'dax', deed: 'guildmaster', quay: 'hobb' };
/** The director's stand-ins for a scene's cast are `stage:<who>` (src/game/story/scenes.sim.ts). */
const STAND_IN = 'stage:';
/** Set when the bout begins, so the story director does not also play scene 4's narrated bout. */
const BOUT_SEEN = 'story.seen.scene.4';

export interface Opening {
  api: OpeningApi;
  system: SimSystem;
}

export function createOpening(game: Game): Opening {
  const { events, flags, player } = game;
  const talk = () => game.systems.talk;

  let asking: OpeningAsk | null = null;
  let boutOn = false, guard = GUARD;
  let practice: RunningFight | null = null, lid: Target | null = null, byView = false;
  let introDue = false;
  let joined = false;
  let lastStage: OpeningStage | null = null;
  const actors = new Map<string, Actor>();

  const spot = (id: SpotId): Vec3 => saltgateAt(SPOTS[id].x, SPOTS[id].z);
  const here = (at: Vec3): boolean => inLand(at.x, at.z);

  /** Grant day's open step, worked out from the flags as quest `grantday` does, so it holds across a load. */
  function step(): GrantStep {
    if (!flags.is(FLAG.opening)) return 'film';
    if (!flags.is(FLAG.scene(1))) return 'wake';
    if (!flags.is(FLAG.step('grantday', 'breakfast'))) return 'breakfast';
    if (!flags.is(FLAG.scene(2))) return 'lock';
    if (!flags.is(FLAG.scene(3))) return 'map';
    if (!flags.get(FLAG.choice('weapon'))) return 'rack';
    if (!flags.is(FLAG.scene(4))) return 'spar';
    if (!flags.is(FLAG.scene(5))) return 'deed';
    if (!flags.is(FLAG.scene(6))) return 'quay';
    if (!flags.is(FLAG.step('grantday', 'river'))) return 'river';
    return 'done';
  }

  function stage(): OpeningStage {
    const now = step();
    return now === 'film' ? 'film' : now === 'river' ? 'ferry' : now === 'done' ? 'landed' : 'saltgate';
  }

  const say = (id: string, npc?: NpcId): void => {
    if (!player.busy) talk()?.start(id, npc);
  };
  const ask = (what: OpeningAsk): void => {
    asking = what;
    player.busy = true;
    events.emit('opening.ask', { ask: what });
  };
  const close = (): void => {
    asking = null;
    // A conversation may have opened since; leave its hold on the player alone.
    player.busy = talk()?.active ?? false;
  };

  function startPractice(savedGuard?: number): void {
    const [x, z] = PLACES.dax.spar!;
    const at = saltgateAt(x, z);
    const stage = worldStage({ height: (x, z) => game.world.heightAt(x, z), water: () => false }, { x: at.x, z: at.z, radius: 18, from: player.pos });
    const gear = game.systems.bench?.gear() ?? STARTING_GEAR;
    const fight = createFight(stage, { way: 'hero', weapon: gear.weapon, external: true, kit: [], random: () => game.random() });
    const full = GUARD * weaponOf(gear.weapon).quick.guard;
    const target = fight.addTarget({ x: at.x, z: at.z, radius: 0.5, guard: full, name: 'Dax\'s crate lid', high: true });
    lid = target;
    if (savedGuard !== undefined) target.guard = Math.max(0, Math.min(full, savedGuard));
    guard = Math.ceil(GUARD * target.guard / full);
    boutOn = guard > 0;
    fight.placeHero(player.pos.x, player.pos.z);
    practice = {
      n: 0, practice: true, fight, stage, keeper: null, hall: null, over: -1,
      line: `${weaponOf(gear.weapon).name}: aim at Dax's lid. Click or tap Use; hold and release for a stronger move.`,
      step(dt) {
        if (practice?.fight !== fight || !boutOn || player.busy) return;
        fight.step(dt);
        guard = Math.ceil(GUARD * target.guard / full);
        for (const event of fight.events) if (event.type === 'targetHit') events.emit('opening.swing', { landed: true, guard });
        // The view releases the hero before the opening starts Dax's closing conversation.
        if (target.broken) boutOn = false;
      },
    };
  }

  // ------------------------------------------------------------------------------------ the people

  function placePeople(): void {
    const now = step();
    const inTown = stage() === 'saltgate' || stage() === 'film';
    for (const who of Object.keys(PEOPLE) as Who[]) {
      const def = PEOPLE[who];
      const at = PLACES[who][now];
      let actor = actors.get(def.id);
      if (!inTown || !at || game.actors.has(STAND_IN + def.npc)) {
        if (actor) actor.visible = false;
        continue;
      }
      if (!actor) {
        actor = { id: def.id, sprite: def.sprite, pos: saltgateAt(at[0], at[1]), facing: at[2], anim: 'idle', visible: true };
        actors.set(def.id, actor);
        game.actors.set(def.id, actor);
      }
      const want = saltgateAt(at[0], at[1]);
      actor.pos.x = want.x; actor.pos.y = want.y; actor.pos.z = want.z;
      actor.facing = at[2];
      actor.visible = true;
      actor.mark = who === 'dax' && boutOn ? '' : MOMENTS[now] === who ? 'quest' : 'talk';
    }
    CROWD.forEach((c, i) => {
      const id = `saltgate:crowd:${i}`;
      let actor = actors.get(id);
      const show = inTown && (c.when === 'always' || now === 'deed');
      if (!actor) {
        if (!show) return;
        actor = { id, sprite: c.sprite, pos: saltgateAt(c.x, c.z), facing: c.facing, anim: 'idle', visible: true };
        actors.set(id, actor);
        game.actors.set(id, actor);
      }
      actor.visible = show;
    });
  }

  // ------------------------------------------------------------------------------------ what you walk up to

  const person = (who: Who): Vec3 => actors.get(PEOPLE[who].id)?.pos ?? saltgateAt(0, 0);
  const shown = (who: Who): boolean => actors.get(PEOPLE[who].id)?.visible ?? false;

  /** Their walk-up line, which the talk system picks; the scenes start by themselves as the player comes near. */
  function talkTo(who: Who): void {
    if (!player.busy) talk()?.talkTo(PEOPLE[who].npc);
  }

  const targets: Interactable[] = [
    ...(Object.keys(PEOPLE) as Who[]).map((who): Interactable => ({
      id: `saltgate:talk:${who}`,
      pos: () => person(who),
      radius: TALK_REACH,
      prompt: () => {
        if (stage() !== 'saltgate' || !shown(who) || (who === 'dax' && boutOn)) return null;
        return `Talk to ${PEOPLE[who].name}`;
      },
      act: () => talkTo(who),
    })),
    {
      id: 'saltgate:mirror',
      pos: () => spot('mirror'),
      radius: REACH,
      prompt: () => (stage() === 'saltgate' && step() !== 'wake' ? 'Look in the mirror' : null),
      act: () => ask('mirror'),
    },
    {
      id: 'saltgate:porridge',
      pos: () => spot('porridge'),
      radius: REACH,
      prompt: () => (step() === 'breakfast' ? 'Eat Hobb\'s porridge' : null),
      act: () => say(TALK.porridge),
    },
    {
      id: 'saltgate:rack',
      pos: () => spot('rack'),
      radius: REACH,
      prompt: () => (step() === 'rack' ? 'Take a weapon from the rack' : null),
      act: () => say(TALK.rack),
    },
  ];

  function join(): void {
    const interact = game.systems.interact;
    if (!interact || joined) return;
    for (const target of targets) interact.add(target);
    joined = true;
  }

  // ------------------------------------------------------------------------------------ what a conversation leaves

  events.on('talk.ended', ({ conversation }) => {
    if (conversation === TALK.porridge) {
      flags.set(FLAG.mealDay, game.clock.day);
      flags.set(FLAG.step('grantday', 'breakfast'), true);
    } else if (conversation === TALK.rack && flags.get(FLAG.choice('weapon')) && !flags.is(FLAG.scene(4))) {
      // Dax is waiting with his crate lid.
      flags.set(BOUT_SEEN, true);
      talk()?.start(TALK.spar);
    } else if (conversation === TALK.spar) {
      startPractice();
      events.emit('hint', { id: 'opening.bout', text: 'Aim at Dax\'s crate lid. Click or tap Use to attack; hold and release for a stronger move. Shift or Dodge steps aside.' });
    } else if (conversation === 'scene.5' && !flags.get(FLAG.heroName)) {
      ask('deed');
    }
    placePeople();
  });

  // ------------------------------------------------------------------------------------ the api

  const api: OpeningApi = {
    stage,
    hero: () => {
      const look = flags.get(FLAG.heroLook);
      return { name: String(flags.get(FLAG.heroName) ?? ''), look: LOOKS.includes(look as HeroLook) ? (look as HeroLook) : 'a' };
    },
    filmDone() {
      flags.set(FLAG.opening, true);
    },
    asking: () => asking,
    setLook(look) {
      if (!LOOKS.includes(look)) return;
      flags.set(FLAG.heroLook, look);
      if (asking === 'mirror') close();
      if (!flags.is(FLAG.scene(1)) && flags.is(FLAG.opening)) {
        flags.set(FLAG.scene(1), true);
        events.emit('scene.played', { scene: 1 });
      }
    },
    sign(name) {
      const clean = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
      if (!clean) return false;
      flags.set(FLAG.heroName, clean);
      if (asking === 'deed') close();
      return true;
    },
    cancel() {
      if (asking) close();
    },
    swing() {
      if (!boutOn || !practice || player.busy) return false;
      practice.fight.press('attack');
      return true;
    },
    practice: () => boutOn ? practice : null,
    drivePractice(on) { byView = on; },
    bout: () => ({ on: boutOn, guard }),
    ferryDone() {
      if (step() !== 'river') return;
      flags.set(FLAG.step('grantday', 'river'), true);
      // The guild's axe and spade come up the river with the hero, as skipping grant day gives them (quest
      // grantday's gift): the spade digs the ditch, the first thing the plot asks for.
      for (const tool of ['axe', 'spade'] as const) if ((game.systems.inventory?.count(tool) ?? 0) === 0) game.systems.inventory?.add(tool, 1);
      game.systems.time?.setTimeOfDay(LANDING_TIME);
    },
    spot: (id) => (id in SPOTS ? spot(id as SpotId) : null),
    inSaltgate: here,
  };

  // ------------------------------------------------------------------------------------ the step

  const system: SimSystem = {
    step(dt) {
      join();
      const now = stage();
      if (now !== lastStage) {
        if (lastStage !== null) events.emit('opening.stage', { stage: now });
        lastStage = now;
      }
      placePeople();
      if (!byView && boutOn && practice) {
        practice.fight.placeHero(player.pos.x, player.pos.z);
        practice.step(dt);
        practice.fight.events.length = 0;
      } else if (!byView && !boutOn && guard === 0 && step() === 'spar' && !player.busy && !talk()?.active) {
        say(TALK.bout, 'dax');
      } else if (!byView && introDue && !player.busy && !talk()?.active) {
        introDue = false;
        say(TALK.spar);
      }
      if (!here(player.pos)) return;
      // Saltgate keeps its morning.
      if (game.clock.timeOfDay > MORNING_HOLD) game.systems.time?.setTimeOfDay(MORNING_HOLD);
    },
    save: () => ({ bout: boutOn || guard === 0 ? guard : -1, targetGuard: lid?.guard }),
    load(data) {
      const saved = data as { bout?: number; targetGuard?: number } | undefined;
      practice = null;
      lid = null;
      guard = GUARD;
      boutOn = false;
      introDue = false;
      if (step() === 'spar') {
        if ((saved?.bout ?? -1) > 0) {
          const gear = game.systems.bench?.gear() ?? STARTING_GEAR;
          startPractice(saved?.targetGuard ?? saved!.bout! * weaponOf(gear.weapon).quick.guard);
        } else if (saved?.bout === 0) guard = 0;
        else if (flags.is(BOUT_SEEN)) introDue = true;
      }
      asking = null;
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createOpening(kernel.game);
  kernel.game.systems.opening = api;
  // Saltgate is the guild's and the city's: nothing there is dug, broken or built. The region answers for
  // Greenhollow; this answers for Saltgate, by wrapping the region's rule once both are installed.
  const region = kernel.game.systems.region;
  if (region) {
    const base = region.isProtected.bind(region);
    region.isProtected = (x, y, z) => inLand(x, z) || base(x, y, z);
    // The story's scenes and the quest waypoints name Saltgate's spots (`saltgate.locks`); the region knows
    // Greenhollow's places, and this answers Saltgate's.
    const placeOf = region.place.bind(region);
    region.place = (name) => {
      const spot = (PLACE_SPOTS as Record<string, SpotId>)[name];
      return spot ? { name, at: saltgateAt(SPOTS[spot].x, SPOTS[spot].z), label: '' } : placeOf(name);
    };
  }
  kernel.add('opening', api, system);
}
