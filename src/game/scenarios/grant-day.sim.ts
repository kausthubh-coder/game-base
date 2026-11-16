// Grant day at Saltgate, played as a player plays it: wake under the painted wall, the mirror, breakfast, Dax and
// the last lock, Mina and the map wall, the rack, the bout, the deed, the quay, then the river and the landing.
// The scenes start as the hero comes near their places; the mirror, the porridge and the rack by E. A save and a
// load in the middle of the bout.
import { FLAG } from '../content/flags.ts';
import { PEOPLE, SPOTS, type SpotId } from '../content/saltgate.ts';
import { GUARD } from '../opening/index.sim.ts';
import { saltgateAt } from '../opening/land.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

/** Beside a spot of Saltgate, `dx` blocks east of it. */
const at = (spot: SpotId, dx = 0, dz = 0): { x: number; z: number } => {
  const w = saltgateAt(SPOTS[spot].x + dx, SPOTS[spot].z + dz);
  return { x: w.x, z: w.z };
};
const talking = (p: Play): boolean => p.sys.talk.active;
/** Aim at the lid, request the selected weapon's quick move, and let its hit actually arrive. */
function hitLid(p: Play): void {
  const fight = p.sys.opening.practice()!.fight, lid = fight.targets[0]!;
  fight.input.aimX = lid.x;
  fight.input.aimZ = lid.z;
  if (!p.sys.opening.swing()) throw new Error('practice is not ready');
  p.advance(0.6);
}
/** A step west of one of the guild's people, wherever the step has put them. */
const beside = (who: keyof typeof PEOPLE): Input => ({
  do: 'run',
  name: `walk up to ${who}`,
  run: (p: Play) => {
    const actor = p.game.actors.get(PEOPLE[who].id);
    if (!actor?.visible) throw new Error(`${who} is not in Saltgate`);
    p.teleport({ x: actor.pos.x - 1, z: actor.pos.z });
  },
});
const step = (p: Play): unknown => p.game.flags.get(FLAG.questStep('grantday'));
/** How many times scene n has played since this play began or was last loaded. */
const played = (p: Play, n: number): number => p.heard.filter((h) => h.name === 'scene.played' && (h.data as { scene: number }).scene === n).length;
/** Each of these scenes has played once since this play began or was last loaded. */
const once = (scenes: readonly number[]) => (p: Play): boolean => scenes.every((n) => played(p, n) === 1);
/** Back at a place of Saltgate after grant day: nothing plays again. */
const again = (spot: SpotId, dx = 0, dz = 0): Input[] => [
  { do: 'teleport', to: at(spot, dx, dz) },
  { do: 'wait', seconds: 3 },
  { do: 'check', what: `nothing plays again at ${spot}`, that: (p) => !talking(p) },
];

export const grantDay: Scenario = {
  name: 'grant-day',
  about: 'Grant day at Saltgate from waking to the landing, every step by playing, with a save and load in the bout.',
  seed: 41,
  inputs: [
    { do: 'run', name: 'the film ends, and the hero wakes in the bunk room', run: (p) => { p.sys.opening.filmDone(); p.teleport(at('bunk')); } },
    { do: 'wait', until: talking, seconds: 3 },
    { do: 'check', what: 'Hobb wakes the hero', that: (p) => p.sys.talk.current()?.npc === 'hobb' },
    { do: 'talk' },
    { do: 'walk', to: at('mirror', -1), within: 1.2 },
    { do: 'interact', prompt: 'Look in the mirror' },
    { do: 'run', name: 'pick the braid', run: (p) => p.sys.opening.setLook('d') },
    { do: 'teleport', to: at('porridge', 0, 1) },
    { do: 'interact', prompt: 'Eat Hobb\'s porridge' },
    { do: 'talk' },
    // Hobb, after the porridge, no longer sends the hero to breakfast.
    beside('hobb'),
    { do: 'interact', prompt: 'Talk to Hobb' },
    { do: 'wait', until: talking, seconds: 2 },
    { do: 'check', what: 'Hobb\'s walk-up line fits a hero who has eaten', that: (p) => p.sys.talk.current()?.npc === 'hobb' && !p.sys.talk.current()!.text.includes('Breakfast first') },
    { do: 'talk' },
    // The last lock and the map wall start as the hero comes near them: at Dax's table, not from the middle room,
    // where neither Dax nor his table is on the screen.
    { do: 'teleport', to: at('locks', -9) },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'the last lock waits for the hero at Dax\'s table', that: (p) => !talking(p) },
    { do: 'teleport', to: at('locks', -1) },
    { do: 'wait', until: talking, seconds: 3 },
    { do: 'talk' },
    { do: 'teleport', to: at('maps', -1, 1.5) },
    { do: 'wait', until: talking, seconds: 3 },
    { do: 'talk' },
    // The rack's choice waits for the yard: not from the hall's door, 8 blocks from the ring.
    { do: 'teleport', to: { x: saltgateAt(30.5, 15.5).x, z: saltgateAt(30.5, 15.5).z } },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'nothing of the yard plays from inside the hall', that: (p) => !talking(p) },
    { do: 'teleport', to: at('rack', 1) },
    { do: 'interact', prompt: 'Take a weapon from the rack' },
    // The staff, and Dax at once: "Go on. Hit me."
    { do: 'talk', choice: 2 },
    { do: 'check', what: 'the bout is on', that: (p) => p.sys.opening.bout().on },
    beside('dax'),
    { do: 'run', name: 'land an aimed staff bolt', run: hitLid },
    { do: 'check', what: 'scenes 1 to 3 played once each', that: once([1, 2, 3]) },
    { do: 'reload' },
    { do: 'check', what: 'the bout comes back with one pip gone', that: (p) => p.sys.opening.bout().on && p.sys.opening.bout().guard === GUARD - 1 },
    { do: 'run', name: 'land another aimed staff bolt', run: hitLid },
    { do: 'run', name: 'land the last aimed staff bolt', run: hitLid },
    { do: 'wait', seconds: 0.1 },
    { do: 'talk' },
    { do: 'check', what: 'scene 4 is done by the bout', that: (p) => p.game.flags.is(FLAG.scene(4)) },
    // The grant starts in the yard, and the deed is signed as it ends: it holds the player until then.
    { do: 'teleport', to: at('deed', -1) },
    { do: 'wait', until: talking, seconds: 3 },
    { do: 'run', name: 'hear the Guildmaster out', run: (p) => { p.talkThrough(); if (p.sys.opening.asking() !== 'deed') throw new Error('no deed to sign'); } },
    { do: 'run', name: 'sign the deed', run: (p) => { if (!p.sys.opening.sign('Rowan')) throw new Error('the deed refused the name'); } },
    { do: 'teleport', to: at('berth', 0, -3) },
    { do: 'wait', until: talking, seconds: 3 },
    { do: 'talk' },
    { do: 'wait', seconds: 0.1 },
    { do: 'check', what: 'the ferry has pushed off', that: (p) => p.sys.opening.stage() === 'ferry' && step(p) === 'river' },
    { do: 'run', name: 'up the river to the landing', run: (p) => { p.teleport('landing'); p.sys.opening.ferryDone(); } },
    { do: 'wait', until: talking, seconds: 3 },
    { do: 'talk' },
    { do: 'wait', seconds: 0.2 },
    // Scenes 4 to 7 once each since the load, and 1 to 3 not again.
    { do: 'check', what: 'scenes 4 to 7 played once each, and 1 to 3 not again', that: (p) => once([4, 5, 6, 7])(p) && [1, 2, 3].every((n) => played(p, n) === 0) },
    { do: 'check', what: 'the hero stands at the landing', that: (p) => Math.hypot(p.game.player.pos.x - p.sys.region.place('landing').at.x, p.game.player.pos.z - p.sys.region.place('landing').at.z) < 3 },
    { do: 'wait', seconds: 5 },
    { do: 'check', what: 'nothing more plays at the landing', that: (p) => !talking(p) },
    ...again('bunk'),
    ...again('locks', -1),
    ...again('maps', -1, 1.5),
    ...again('deed', -1),
    ...again('berth', 0, -3),
  ],
  expect: (p) => [
    ['quest grantday is done, and quest ground has begun', p.game.flags.is(FLAG.questDone('grantday')) && p.sys.quests.tracked()?.id === 'ground'],
    ['scenes 1 to 7 played', ([1, 2, 3, 4, 5, 6, 7] as const).every((n) => p.game.flags.is(FLAG.scene(n)))],
    ['no scene of grant day played twice', [1, 2, 3, 4, 5, 6, 7].every((n) => played(p, n) <= 1)],
    ['the staff, the braid and the name Rowan', p.game.flags.get(FLAG.choice('weapon')) === 'staff' && p.sys.opening.hero().look === 'd' && p.sys.opening.hero().name === 'Rowan'],
    ['a meal today', p.game.flags.get(FLAG.mealDay) === p.game.clock.day],
    ['the guild\'s axe came up the river, once, as skipping grant day gives it', p.count('axe') === 1],
    ['and the guild\'s spade, for the ditch', p.count('spade') === 1],
  ],
};
