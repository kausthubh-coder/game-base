// The scene runner: the part of the director that starts act 1's scenes and the conversations that offer a quest
// step, and stands the people of a scene in the world while it plays. The scenes are content/scenes.ts, their lines
// content/dialogue.ts, and the talk system plays them and sets `scene.<n>` as each ends.
//
// Once a quest step is open, the conversation it names starts:
//   - a scene step plays `scene.<n>`, and a fight step with a scene plays `scene.<n>.before` as the fight begins;
//   - a step's own `talk` plays that conversation (a choice, the vaults marked);
//   - when the player is within `NEAR_SCENE` (or the step's or scene's own `within`) of the step's place, or at once when the region has no such place;
//   - a conversation with someone in the world waits for the player to talk to them, as any other does.
// Some scenes come at a moment instead: after a fight is won (19, 21, 31), on coming out of the first vault (25),
// when the queen's ledger fills (the end of 27), and in the night's sleep (35). The hall plays the first night's
// own (8, 10 to 14), and the film director scene 9.
//
// The queue and stand-ins are not saved. Open steps and won/denied fights recover unfinished conversations
// from their saved flags; stand-ins live only while their scene plays.

import type { Actor, Game, QuestId, SimSystem } from '../api.sim.ts';
import type { PersonId } from '../content/ids.ts';
import { FILMS, filmFlag } from '../content/cutscenes.ts';
import { CONVERSATIONS, SCENE, type Conversation } from '../content/dialogue.ts';
import { FLAG } from '../content/flags.ts';
import { LEDGER_SECTIONS, type FightNumber, type SceneNumber, type VaultId } from '../content/ids.ts';
import { QUESTS, type StepDef } from '../content/quests.ts';
import { NEAR_SCENE, sceneBefore, sceneOf, sceneTalk, type SceneCast } from '../content/scenes.ts';
import { CROWD_SPRITES } from '../content/people.ts';
import { distance2d } from '../move.sim.ts';
import { DUSK, placeAt } from '../quests/rules.sim.ts';
import { kindOf, sceneNumber } from '../talk/index.sim.ts';

/** Seconds the player has to be free (no conversation, no film) before the next scene starts. */
const SETTLE = 1.2;
/** Someone of the scene's cast already this close to their own spot plays themselves. Farther, a stand-in takes the spot and they step out of sight while it plays. */
const PRESENT = 6;
/** A scene is staged at its place when the player is this close to it, else round the player. */
const STAGE_REACH = 30;
/** The cast with no sprite of their own, and who stands in for them. */
const SPRITE: Partial<Record<PersonId, string>> = { guildmaster: 'town-dunn' };
/** Prefix of the stand-ins' actor ids. The stage view frames them. */
export const STAND_IN = 'stage:';
/** Prefix of the actors of a scene's crowd: they watch, and are not framed or kept in sight. */
export const CROWD = 'crowd:';

/** Where a scene is staged: at its place when the player is near it, else round the player. */
export function stageCentre(game: Game, scene: number): { x: number; y: number; z: number } {
  const def = sceneOf(scene);
  const at = def?.at ? placeAt(game, def.at) : null;
  return at && distance2d(at, game.player.pos) <= STAGE_REACH ? at : game.player.pos;
}

const byId = new Map(CONVERSATIONS.map((c) => [c.id, c]));
const VAULTS: readonly VaultId[] = ['pumphouse', 'lampgallery', 'seedvault'];

export interface SceneRunner {
  system: Pick<SimSystem, 'step'>;
}

export function createSceneRunner(game: Game): SceneRunner {
  const { events, flags, player } = game;
  /** Conversations owed by a moment: started before any step's own, in order. */
  const queue: string[] = [];
  let free = 0;
  const standIns: string[] = [];
  /** People of the world stepped out of sight while their stand-in plays them. */
  const away: Actor[] = [];
  /** Originals represented by stand-ins, including people who have not arrived yet. */
  const represented: Actor[] = [];
  /** True while a memory has the player's own actor hidden. */
  let hidHero = false;

  /** A conversation has played, or its scene has some other way (the bots, the debug door). */
  const seen = (id: string): boolean => {
    if (flags.is(`story.seen.${id}`)) return true;
    const conversation = byId.get(id);
    return conversation?.scene !== undefined && flags.is(FLAG.scene(conversation.scene));
  };
  const owe = (id: string): void => {
    if (byId.has(id) && !seen(id) && !queue.includes(id)) queue.push(id);
  };

  // ------------------------------------------------------------------------------------ moments

  /** The scene a fight step plays once its fight is won, or denied for the boar out of reach. */
  const afterFight = new Map<FightNumber, SceneNumber>();
  for (const quest of QUESTS) for (const step of quest.steps) if (step.kind === 'fight' && step.fight && step.scene && sceneOf(step.scene)?.start === 'fight') afterFight.set(step.fight, step.scene);
  const fightForTalk = new Map([...afterFight].map(([fight, scene]) => [sceneTalk(scene), fight]));
  const fightResolved = (fight: FightNumber): boolean => flags.is(FLAG.fightWon(fight)) || flags.is(FLAG.fightDenied(fight));

  events.on('flag.changed', ({ flag, value }) => {
    if (!value) return;
    // A film of content/cutscenes.ts is its scene played: scene 9 has no lines but its words.
    const film = FILMS.find((f) => flag === filmFlag(f));
    if (film && Number(film.scene) >= 1) {
      flags.set(FLAG.scene(Number(film.scene) as SceneNumber), true);
      return;
    }
    // The settler walked to a room says so (the settlement sets `job.<who>`).
    const job = /^job\.([a-z]+)$/.exec(flag);
    if (job && typeof value === 'string') {
      owe(`took.${job[1]}.${value}`);
      return;
    }
    const fight = /^fight\.(\d+)\.(won|denied)$/.exec(flag);
    if (fight) {
      const n = afterFight.get(Number(fight[1]) as FightNumber);
      if (n && !flags.is(FLAG.scene(n))) owe(sceneTalk(n));
      return;
    }
    // Calla waits at the door of whichever vault the player comes out of first.
    if (VAULTS.some((vault) => flag === FLAG.vaultCleared(vault)) && !flags.is(FLAG.scene(25))) owe(sceneTalk(25));
    else if (LEDGER_SECTIONS.some((s) => flag === FLAG.ledgerFilled(s)) && LEDGER_SECTIONS.every((s) => flags.is(FLAG.ledgerFilled(s)))) owe('scene.27.dark');
  });
  // The dream comes in the night's sleep once the queen's charter is given.
  events.on('slept', () => {
    if (flags.get(FLAG.questStep('green')) === 'dream') owe(sceneTalk(35));
  });

  // ------------------------------------------------------------------------------------ steps

  /** The conversation a step plays, or null. */
  function talkOf(step: StepDef): string | null {
    if (step.talk) return step.talk;
    const n = step.scene;
    if (!n) return null;
    const scene = sceneOf(n);
    if (!scene || scene.start === 'hall' || scene.start === 'film') return null;
    if (step.kind === 'scene') return sceneTalk(n);
    if (step.kind === 'fight' && byId.has(sceneBefore(n))) return sceneBefore(n);
    return null;
  }

  /** True when the player can be shown this step's conversation now. */
  function ready(step: StepDef, id: string, conversation: Conversation | undefined): boolean {
    // Someone in the world says it when the player talks to them, with the quest mark over their head.
    if (conversation && conversation.npc !== SCENE && game.systems.people?.get(conversation.npc)) return false;
    const n = sceneNumber(conversation ?? { id, npc: SCENE, lines: [] });
    const start = sceneOf(n)?.start;
    if (n === 23 && game.clock.timeOfDay < DUSK) return false;
    // Dreams wait for sleep; memories marked stone wait for interaction.
    if (start === 'sleep' || start === 'stone') return false;
    // Wherever the player is: the morning after, a cut away, the moment a fight ends.
    if (start === 'now' || start === 'fight') return true;
    const name = step.place ?? sceneOf(n)?.at ?? step.at;
    const at = name ? placeAt(game, name) : null;
    return !at || distance2d(player.pos, at) <= (step.within ?? sceneOf(n)?.within ?? NEAR_SCENE);
  }

  function play(id: string): void {
    game.systems.talk?.start(id);
  }

  function nextStep(): string | null {
    for (const id of queue) {
      if (seen(id)) continue;
      // Loading an earlier save in this kernel can leave a later victory in the unsaved queue.
      const fight = fightForTalk.get(id);
      if (fight !== undefined && !fightResolved(fight)) continue;
      return id;
    }
    // Loading flags emits no victory event. Recover the owed scene, including a conversation cut short
    // by the save, before the quest's ordinary step. Authored quest order puts earlier unfinished fights first.
    for (const [id, fight] of fightForTalk) {
      if (fightResolved(fight) && !seen(id)) return id;
    }
    for (const quest of QUESTS) {
      if (!flags.is(FLAG.questStarted(quest.id)) || flags.is(FLAG.questDone(quest.id))) continue;
      const step = quest.steps.find((s) => s.id === flags.get(FLAG.questStep(quest.id as QuestId)));
      if (!step) continue;
      const id = talkOf(step);
      if (!id || seen(id)) continue;
      // A scene already played some other way (the bots, the debug door) is not played again.
      const n = step.kind === 'scene' ? step.scene : 0;
      if (n && flags.is(FLAG.scene(n))) continue;
      if (ready(step, id, byId.get(id))) return id;
    }
    return null;
  }

  // ------------------------------------------------------------------------------------ the stage

  /** The people of the conversation that has just started, stood where its scene is staged. */
  function stage(id: string): void {
    const conversation = byId.get(id);
    let cast: readonly SceneCast[] = [];
    let crowd: readonly { x: number; z: number }[] = [];
    let memory = false;
    const n = conversation ? sceneNumber(conversation) : 0;
    if (conversation && kindOf(conversation) !== 'talk') {
      const scene = sceneOf(n);
      cast = scene?.cast ?? [];
      crowd = scene?.staging?.crowd ?? [];
      memory = scene?.memory === true;
    }
    // A memory is not the present: the player is not in it.
    const hero = game.actors.get('player');
    if (memory && hero?.visible) {
      hero.visible = false;
      hidHero = true;
    }
    if (cast.length === 0 && crowd.length === 0) return;
    const centre = { ...stageCentre(game, n) };
    for (const one of cast) {
      const x = centre.x + one.x, z = centre.z + one.z;
      const present = game.systems.people?.get(one.who);
      if (!one.exact && present && distance2d(present.pos, { x, y: centre.y, z }) <= PRESENT) continue;
      const real = game.actors.get(`npc:${one.who}`);
      if (real) represented.push(real);
      if (real?.visible) {
        real.visible = false;
        away.push(real);
      }
      const y = game.world.heightAt(Math.floor(x), Math.floor(z));
      const actor: Actor = {
        id: STAND_IN + one.who, sprite: SPRITE[one.who] ?? one.who, pos: { x, y: Math.abs(y - centre.y) > 3 ? centre.y : y, z },
        // Turned toward the player, but never with their back to the south, where the camera stands at first.
        facing: Math.atan2(player.pos.x - x, -(Math.max(player.pos.z, z + 2) - z)), anim: 'idle', visible: true, mark: '',
      };
      game.actors.set(actor.id, actor);
      standIns.push(actor.id);
    }
    crowd.forEach((spot, i) => {
      const x = centre.x + spot.x, z = centre.z + spot.z;
      const y = game.world.heightAt(Math.floor(x), Math.floor(z));
      const actor: Actor = {
        id: `${CROWD}${i}`, sprite: CROWD_SPRITES[i % CROWD_SPRITES.length] as string, pos: { x, y: Math.abs(y - centre.y) > 3 ? centre.y : y, z },
        facing: Math.atan2(centre.x - x, -(centre.z - z)), anim: 'idle', visible: true, mark: '',
      };
      game.actors.set(actor.id, actor);
      standIns.push(actor.id);
    });
  }

  function unstage(): void {
    for (const id of standIns) game.actors.delete(id);
    standIns.length = 0;
    for (const actor of away) actor.visible = true;
    away.length = 0;
    represented.length = 0;
    const hero = game.actors.get('player');
    if (hidHero && hero) hero.visible = true;
    hidHero = false;
  }

  events.on('talk.started', ({ conversation }) => {
    unstage();
    stage(conversation);
  });
  events.on('talk.ended', ({ conversation }) => {
    unstage();
    if (byId.has(conversation)) flags.set(`story.seen.${conversation}`, true);
    const at = queue.indexOf(conversation);
    if (at >= 0) queue.splice(at, 1);
    free = 0;
  });

  return {
    system: {
      step(dt) {
        // Presence can reveal a newly arrived person after staging. Keep their stand-in exclusive.
        for (const actor of represented) if (actor.visible) {
          actor.visible = false;
          if (!away.includes(actor)) away.push(actor);
        }
        if (player.busy || game.systems.talk?.active) {
          free = 0;
          return;
        }
        free += dt;
        if (free < SETTLE) return;
        const id = nextStep();
        if (!id) return;
        free = 0;
        play(id);
      },
    },
  };
}
