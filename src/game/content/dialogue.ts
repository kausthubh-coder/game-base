// Every conversation of the first part, as data. The interpreter is src/game/talk.
//
// talkTo(npc) starts the first conversation in this list for that person whose `when` holds, so each
// person's conversations run from the most specific to a fallback with no condition.
// A line is at most 18 words, a stage cue such as "(waking)" included. Nobody states the theme.
// Effects run when the conversation ends.

import type { NpcId } from '../api.sim.ts';
import { WHEAT_SHORT, WHEAT_WANTED, type Condition, type Effect } from './quests.ts';

export interface Choice {
  text: string;
  /** The choice is offered only when this holds. */
  when?: Condition;
  effects?: Effect[];
  /** Lines said after this choice. The conversation then goes on from the line after the choices. */
  then?: (string | Line)[];
}

export interface Line {
  /** Who says it. Defaults to the person the conversation is with. `narrator` has no name or portrait. */
  by?: NpcId | 'narrator';
  text: string;
  /** The line is skipped when this does not hold. */
  when?: Condition;
  effects?: Effect[];
  /** Up to three. */
  choices?: Choice[];
}

export interface Conversation {
  id: string;
  npc: NpcId;
  when?: Condition;
  /** Said one time only. The flag `said.<id>` remembers it. */
  once?: boolean;
  /** A plain string is a line by the person the conversation is with. */
  lines: (string | Line)[];
}

/** Names for the dialogue box when the people system does not know the speaker. */
export const SPEAKERS: Record<NpcId, string> = {
  tamsin: 'Tamsin', maren: 'Maren', odo: 'Odo', gus: 'Gus', mira: 'Mira', wren: 'Wren', juniper: 'Juniper', brack: 'Brack',
  custodian: 'The Custodian',
};

const flag = (name: string): Condition => ({ flag: name });
const no = (c: Condition): Condition => ({ not: c });
const both = (...all: Condition[]): Condition => ({ all });
const either = (...any: Condition[]): Condition => ({ any });
const step = (quest: string, id: string): Condition => ({ quest, step: id });
const narrator = (text: string, when?: Condition): Line => (when ? { by: 'narrator', text, when } : { by: 'narrator', text });
const custodian = (text: string): Line => ({ by: 'custodian', text });

/**
 * The speaker of a scene: a conversation a system starts by its id (`talk.start`) at a moment of the story.
 * Nobody is called this, so `talkTo` never picks one.
 */
export const SCENE: NpcId = 'scene';

/** The bonded leaftail is beside the player. */
const PET: Condition = { beside: 'leaftail' };
const RAIN: Condition = { raining: true };
/** The festival is on: from the dusk after the delivery until the next morning. */
const FESTIVAL = both(flag('festival.started'), no(flag('festival.over')));
/** The wheat is delivered and the festival has not begun. */
const TONIGHT = both(flag('bread.delivered'), no(flag('festival.started')));
/** The festival quest is open and the festival has begun, on the night or any day after. */
const AT_FESTIVAL = both({ quest: 'festival' }, flag('festival.started'));

const GUS_GIFT: (string | Line)[] = [
  {
    text: 'Hoe. Can. Twelve seeds. Break the ground, plant, keep it wet.',
    effects: [
      { give: 'hoe' }, { give: 'watering_can' }, { give: 'wheat_seeds', count: 12 },
      { flag: 'bread.seeds' }, { flag: 'met.gus' }, { learn: 'gus', fact: 'needs' }, { learn: 'gus', fact: 'gives' }, { befriend: 'gus' },
    ],
  },
  'Wet soil grows. Dry soil waits. That\'s all I know. It\'s enough.',
  'Rain\'d do it better. Rain always does it better.',
];

/** The morning after the first night: the Mark is on the player's hand and Tamsin has not seen it yet. */
const MORNING_AFTER = both(flag('mark'), no(flag('night.told')));

const WAIT_FOR_EVENING: Line = narrator('She is asleep before you sit. The light in the door turns gold.');

export const CONVERSATIONS: readonly Conversation[] = [
  // ------------------------------------------------------------------------------------ Tamsin
  // Low, dry, slow. She replants every hole she passes.
  {
    id: 'tamsin.meet',
    npc: 'tamsin',
    when: no(flag('plot.met')),
    lines: [
      'Twelve people have asked me for this plot.',
      'You are the first who looked at the ground before the view.',
      // The book is not a thing in the bag. The flag gives it, and the interface shows it being handed over.
      {
        text: 'Take the book. It has been blank for forty years.',
        effects: [{ flag: 'has.almanac' }],
      },
      'I only ever looked at things to price them.',
      narrator('She found it in a ruin, forty years ago. Every page is still empty.'),
      'Mosslings keep the rocks by the pond. Sit near one and write down what you see.',
      'Two columns. What it needs, and what it gives. Fill both.',
      {
        text: 'And an axe. You will want a roof before you want anything else.',
        effects: [{ give: 'axe' }],
      },
      {
        text: 'That is the advice. It weighs more than the axe.',
        effects: [{ flag: 'plot.met' }, { flag: 'met.tamsin' }, { learn: 'tamsin', fact: 'gives' }],
      },
    ],
  },
  {
    // The last scene, word for word from docs/play/act1.md. The director sends `act.ended` after it.
    id: 'tamsin.end',
    npc: 'tamsin',
    when: step('festival', 'end'),
    lines: [
      'Good harvest. Small, and good.',
      '(looking west) Evening came early again. A little sooner every week.',
      {
        text: 'Go on. Float your lamp.',
        effects: [{ flag: 'festival.ended' }, { give: 'river_lamp' }, { learn: 'tamsin', fact: 'needs' }, { befriend: 'tamsin' }],
      },
    ],
  },
  {
    // The morning after the first night: she is at the grant stone, with a few of the town behind her.
    id: 'tamsin.mark',
    npc: 'tamsin',
    when: step('night', 'tamsin'),
    lines: [
      '(looking at your hand) So the door opened. I saw the light from the lodge.',
      'Forty years I carried that book past that door. Neither one ever moved for me.',
      narrator('She takes a glove from her belt and puts it in your marked hand.'),
      'Wear it. In town, and above all near the priests of the Dawn.',
      {
        text: 'I will tell you why. Not today. Today you have a fox to feed.',
        effects: [{ flag: 'night.told' }, { befriend: 'tamsin' }],
      },
    ],
  },
  {
    // Never stuck: a lost axe is replaced.
    id: 'tamsin.axe',
    npc: 'tamsin',
    when: both(flag('plot.met'), no({ bag: 'axe' }), no(flag('owed.axe'))),
    lines: [
      'No axe. I will not ask where it went.',
      { text: '(taking another from her belt) This one has a notch. So you will know it.', effects: [{ give: 'axe' }] },
    ],
  },
  {
    id: 'tamsin.tell',
    npc: 'tamsin',
    when: step('plot', 'tell'),
    lines: [
      'Both columns. Let me see.',
      'Shade and mossy stone. And it pays in moss, where the ground is damp.',
      'Forty years I walked past them. I never asked what they wanted.',
      'Most things out here have two columns. The book has room.',
      'Now. The sun is moving. Cut wood, raise a roof, make a bed. Sleep under it.',
      'That stone door in your hill has never opened. Delvers tried for a century. Leave it be.',
      'There is a dead garden off the path. Something still tends it. Go gently, tomorrow.',
      {
        text: 'I keep the lodge in Hollowmere. Follow the path when you have slept.',
        effects: [{ flag: 'plot.told' }, { start: 'roof' }, { befriend: 'tamsin' }],
      },
    ],
  },
  {
    id: 'tamsin.show',
    npc: 'tamsin',
    when: both(step('leaftail', 'show'), PET),
    lines: [
      '(looking down) So that is what kept the old garden.',
      'You fed it first. I would have set a snare and priced the tail.',
      'Take it to Wren at the kennel. She talks to animals first. Do not take offence.',
      {
        text: 'Then the granary. The queen is short of wheat and shorter of sleep.',
        effects: [{ flag: 'leaftail.shown' }, { start: 'bread' }, { befriend: 'tamsin' }],
      },
    ],
  },
  {
    id: 'tamsin.show.alone',
    npc: 'tamsin',
    when: both(step('leaftail', 'show'), no(PET)),
    lines: [
      'You have the look of someone followed. Where is it?',
      'Fetch it. I would like to see what chose you.',
    ],
  },
  {
    id: 'tamsin.festival',
    npc: 'tamsin',
    when: both(AT_FESTIVAL, no(flag('festival.lamp'))),
    lines: [
      { text: 'Odo has a lamp for you. He will introduce you to a loaf first. Bear it.', when: no(flag('festival.lamp.given')) },
      { text: '(nodding at the water) Lamps go on the river. Not in the pocket.', when: flag('festival.lamp.given') },
    ],
  },
  {
    id: 'tamsin.tonight',
    npc: 'tamsin',
    when: TONIGHT,
    lines: [
      'Festival tonight. I am told to wear the good coat. I own one coat.',
      'Be on the bank at dusk.',
    ],
  },
  {
    id: 'tamsin.rain',
    npc: 'tamsin',
    when: RAIN,
    once: true,
    lines: ['(palm out) Forty years underground. I never once got rained on. Stand in it.'],
  },
  {
    id: 'tamsin.pet',
    npc: 'tamsin',
    when: both(PET, flag('leaftail.shown')),
    once: true,
    lines: [
      '(to the leaftail) Still following? Good judge.',
      'Has it brought you a seed yet? It will. Nobody asked it to.',
    ],
  },
  {
    id: 'tamsin.bed',
    npc: 'tamsin',
    when: both({ placed: 'bed' }, { quest: 'night', state: 'done' }),
    once: true,
    lines: ['You slept under your own roof. It shows. You stand differently.'],
  },
  {
    id: 'tamsin.watch.half',
    npc: 'tamsin',
    when: both(step('plot', 'watch'), { known: 'mossling', column: 'needs' }),
    lines: [
      'Shade and mossy stone. Good. That is what it needs.',
      'Now what it gives. Watch the ones on damp ground, by the pond. Be patient.',
    ],
  },
  {
    id: 'tamsin.watch',
    npc: 'tamsin',
    when: step('plot', 'watch'),
    lines: [
      'The rocks, in the shade. Sit still. They will not perform for you.',
      '(heeling a seedling into a boot print) Go on. The book is waiting.',
    ],
  },
  {
    id: 'tamsin.roof.wood',
    npc: 'tamsin',
    when: step('roof', 'wood'),
    lines: [
      'Oak takes an axe well. Twelve logs will do.',
      '(pressing an acorn into the turf) Do not mind me. Old habit.',
    ],
  },
  {
    id: 'tamsin.roof.build',
    npc: 'tamsin',
    when: either(step('roof', 'bench'), step('roof', 'shelter')),
    lines: [
      'A bed wants planks and fiber. Fiber comes off leaves, if you keep at them.',
      'And a block over the bed. Rain does not care how tired you are.',
    ],
  },
  {
    id: 'tamsin.roof.sleep',
    npc: 'tamsin',
    when: step('night', 'bed'),
    lines: ['Roof is on. Then stop working. The dark is for sleeping.'],
  },
  {
    id: 'tamsin.leaftail',
    npc: 'tamsin',
    when: { quest: 'leaftail' },
    lines: [
      'The garden\'s keeper startles. Walk as if the floor were asleep.',
      'Put the berry down. Then do nothing. Do it well.',
    ],
  },
  {
    id: 'tamsin.bread.early',
    npc: 'tamsin',
    when: either(step('bread', 'town'), step('bread', 'queen')),
    lines: ['The queen is at the granary. Wake her gently. She has earned the nap.'],
  },
  {
    id: 'tamsin.bread.grow',
    npc: 'tamsin',
    when: either(step('bread', 'seeds'), step('bread', 'grow')),
    lines: ['Wheat wants wet soil and patience. Only one of those comes in a can.'],
  },
  {
    id: 'tamsin.bread.deliver',
    npc: 'tamsin',
    when: step('bread', 'deliver'),
    lines: ['Twenty. Take them to her before she counts the sacks a third time.'],
  },
  {
    id: 'tamsin.after',
    npc: 'tamsin',
    when: flag('festival.ended'),
    once: true,
    lines: [
      'Still here. Good. The plot will want you in the morning.',
      { text: 'That lamp is no use in a pocket.', when: { bag: 'river_lamp' } },
    ],
  },
  {
    id: 'tamsin.fallback',
    npc: 'tamsin',
    lines: ['(pressing a seedling into a boot print) Mind where you dig. I only fill it in.'],
  },

  // ------------------------------------------------------------------------------------ Maren
  // The queen, 19. Quick, tired, asleep at her own table.
  {
    id: 'maren.deliver',
    npc: 'maren',
    when: both(step('bread', 'deliver'), { bag: 'wheat', atLeast: WHEAT_WANTED }),
    lines: [
      narrator('She is asleep on the ledger. You set the sheaves down. She wakes counting.'),
      {
        text: 'Eighteen. Nineteen. Twenty. You brought twenty.',
        effects: [
          { take: 'wheat', count: WHEAT_WANTED }, { flag: 'bread.delivered' }, { start: 'festival' },
          { befriend: 'maren', amount: 2 }, { learn: 'maren', fact: 'gives' },
        ],
      },
      'Forty sacks and twenty sheaves. That is one more week of bread. I will take a week.',
      'Odo gets the first of it tonight. Come to the square at dusk.',
      {
        text: 'That is the good meal. The thanks is this. Thank you.',
        choices: [
          { text: 'I\'ll wait here for evening.', effects: [{ flag: 'festival.wait' }], then: [WAIT_FOR_EVENING] },
          { text: 'I have things to do first.', then: ['Then do them fast. Dusk does not wait. I have checked.'] },
        ],
      },
    ],
  },
  {
    id: 'maren.deliver.short',
    npc: 'maren',
    when: both(step('bread', 'deliver'), no({ bag: 'wheat', atLeast: WHEAT_WANTED })),
    lines: [
      '(counting your sheaves) That is not twenty. Counting is the one thing I can do.',
      'Come back with twenty. Gus will spot you seed if you are short.',
    ],
  },
  {
    // A player who came in past the gate is still on the `town` step. She asks all the same.
    id: 'maren.ask',
    npc: 'maren',
    when: either(step('bread', 'town'), step('bread', 'queen')),
    lines: [
      narrator('A girl is asleep across the ledgers, a pen still in her hand.'),
      '(waking) Forty sacks. I counted twice. It is not enough, and counting again will not make it enough.',
      'Twenty sheaves by the festival. I can pay you in thanks and one good meal.',
      {
        text: 'You are the one on Tamsin\'s grant. You have a field. I have a winter.',
        effects: [{ flag: 'bread.asked' }, { flag: 'met.maren' }, { learn: 'maren', fact: 'needs' }],
        choices: [
          { text: 'Twenty sheaves. Done.', then: ['Gus has seed. Tell him I said please. He likes that.'] },
          {
            text: 'Why is there not enough?',
            then: ['Same fields, same hands, thinner sacks. Gus says the soil is tired.', 'So am I. Go and see him. He has seed.'],
          },
          {
            text: 'Is being queen always this?',
            then: ['They crowned me at sixteen because I could add. Nobody said the adding never stops.', 'Gus has seed. Go, before I count something.'],
          },
        ],
      },
    ],
  },
  {
    id: 'maren.tonight',
    npc: 'maren',
    when: TONIGHT,
    lines: [
      {
        text: 'Dusk yet? No. Then I can sleep, or you can wait with me.',
        choices: [
          { text: 'Wait for evening.', effects: [{ flag: 'festival.wait' }], then: [WAIT_FOR_EVENING] },
          { text: 'Not yet.', then: ['Then go quietly. I was nearly asleep.'] },
        ],
      },
    ],
  },
  {
    id: 'maren.festival',
    npc: 'maren',
    when: FESTIVAL,
    lines: [
      '(holding a heel of bread) I am not counting tonight. Ask me tomorrow how many I ate.',
      'Twenty sheaves. I wrote your name in the ledger. In ink.',
    ],
  },
  {
    id: 'maren.pet',
    npc: 'maren',
    when: both(PET, flag('met.maren')),
    once: true,
    lines: ['(one eye open) It has a leaf for a tail. Wren feeds it? Good. One less to count.'],
  },
  {
    id: 'maren.waiting',
    npc: 'maren',
    when: either(step('bread', 'seeds'), step('bread', 'grow')),
    lines: [
      '(not looking up) Thirty-nine sacks. A mouse got one. Do not tell Odo.',
      { text: 'Rain on the roof. Good. Gus will be unbearable. Good.', when: RAIN },
      { text: 'Is it grown? No. Then I am still counting.', when: no(RAIN) },
    ],
  },
  {
    id: 'maren.first',
    npc: 'maren',
    when: { quest: 'bread', state: 'hidden' },
    lines: [
      narrator('A girl is asleep across the ledgers, a pen still in her hand.'),
      '(not opening her eyes) If it is about the sacks, there are forty. Come back later.',
    ],
  },
  {
    id: 'maren.after',
    npc: 'maren',
    when: flag('festival.over'),
    once: true,
    lines: ['Your twenty are milled. I counted them once. Once was enough, for once.'],
  },
  {
    id: 'maren.fallback',
    npc: 'maren',
    lines: [narrator('She is asleep on the ledger. It says forty, twice. You let her be.')],
  },

  // ------------------------------------------------------------------------------------ Gus
  // Slow, flat. Every problem is a soil problem, and he is right. He wants rain.
  {
    id: 'gus.mark',
    npc: 'gus',
    when: MORNING_AFTER,
    lines: ['Door\'s open. Hm. Soil round it looks better already. Could be the light.'],
  },
  {
    // Never stuck: four more seeds when the harvest cannot reach twenty any more.
    id: 'gus.more',
    npc: 'gus',
    when: both(flag('bread.seeds'), no(flag('bread.delivered')), WHEAT_SHORT, no(flag('owed.wheat_seeds'))),
    lines: [
      'Came up short. Happens. Soil forgives it.',
      { text: 'Four more. Wet them this time. Or don\'t, and see me again.', effects: [{ give: 'wheat_seeds', count: 4 }] },
    ],
  },
  {
    id: 'gus.seeds.first',
    npc: 'gus',
    when: both(step('bread', 'seeds'), no(flag('met.gus'))),
    lines: [
      narrator('A man is crouched in a furrow, rubbing dirt between two fingers.'),
      'Soil\'s tired. Not lazy. Tired. You\'d be too.',
      'Maren sent you. She said please? Huh. She\'s worried, then.',
      ...GUS_GIFT,
    ],
  },
  {
    id: 'gus.seeds',
    npc: 'gus',
    when: step('bread', 'seeds'),
    lines: ['You again. Maren sent you. She said please? Huh.', ...GUS_GIFT],
  },
  {
    id: 'gus.first',
    npc: 'gus',
    when: no(flag('met.gus')),
    lines: [
      narrator('A man is crouched in a furrow, rubbing dirt between two fingers.'),
      'Soil\'s tired. Not lazy. Tired. You\'d be too.',
      { text: 'You want seed, see the queen. She keeps the count. I keep the dirt.', effects: [{ flag: 'met.gus' }] },
    ],
  },
  {
    id: 'gus.festival',
    npc: 'gus',
    when: FESTIVAL,
    lines: [
      'Good wheat. Short straw, heavy head. Your soil\'s not tired yet.',
      'Clear night. I\'d have liked rain. Don\'t tell the lamp people.',
    ],
  },
  {
    id: 'gus.rain',
    npc: 'gus',
    when: RAIN,
    once: true,
    lines: ['(hat off, face up) There. Rain.', 'Go look at your field. It\'s doing your job for you.'],
  },
  {
    id: 'gus.pet',
    npc: 'gus',
    when: PET,
    once: true,
    lines: ['That leaftail digs. Good. Digging\'s half of farming. Other half\'s waiting.'],
  },
  {
    id: 'gus.grow',
    npc: 'gus',
    when: both(step('bread', 'grow'), no(WHEAT_SHORT)),
    lines: [
      'Don\'t watch it. It knows how. Keep it wet and go do something else.',
      'Sleep on it, if it\'s wet. Wheat does its best work when you\'re not looking.',
    ],
  },
  {
    id: 'gus.deliver',
    npc: 'gus',
    when: step('bread', 'deliver'),
    lines: ['That\'s twenty. Don\'t stand here with it. The queen\'s the one counting.'],
  },
  {
    id: 'gus.tonight',
    npc: 'gus',
    when: TONIGHT,
    lines: ['Festival tonight. I\'ll stand at the back. Somebody has to watch the sky.'],
  },
  {
    id: 'gus.fallback',
    npc: 'gus',
    lines: ['It\'s the soil. Whatever it is. It\'s the soil.'],
  },

  // ------------------------------------------------------------------------------------ Odo
  // Warm, bouncy. He names every loaf and wants his oven lit before dawn.
  {
    id: 'odo.lamp',
    npc: 'odo',
    when: both(AT_FESTIVAL, no(flag('festival.lamp.given'))),
    lines: [
      'There you are! This is Bertha. First loaf from your wheat. Say hello, Bertha.',
      {
        text: 'Every loaf gets a lamp on the river tonight. This one is hers.',
        effects: [{ give: 'river_lamp' }, { flag: 'festival.lamp.given' }, { flag: 'met.odo' }, { learn: 'odo', fact: 'gives' }, { befriend: 'odo' }],
      },
      'Float it from the bank for me? My hands are all flour.',
    ],
  },
  {
    // Never stuck: a lost lamp is replaced.
    id: 'odo.lamp.again',
    npc: 'odo',
    when: both(AT_FESTIVAL, flag('festival.lamp.given'), no(flag('festival.lamp')), no({ bag: 'river_lamp' }), no(flag('owed.river_lamp'))),
    lines: [{ text: 'Lost her lamp? Bertha forgives you. She\'s bread. Here, another.', effects: [{ give: 'river_lamp' }] }],
  },
  {
    id: 'odo.lamp.go',
    npc: 'odo',
    when: both(AT_FESTIVAL, flag('festival.lamp.given'), no(flag('festival.lamp')), { bag: 'river_lamp' }),
    lines: ['Go on, the bank! Bertha\'s waiting. She can\'t swim, mind. Just the lamp.'],
  },
  {
    id: 'odo.festival',
    npc: 'odo',
    when: FESTIVAL,
    lines: ['Did she float? Good girl. That\'s Bertha, Humphrey and Small Agnes all away.'],
  },
  {
    id: 'odo.first',
    npc: 'odo',
    when: no(flag('met.odo')),
    lines: [
      'Morning! Or afternoon! Mind Gertrude, she\'s cooling. The round one.',
      'I\'m Odo. I name them. You can\'t eat a thing until you\'ve been introduced.',
      {
        text: 'Oven\'s lit at four. Flour allowing. Lately, flour is not allowing much.',
        effects: [{ flag: 'met.odo' }, { learn: 'odo', fact: 'needs' }],
      },
    ],
  },
  {
    id: 'odo.tonight',
    npc: 'odo',
    when: TONIGHT,
    lines: ['Your wheat\'s in the oven! First loaf out gets a name tonight. I\'m thinking Bertha.'],
  },
  {
    id: 'odo.rain',
    npc: 'odo',
    when: RAIN,
    once: true,
    lines: ['Rain! Dough loves it. Rises like it\'s got somewhere to be.'],
  },
  {
    id: 'odo.pet',
    npc: 'odo',
    when: PET,
    once: true,
    lines: ['Is that a leaftail? Keep it off Gertrude. She\'s a seed loaf.'],
  },
  {
    id: 'odo.bread',
    npc: 'odo',
    when: { quest: 'bread' },
    lines: ['Twenty sheaves? That\'s forty loaves. That\'s forty names! I\'d better start a list.'],
  },
  {
    id: 'odo.fallback',
    npc: 'odo',
    lines: ['Can\'t stop, Humphrey\'s proving. Come back hungry!'],
  },

  // ------------------------------------------------------------------------------------ Mira
  // Bright, fast. She measures you while you talk.
  {
    id: 'mira.first',
    npc: 'mira',
    when: no(flag('met.mira')),
    lines: [
      'Hold still. Arm out. No, the other one. Thank you.',
      'Mira. Carpenter. You\'re a hand taller than the last grant holder. Longer bed.',
      {
        text: 'Build anything, tell me the numbers. Nobody ever tells me the numbers.',
        effects: [{ flag: 'met.mira' }, { learn: 'mira', fact: 'needs' }, { learn: 'mira', fact: 'gives' }],
      },
    ],
  },
  {
    id: 'mira.festival',
    npc: 'mira',
    when: FESTIVAL,
    lines: ['I measured the square for the tables. Nine paces by eleven. Very satisfying.'],
  },
  {
    id: 'mira.bed',
    npc: 'mira',
    when: { placed: 'bed' },
    once: true,
    lines: [
      'You built a bed! How long? You didn\'t measure. Nobody measures.',
      '(holding the rule to your shoulder) Never mind. I\'ll work it out backwards.',
    ],
  },
  {
    id: 'mira.pet',
    npc: 'mira',
    when: PET,
    once: true,
    lines: ['(crouching with the rule) Tail\'s longer than the body. I knew it. Wren owes me a bun.'],
  },
  {
    id: 'mira.rain',
    npc: 'mira',
    when: RAIN,
    once: true,
    lines: ['Rain swells a board a finger in ten. I\'ve a chart. Want to see the chart?'],
  },
  {
    id: 'mira.tonight',
    npc: 'mira',
    when: TONIGHT,
    lines: ['Festival tonight! Forty lamp frames to square. Hold this. No, don\'t. Go.'],
  },
  {
    id: 'mira.fallback',
    npc: 'mira',
    lines: ['Stand there a second. Just the shoulders. Done. Carry on.'],
  },

  // ------------------------------------------------------------------------------------ Wren
  // Soft. She talks to your pet first, and wants every pet fed.
  {
    id: 'wren.show',
    npc: 'wren',
    when: both(step('leaftail', 'show'), PET),
    lines: [
      '(to the leaftail) Hello, small one. You\'ve been eating. Berries?',
      '(to the leaftail) And who is this you\'ve brought me?',
      'It kept that dead garden alone for years. Nobody fed it. It kept on.',
      'It will bring you seeds now. Don\'t ask it to. It just will.',
      {
        text: 'The queen needs hands for the harvest. Granary, past the square. Both of you.',
        effects: [
          { flag: 'leaftail.shown' }, { start: 'bread' }, { flag: 'met.wren' },
          { learn: 'wren', fact: 'needs' }, { learn: 'wren', fact: 'gives' }, { befriend: 'wren' },
        ],
      },
    ],
  },
  {
    id: 'wren.show.alone',
    npc: 'wren',
    when: both(step('leaftail', 'show'), no(PET)),
    lines: ['You smell of berries and something small. Bring it. I\'d like to say hello.'],
  },
  {
    id: 'wren.first',
    npc: 'wren',
    when: no(flag('met.wren')),
    lines: [
      { text: '(looking past you, at the ground) Oh. Nobody with you. Just you, then.', when: no(PET) },
      { text: '(to the leaftail) Hello, you. Is this one yours?', when: PET, effects: [{ learn: 'wren', fact: 'gives' }] },
      {
        text: 'I\'m Wren. I keep the kennel. Everything here has eaten today. Have you?',
        effects: [{ flag: 'met.wren' }, { learn: 'wren', fact: 'needs' }],
      },
      { text: 'If something follows you home, bring it by. I\'d like to say hello.', when: no(PET) },
    ],
  },
  {
    id: 'wren.festival',
    npc: 'wren',
    when: FESTIVAL,
    lines: [
      { text: '(to the leaftail) Too many feet tonight. Stay close to yours.', when: PET },
      { text: 'The dogs get the crusts tonight. They\'ve been told. They\'re pretending they haven\'t.', when: no(PET) },
    ],
  },
  {
    id: 'wren.rain',
    npc: 'wren',
    when: RAIN,
    once: true,
    lines: ['Everyone\'s in the straw, listening to the roof. Best sound there is.'],
  },
  {
    id: 'wren.leaftail',
    npc: 'wren',
    when: { quest: 'leaftail' },
    lines: [
      'The one in the dead garden? Walk soft.',
      'Put the berry down and step back. Let it choose. It will.',
    ],
  },
  {
    id: 'wren.pet',
    npc: 'wren',
    when: PET,
    lines: [
      { text: '(to the leaftail) Is this one feeding you? Blink once for yes.', effects: [{ learn: 'wren', fact: 'gives' }] },
      'It blinked. You\'re doing fine.',
    ],
  },
  {
    id: 'wren.fallback',
    npc: 'wren',
    lines: ['Bowls are full. That\'s my whole news. It\'s good news.'],
  },

  // ------------------------------------------------------------------------------------ Juniper
  // A child. High, fast. She trades secrets for sweets, and a berry counts as a sweet.
  {
    id: 'juniper.mark',
    npc: 'juniper',
    when: MORNING_AFTER,
    lines: ['There was a LIGHT in the hill. I saw it first. Tell them I saw it first.'],
  },
  {
    id: 'juniper.first',
    npc: 'juniper',
    when: no(flag('met.juniper')),
    lines: [
      'You\'re the new one! From the stone! Have you got any sweets?',
      {
        text: 'A berry\'s a sweet. A berry counts. I\'ve got secrets. Good ones.',
        effects: [{ flag: 'met.juniper' }, { learn: 'juniper', fact: 'needs' }],
      },
    ],
  },
  {
    id: 'juniper.festival',
    npc: 'juniper',
    when: FESTIVAL,
    lines: ['I get to push the stuck lamps off with a stick! Only the stuck ones. That\'s the rule.'],
  },
  {
    id: 'juniper.pet',
    npc: 'juniper',
    when: PET,
    once: true,
    lines: ['It\'s got a LEAF for a TAIL. Does it know? Don\'t tell it.'],
  },
  {
    id: 'juniper.rain',
    npc: 'juniper',
    when: RAIN,
    once: true,
    lines: ['I\'m not wet, I\'m fast. Rain can\'t land on fast.'],
  },
  {
    // Four secrets, one a berry. `juniper.secrets` counts the ones told.
    id: 'juniper.trade',
    npc: 'juniper',
    when: both({ bag: 'berry' }, no(flag('juniper.told.all'))),
    lines: [
      {
        text: 'Is that a berry? That\'s a sweet! Swap you. One berry, one secret.',
        choices: [
          {
            text: 'Give her a berry.',
            effects: [{ take: 'berry' }, { add: 'juniper.secrets', amount: 1 }, { learn: 'juniper', fact: 'gives' }],
            then: [
              { text: 'Secret. The queen sleeps on the ledger. It prints numbers on her face. Backwards.', when: no(flag('juniper.secrets')) },
              { text: 'Secret. Wet wheat grows two whole sizes while you sleep. Gus told the wheat, not me.', when: { flag: 'juniper.secrets', is: 1 } },
              { text: 'Secret. Odo cried when Gertrude sold. He said onions. There weren\'t onions.', when: { flag: 'juniper.secrets', is: 2 } },
              {
                text: 'Secret. Tamsin\'s sword is under the lodge floor. She grew beans on top.',
                when: { flag: 'juniper.secrets', is: 3 },
                effects: [{ flag: 'juniper.told.all' }],
              },
            ],
          },
          { text: 'Not today.', then: ['Then no secret. That\'s the rule. I made it.'] },
        ],
      },
    ],
  },
  {
    id: 'juniper.out',
    npc: 'juniper',
    when: flag('juniper.told.all'),
    lines: ['I\'m out of secrets. I have to go and find out more. Don\'t follow me.'],
  },
  {
    id: 'juniper.tonight',
    npc: 'juniper',
    when: TONIGHT,
    lines: ['Festival\'s tonight! Odo makes the little sweet ones. I know where he hides them.'],
  },
  {
    id: 'juniper.fallback',
    npc: 'juniper',
    lines: ['No sweets, no secrets. I don\'t make the rules. I do. I do make them.'],
  },

  // ------------------------------------------------------------------------------------ Brack
  // The ferryman from downriver. Gravel. He smells of reeds and wants his river back.
  {
    id: 'brack.mark',
    npc: 'brack',
    when: MORNING_AFTER,
    lines: ['Gran said that door would open one day. Gran said a lot of things.'],
  },
  {
    // He says the river is lower here, once, as the last line. Nobody answers him and nobody says it again.
    id: 'brack.first',
    npc: 'brack',
    when: no(flag('met.brack')),
    lines: [
      'Brack. Ferry\'s mine. So\'s the smell, before you ask. Reeds.',
      'You\'re the one Tamsin gave the plot. Good. Somebody ought to stay put.',
      {
        text: 'River\'s a hand lower than spring. I mark it on the post. Nobody asks.',
        effects: [{ flag: 'met.brack' }, { flag: 'brack.river' }, { learn: 'brack', fact: 'needs' }],
      },
    ],
  },
  {
    id: 'brack.festival',
    npc: 'brack',
    when: FESTIVAL,
    lines: ['Lamps drift past my dock by morning. I count them. Somebody should.'],
  },
  {
    id: 'brack.bread',
    npc: 'brack',
    when: flag('bread.delivered'),
    once: true,
    lines: [{ text: 'Heard you fed the queen. Downriver they\'d have made you mayor for less.', effects: [{ learn: 'brack', fact: 'gives' }] }],
  },
  {
    id: 'brack.pet',
    npc: 'brack',
    when: PET,
    once: true,
    lines: [{ text: 'Leaftail. Banks downriver were thick with them once. Like frogs. Once.', effects: [{ learn: 'brack', fact: 'gives' }] }],
  },
  {
    id: 'brack.rain',
    npc: 'brack',
    when: RAIN,
    once: true,
    lines: ['Rain on the water. Only time she sounds like herself.'],
  },
  {
    id: 'brack.tonight',
    npc: 'brack',
    when: TONIGHT,
    lines: ['Festival. I\'ll bring the boat round. Someone has to fish the children out.'],
  },
  {
    id: 'brack.fallback',
    npc: 'brack',
    lines: ['Ferry runs when I say. Today I don\'t say. Mind the wet planks.'],
  },

  // ------------------------------------------------------------------------------------ Ilara's Hall
  // The scenes of the first night. src/game/hall starts each one by its id, and acts on the flag it sets.
  {
    id: 'door.shut',
    npc: SCENE,
    lines: [
      narrator('A door of pale stone in an old wall. Roots have grown across it.'),
      { by: 'narrator', text: 'You push. It does not move. It has not moved in a thousand years.', effects: [{ flag: 'door.seen' }] },
    ],
  },
  {
    id: 'night.door',
    npc: SCENE,
    lines: [
      narrator('The fox is grey from nose to tail. Its eyes are dull, and it does not blink.'),
      narrator('Your back is against the stone door. You raise the axe.'),
      narrator('It is thin. It is shaking. You let the axe fall.'),
      { by: 'narrator', text: 'Behind you, stone moves for the first time in a thousand years.', effects: [{ flag: 'door.open' }] },
    ],
  },
  {
    id: 'hall.mark',
    npc: SCENE,
    lines: [
      narrator('Lamps wake along the walls, one after another, as if someone walked ahead of you.'),
      narrator('Your hand burns. A mark is rising under the skin: a ring of seven points.'),
      {
        by: 'narrator', text: 'It does not hurt for long. It feels like something you had forgotten.',
        effects: [{ flag: 'mark' }, { flag: 'hall.lit' }],
      },
    ],
  },
  {
    id: 'hall.mural',
    npc: SCENE,
    lines: [
      narrator('A king, carved taller than the rest. Beside him stand seven figures.'),
      { by: 'narrator', text: 'Six are whole. The seventh has been cut away, down to bare stone.', effects: [{ flag: 'mural.seen' }] },
    ],
  },
  {
    // The same look once the Custodian is awake to be asked.
    id: 'hall.mural.asked',
    npc: SCENE,
    lines: [
      narrator('A king, carved taller than the rest. Beside him stand seven figures.'),
      narrator('Six are whole. The seventh has been cut away, down to bare stone.'),
      { by: 'custodian', text: 'Do not ask me yet. I lost most of it. I only know that I am angry.', effects: [{ flag: 'mural.seen' }] },
    ],
  },
  {
    id: 'hall.gate',
    npc: SCENE,
    lines: [narrator('A stone arch, three paces wide. It leads nowhere.')],
  },
  {
    id: 'hall.gate.asked',
    npc: SCENE,
    lines: [
      narrator('A stone arch, three paces wide. It leads nowhere.'),
      { by: 'custodian', text: 'A Gate. It is dead. It wants more than one roof and a fox.' },
    ],
  },
  {
    id: 'fox.calm',
    npc: SCENE,
    lines: [
      narrator('You hold out your marked hand. The fox stops shaking.'),
      narrator('Grey runs out of its fur like water. Under it, red fur and a leaf for a tail.'),
      { by: 'narrator', text: 'It looks at you. Then it slips out of the door, west, toward the old garden.', effects: [{ flag: 'fox.calmed' }] },
    ],
  },

  // ------------------------------------------------------------------------------------ the Custodian
  // Ilara's own beast: small, patched with brass, a thousand years old and short of patience. It counts things.
  {
    id: 'custodian.wake',
    npc: SCENE,
    lines: [
      narrator('A small beast of moss and brass sleeps on a plinth. There is a keyhole in its back.'),
      narrator('The key on your cord has never fitted any lock. It fits this one.'),
      custodian('(one eye opening) You\'re late.'),
      custodian('A thousand years late. I counted. There was nothing else to do.'),
      custodian('Show me the hand. Yes. That is her mark. So it is you, then.'),
      custodian('I am the Custodian. I kept this hall for Ilara. Now I keep it for you.'),
      { by: 'custodian', text: 'The fox, first. It is Blighted, not wicked. Hold out the hand.', effects: [{ flag: 'custodian.awake' }] },
    ],
  },
  {
    id: 'heart.first',
    npc: SCENE,
    lines: [
      custodian('That is the Heartstone. It runs on what is alive up there, on your land.'),
      custodian('Every roof. Every field. Every beast that trusts you. It all comes down here.'),
      custodian('(squinting at it) So far: one roof. I have seen brighter puddles.'),
      custodian('Fill it, and that arch wakes. Then I will have something to explain.'),
      { by: 'custodian', text: 'Sleep now. You look the way the fox did.', effects: [{ flag: 'heart.seen' }] },
    ],
  },
  {
    id: 'custodian.fox',
    npc: 'custodian',
    when: no(flag('fox.calmed')),
    lines: ['The fox, first. Hold out the hand. It remembers that mark.'],
  },
  {
    id: 'custodian.heart',
    npc: 'custodian',
    when: no(flag('heart.seen')),
    lines: ['Now the stone. Go and touch it. It does not bite. I checked.'],
  },
  {
    id: 'custodian.sleep',
    npc: 'custodian',
    when: step('night', 'sleep'),
    lines: ['Sleep. Up there, under your roof. I have slept enough for both of us.'],
  },
  {
    id: 'custodian.leaftail',
    npc: 'custodian',
    when: { quest: 'leaftail' },
    lines: ['The fox went home to its garden. Feed it. A pact starts with food.'],
  },
  {
    id: 'custodian.fallback',
    npc: 'custodian',
    lines: ['(lining pebbles up in a row) Three hundred and sixty-five thousand days. Ask me a number.'],
  },
];

export interface VillagerLine {
  id: string;
  text: string;
  /** A line with a condition is said only while it holds, and then ahead of the everyday ones. */
  when?: Condition;
}

/**
 * The pool for background villagers: anyone with no conversations of their own. Each villager has one
 * line a day, picked by their id.
 */
export const VILLAGER_LINES: readonly VillagerLine[] = [
  { id: 'villager.1', text: 'Teal roofs. My grandmother picked the color. Nobody\'s had the nerve to change it.' },
  { id: 'villager.2', text: 'The well\'s sweet this year. Don\'t tell the next town.' },
  { id: 'villager.3', text: 'You\'re on the old grant? Twelve of us asked for it. I\'m not bitter. A bit bitter.' },
  { id: 'villager.4', text: 'Odo named a loaf after my husband. It was a flat one. Fair.' },
  { id: 'villager.5', text: 'The queen was asleep in the granary again. We go round. Quietly.' },
  { id: 'villager.6', text: 'Sawmill\'s quiet today. Mira\'s in there, measuring the quiet.' },
  { id: 'villager.7', text: 'Tamsin filled a hole by my door. Now I\'ve a pear tree. Didn\'t ask.' },
  { id: 'villager.8', text: 'If Juniper sells you a secret, it\'s about me. It isn\'t true. Mostly.' },
  { id: 'villager.9', text: 'First festival? Stand by the river when the lamps go. Say nothing. That\'s the trick.', when: FESTIVAL },
  { id: 'villager.10', text: 'I\'ve had four of Odo\'s loaves tonight. I was introduced to every one.', when: FESTIVAL },
  { id: 'villager.11', text: 'Gus is standing in his field with his hat off. Means it\'s really raining.', when: both(RAIN, no(FESTIVAL)) },
  { id: 'villager.12', text: 'That your wheat in the granary? The queen smiled. I saw teeth.', when: TONIGHT },
];
