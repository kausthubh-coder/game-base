// The director: the scripted moments of the first part, the rules that keep the player from getting
// stuck, and the hints. It is not in `game.systems`. Install it with the others and the kernel steps it.
//
//   - 90 seconds of rain on the afternoon after the first wheat is planted.
//   - The festival: the dusk after the wheat is delivered starts it, and the next morning ends it.
//   - A river lamp used within 6 blocks of the river bank floats.
//   - `act.ended` after the last talk with Tamsin.
//   - Never stuck: a quest mark over Tamsin when the axe is gone and over Gus when the seed runs short,
//     gifts that did not fit in the bag handed over when there is room, and a bonded leaftail left
//     behind brought back when the player reaches the grant.

import type { Game, ItemId, NpcId, SimSystem, UseContext } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { CONVERSATIONS, type Line } from '../content/dialogue.ts';
import { HINTS } from '../content/hints.ts';
import { QUESTS, WHEAT_SHORT, type Condition, type Effect } from '../content/quests.ts';
import { DAWN, DUSK, holds, isDark, owedFlag, petOf, placeAt } from '../quests/rules.sim.ts';

/** Seconds of rain the scripted shower brings. */
export const RAIN_SECONDS = 90;
/** `ambient.rain` above this is rain falling. The crops system waters open soil from the same level. */
const RAIN_FALLS = 0.05;
/**
 * The weather brings rain in as a front, cloud and wind first, about 45 seconds ahead of the first drop.
 * The shower's seconds count only while rain falls. Should no rain come in this long, they count anyway.
 */
const RAIN_LEAD = 75;
/** The shower waits this long after the planting, so the player sees dry soil first. */
const RAIN_DELAY = 20;
/** The afternoon, as times of day. The shower starts inside it and dusk is still a while off. */
const AFTERNOON_FROM = 0.5, AFTERNOON_TO = 0.7;
/** How close to the river bank a lamp can be floated, in blocks. */
export const LAMP_REACH = 6;
/** A bonded pet further than this from a player standing on the grant is brought back. */
const PET_LOST = 24;
/** Seconds between two hints, and between two of the same toast. */
const HINT_GAP = 4, TOAST_GAP = 30;
const TICK = 0.5;

/** Where someone stands at the festival: a named place, and blocks east and south of it. */
interface FestivalSpot {
  place: string;
  x: number;
  z: number;
}

/**
 * The festival, laid out. Tamsin and Brack are on the river bank, everyone else in the square, a few
 * blocks apart, so the town reads as a crowd and "E" beside someone still names that person. Odo stands on
 * the place itself, where the quest's waypoint brings the player. The well is six blocks north of it.
 */
const FESTIVAL_SPOTS: Readonly<Record<NpcId, FestivalSpot>> = {
  tamsin: { place: 'river.bank', x: 0, z: 0 },
  brack: { place: 'river.bank', x: 7, z: 0 },
  odo: { place: 'town.square', x: 0, z: 0 },
  maren: { place: 'town.square', x: -4, z: -1 },
  gus: { place: 'town.square', x: 9, z: 2 },
  mira: { place: 'town.square', x: -7, z: 2 },
  wren: { place: 'town.square', x: 4, z: -2 },
  juniper: { place: 'town.square', x: 2, z: 3 },
};
/** Spots in the square for everyone without one of their own, taken in the order people are listed. */
const CROWD_SPOTS: readonly (readonly [x: number, z: number])[] = [[-10, -1], [7, -4], [-3, 4], [6, 4], [-8, -5], [11, -2], [-5, -6], [-11, 4]];

const AXE_LOST: Condition = { all: [{ flag: 'plot.met' }, { not: { bag: 'axe' } }, { not: { flag: 'owed.axe' } }] };
const SEEDS_SHORT: Condition = { all: [{ flag: 'bread.seeds' }, { not: { flag: 'bread.delivered' } }, WHEAT_SHORT] };
/** Odo has a river lamp to hand over: the festival has begun, the player's lamp is not on the water and none is in the bag. */
const LAMP_WAITS: Condition = {
  all: [{ quest: 'festival' }, { flag: 'festival.started' }, { not: { flag: 'festival.lamp' } }, { not: { bag: 'river_lamp' } }, { not: { flag: 'owed.river_lamp' } }],
};

/** Every item a conversation or a skipped quest can give, so a gift that did not fit can be found again. */
function giftItems(): ItemId[] {
  const items = new Set<ItemId>();
  const add = (effects: Effect[] | undefined): void => {
    for (const effect of effects ?? []) if ('give' in effect) items.add(effect.give);
  };
  const lines = (list: readonly (string | Line)[]): void => {
    for (const line of list) {
      if (typeof line === 'string') continue;
      add(line.effects);
      for (const choice of line.choices ?? []) {
        add(choice.effects);
        lines(choice.then ?? []);
      }
    }
  };
  for (const conversation of CONVERSATIONS) lines(conversation.lines);
  for (const quest of QUESTS) add(quest.skip);
  return [...items];
}

interface DirectorSave {
  rainLeft: number;
}

export interface Director {
  system: SimSystem;
}

export function createDirector(game: Game): Director {
  const { clock, events, flags, player } = game;
  const gifts = giftItems();

  let ready = false;
  let sinceTick = TICK;
  /** Seconds of the scripted shower still to fall. */
  let rainLeft = 0;
  /** Seconds the shower has been asked for with no rain falling yet. */
  let rainLead = 0;
  let sinceHint = HINT_GAP;
  let lastBagToast = -TOAST_GAP, lastBankToast = -TOAST_GAP, lastPetCall = -TOAST_GAP;
  /** People this director holds for the festival. Empty again after a load, so they are sent once more. */
  const held = new Set<NpcId>();
  /** Marks this director set, so it takes off only its own. */
  let axeMark = false, seedMark = false, lampMark = false;

  const festivalOn = (): boolean => flags.is('festival.started') && !flags.is('festival.over');

  events.on('crop.planted', () => {
    if (flags.is('story.rain.done') || flags.is('story.rain.due')) return;
    flags.set('story.rain.due', true);
    flags.set('story.rain.planted', clock.seconds);
  });

  // The last scene sets `festival.ended`. The end card follows the moment the conversation closes.
  events.on('talk.ended', () => {
    if (!flags.is('festival.ended') || flags.is('act1.ended')) return;
    flags.set('act1.ended', true);
    events.emit('act.ended', { act: 1 });
  });

  function floatLamp(context: UseContext): boolean {
    if (context.button !== 'secondary' || context.held?.id !== 'river_lamp') return false;
    const bank = placeAt(game, 'river.bank');
    if (!bank || distance2d(player.pos, bank) > LAMP_REACH) {
      if (clock.seconds - lastBankToast >= 3) {
        lastBankToast = clock.seconds;
        events.emit('toast', { text: 'Float the lamp from the river bank.', icon: 'lantern' });
      }
      return true;
    }
    if (!game.systems.inventory?.remove('river_lamp', 1)) return false;
    flags.set('festival.lamp', true);
    flags.add('festival.lamps', 1);
    events.emit('toast', { text: 'Your lamp joins the others on the Mere.', icon: 'lantern' });
    return true;
  }

  function stepRain(dt: number): void {
    if (flags.is('story.raining')) {
      if (game.ambient.rain > RAIN_FALLS || rainLead >= RAIN_LEAD) rainLeft -= dt;
      else rainLead += dt;
      if (rainLeft <= 0) endRain();
      return;
    }
    if (!flags.is('story.rain.due') || festivalOn() || player.busy) return;
    const time = clock.timeOfDay;
    if (time < AFTERNOON_FROM || time >= AFTERNOON_TO) return;
    if (clock.seconds - Number(flags.get('story.rain.planted') ?? 0) < RAIN_DELAY) return;
    rainLeft = RAIN_SECONDS;
    rainLead = 0;
    flags.set('story.raining', true);
    game.systems.time?.setWeather('rain');
  }

  function endRain(): void {
    rainLeft = 0;
    flags.set('story.raining', false);
    flags.set('story.rain.due', false);
    flags.set('story.rain.done', true);
    // The festival holds its own clear sky.
    if (!festivalOn()) game.systems.time?.setWeather(null);
  }

  /** `skipped` is true when the afternoon was waited out: the weather of that afternoon is gone with it. */
  function startFestival(skipped: boolean): void {
    if (flags.is('story.raining')) endRain();
    // A shower leaves as a front, over a quarter of a minute. After a skipped afternoon the sky is clear at once.
    game.systems.time?.setWeather('clear', skipped);
    flags.set('festival.started', true);
    gather();
    events.emit('festival.started', {});
    events.emit('toast', { text: 'Dusk. Lamps are being lit in Hollowmere.', icon: 'lantern' });
  }

  /** Sends everyone to the festival and holds them. Someone sent and then held finishes the walk and stays. */
  function gather(): void {
    const people = game.systems.people;
    let crowd = 0;
    for (const npc of people?.all() ?? []) {
      // The spot goes by the person's place in the list, so it is the same one after a load.
      const spare = CROWD_SPOTS[crowd % CROWD_SPOTS.length];
      const spot = FESTIVAL_SPOTS[npc.id] ?? { place: 'town.square', x: spare[0], z: spare[1] };
      if (!FESTIVAL_SPOTS[npc.id]) crowd++;
      if (held.has(npc.id)) continue;
      people.send(npc.id, spot.place, { x: spot.x, z: spot.z });
      people.hold(npc.id, true);
      held.add(npc.id);
    }
  }

  function endFestival(): void {
    const people = game.systems.people;
    for (const npc of people?.all() ?? []) people.hold(npc.id, false);
    held.clear();
    game.systems.time?.setWeather(null);
    flags.set('festival.over', true);
  }

  function stepFestival(): void {
    if (flags.is('festival.over')) return;
    if (flags.is('festival.started')) {
      const time = clock.timeOfDay;
      if (time >= DAWN + 0.04 && time < AFTERNOON_TO) endFestival();
      else gather();
      return;
    }
    if (!flags.is('bread.delivered') || player.busy) return;
    if (isDark(clock.timeOfDay)) {
      flags.set('festival.wait', false);
      startFestival(false);
    } else if (flags.is('festival.wait')) {
      // The player chose to wait with Maren: the afternoon passes.
      flags.set('festival.wait', false);
      game.systems.time?.setTimeOfDay(DUSK + 0.005);
      startFestival(true);
    }
  }

  /** The quest mark over whoever can get the player moving again. The quest system puts its own back within a check. */
  function stepMarks(): void {
    const people = game.systems.people;
    if (!people) return;
    const axe = holds(game, AXE_LOST);
    if (axe) people.setMark('tamsin', 'quest');
    else if (axeMark) people.setMark('tamsin', '');
    axeMark = axe;
    const seeds = holds(game, SEEDS_SHORT);
    if (seeds) people.setMark('gus', 'quest');
    else if (seedMark) people.setMark('gus', '');
    seedMark = seeds;
    // The step "float a lamp" names nobody, and the lamp comes from Odo: he carries the mark until he has given it.
    const lamp = holds(game, LAMP_WAITS);
    if (lamp) people.setMark('odo', 'quest');
    else if (lampMark) people.setMark('odo', '');
    lampMark = lamp;
  }

  /** Hands over gifts that did not fit in the bag when they were given. */
  function stepOwed(): void {
    const inventory = game.systems.inventory;
    if (!inventory) return;
    for (const item of gifts) {
      const owed = Number(flags.get(owedFlag(item)) ?? 0);
      if (!(owed > 0)) continue;
      const left = inventory.add(item, owed);
      if (left !== owed) flags.set(owedFlag(item), left);
      if (left > 0 && clock.seconds - lastBagToast >= TOAST_GAP) {
        lastBagToast = clock.seconds;
        events.emit('toast', { text: 'Your bag is full. Make room for what you were given.' });
      }
    }
  }

  /** A bonded leaftail left far behind turns up beside a player who is back on the grant. */
  function stepPet(): void {
    const pet = petOf(game, 'leaftail', true);
    if (!pet || distance2d(pet.pos, player.pos) <= PET_LOST || clock.seconds - lastPetCall < TOAST_GAP) return;
    const grant = game.systems.region?.grant();
    if (!grant) return;
    const { x, z } = player.pos;
    if (x < grant.x || z < grant.z || x >= grant.x + grant.width || z >= grant.z + grant.depth) return;
    lastPetCall = clock.seconds;
    pet.pos.x = player.pos.x;
    pet.pos.y = player.pos.y;
    pet.pos.z = player.pos.z;
    const actor = game.actors.get(pet.id);
    if (actor && actor.pos !== pet.pos) {
      actor.pos.x = pet.pos.x;
      actor.pos.y = pet.pos.y;
      actor.pos.z = pet.pos.z;
    }
    events.emit('toast', { text: 'Your leaftail found its way home.' });
  }

  function stepHints(): void {
    if (player.busy || sinceHint < HINT_GAP) return;
    for (const hint of HINTS) {
      if (flags.is(`hint.${hint.id}`) || !holds(game, hint.when)) continue;
      flags.set(`hint.${hint.id}`, true);
      events.emit('hint', { id: hint.id, text: hint.text });
      sinceHint = 0;
      return;
    }
  }

  const warned = new Set<string>();
  function attempt(part: string, run: () => void): void {
    try {
      run();
    } catch (error) {
      if (warned.has(part)) return;
      warned.add(part);
      console.error(`[story] ${part} failed and will be tried again:`, error);
    }
  }

  const system: SimSystem = {
    step(dt) {
      if (!ready) {
        ready = true;
        // Added on the first step, when every system is in place. Handlers run before blocks are placed.
        game.systems.actions?.addHandler(floatLamp);
      }
      sinceHint += dt;
      sinceTick += dt;
      const tick = sinceTick >= TICK;
      if (tick) sinceTick = 0;
      // Each part is tried by itself: the shell switches a system off for good when its step throws,
      // and one moment that fails must not take the festival and the end of the act with it.
      attempt('rain', () => stepRain(dt));
      if (!tick) return;
      attempt('festival', stepFestival);
      attempt('marks', stepMarks);
      attempt('owed', stepOwed);
      attempt('pet', stepPet);
      attempt('hints', stepHints);
    },
    save: (): DirectorSave => ({ rainLeft }),
    load(data) {
      rainLeft = Number((data as Partial<DirectorSave> | null)?.rainLeft ?? 0);
      // A shower that was falling goes on for at least a moment, so its end is still scripted.
      if (flags.is('story.raining') && !(rainLeft > 0)) rainLeft = 1;
      // The time system settles a loaded shower at full rain at once, so its seconds count from the first step.
      rainLead = RAIN_LEAD;
      held.clear();
      axeMark = false;
      seedMark = false;
      lampMark = false;
    },
  };

  return { system };
}

export function install(kernel: Kernel): void {
  kernel.addPlain('story', createDirector(kernel.game).system);
}
