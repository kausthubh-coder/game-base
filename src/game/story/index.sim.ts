// The director: the scripted moments of act 1 that belong to no one system, the rules that keep the player from
// getting stuck, and the hints. It is not in `game.systems`. Install it with the others and the kernel steps it.
//
//   - Act 1's scenes and the conversations that offer a quest step, started when the step opens and the player is
//     there, with the people of the scene stood in the world while it plays (./scenes.sim.ts).
//   - 90 seconds of rain on the afternoon after the first wheat is planted.
//   - `act.ended` when the last quest of the act is done.
//   - Never stuck: gifts that did not fit in the bag handed over when there is room, a bonded fox left behind
//     brought back when the player reaches the grant, and a lost tool replaced by whoever gave it (dialogue.ts).

import type { Game, ItemId, SimSystem } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { CONVERSATIONS, type Line } from '../content/dialogue.ts';
import { FLAG } from '../content/flags.ts';
import { HINTS } from '../content/hints.ts';
import { LAST_QUEST, QUESTS, type Effect } from '../content/quests.ts';
import { DAWN, DUSK, holds, owedFlag, petOf, placeAt } from '../quests/rules.sim.ts';
import { createSceneRunner } from './scenes.sim.ts';

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
/** A bonded pet further than this from a player standing on the grant is brought back. */
const PET_LOST = 24;
/** Seconds between two hints, and between two of the same toast. */
const HINT_GAP = 4, TOAST_GAP = 30;
const TICK = 0.5;

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
  const scenes = createSceneRunner(game);
  // Keep the lighting's day in the normal saved flags, including a Continue during that night.
  events.on('scene.played', ({ scene }) => {
    if (scene === 23) flags.set('story.road.litDay', clock.day);
  });
  function stepRoadMorning(): void {
    const litDay = flags.get('story.road.litDay');
    if (typeof litDay !== 'number' || clock.day <= litDay || clock.timeOfDay < DAWN || clock.timeOfDay >= DUSK) return;
    if (flags.get(FLAG.questStep('count')) !== 'grey' || player.busy) return;
    const arches = placeAt(game, 'arches');
    if (arches && distance2d(player.pos, arches) <= 8) flags.set(FLAG.step('count', 'grey'), true);
  }


  let sinceTick = TICK;
  /** Seconds of the scripted shower still to fall. */
  let rainLeft = 0;
  /** Seconds the shower has been asked for with no rain falling yet. */
  let rainLead = 0;
  let sinceHint = HINT_GAP;
  let lastBagToast = -TOAST_GAP, lastPetCall = -TOAST_GAP;

  events.on('crop.planted', () => {
    if (flags.is('story.rain.done') || flags.is('story.rain.due')) return;
    flags.set('story.rain.due', true);
    flags.set('story.rain.planted', clock.seconds);
  });

  // The last quest's last step ends the act. The end card follows.
  events.on('flag.changed', ({ flag, value }) => {
    if (flag !== FLAG.questDone(LAST_QUEST) || !value || flags.is('act1.ended')) return;
    flags.set('act1.ended', true);
    events.emit('act.ended', { act: 1 });
  });

  function stepRain(dt: number): void {
    if (flags.is('story.raining')) {
      if (game.ambient.rain > RAIN_FALLS || rainLead >= RAIN_LEAD) rainLeft -= dt;
      else rainLead += dt;
      if (rainLeft <= 0) endRain();
      return;
    }
    if (!flags.is('story.rain.due') || player.busy) return;
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
    game.systems.time?.setWeather(null);
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
    events.emit('toast', { text: 'Your fox found its way home.' });
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
      sinceHint += dt;
      sinceTick += dt;
      const tick = sinceTick >= TICK;
      if (tick) sinceTick = 0;
      // Each part is tried by itself: the shell switches a system off for good when its step throws,
      // and one moment that fails must not take the others with it.
      attempt('rain', () => stepRain(dt));
      attempt('scenes', () => scenes.system.step?.(dt));
      if (!tick) return;
      attempt('road morning', stepRoadMorning);
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
    },
  };

  return { system };
}

export function install(kernel: Kernel): void {
  kernel.addPlain('story', createDirector(kernel.game).system);
}
