// Every line of act 1, as data: the 38 scenes of handbook chapter 22 (its second pass, word for word), the
// choices the story remembers, the dinner table, and what each person says when you walk up to them. The
// interpreter is src/game/talk. How each scene is shown and what starts it is ./scenes.ts.
//
// talkTo(npc) starts the first conversation in this list for that person whose `when` holds, so each person's
// conversations run from the most specific to a fallback with no condition: an unmet need, a wish just granted,
// a moment, then the chapter (chapter 22, "Walk-up lines"). A walk-up line is one line.
// A line is at most 18 words, a stage cue such as "(waking)" included. Nobody states the theme. The player never
// speaks: a choice is something the player does. Effects run when the conversation ends.
//
// Voices: tools/voice.ts makes a clip for each line a person in ./cast.ts says, looked up by speaker and words.
// So a conversation's id and a line's words are its name: change the words and the clip is made again.

import type { ChoiceId, NpcId, PersonId, QuestId, SceneNumber } from './ids.ts';
import { FARM_IDS, LEDGER_SECTIONS } from './ids.ts';
import { FLAG } from './flags.ts';
import type { Condition, Effect } from './quests.ts';
import { OPENING_TALKS } from './opening.ts';
import type { SceneKind } from './scenes.ts';

/** The three faces each portrait has (`<who>-calm`, `-glad`, `-troubled` in the manifest). No mood is calm. */
export type Mood = 'calm' | 'glad' | 'troubled';

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
  /** The speaker's face for this line. */
  mood?: Mood;
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
  /** The scene of chapter 22 it plays. Its end sets `scene.<n>` and sends `scene.played`. */
  scene?: SceneNumber;
  /** How it is shown, when not its scene's kind (./scenes.ts). Plain talk otherwise. */
  kind?: SceneKind;
  /** The lines are a pool, not a conversation: one of them is said, a different one each day. */
  pool?: boolean;
  /** A plain string is a line by the person the conversation is with. */
  lines: (string | Line)[];
}

/** Names for the dialogue box when the people system does not know the speaker. */
export const SPEAKERS: Partial<Record<NpcId, string>> = {
  tamsin: 'Tamsin', maren: 'Queen Maren', gus: 'Gus', wren: 'Wren', custodian: 'The Custodian',
  hobb: 'Hobb', dax: 'Dax', mina: 'Mina', guildmaster: 'The Guildmaster', tansy: 'Tansy', holt: 'Holt', elowen: 'The Green Mother',
  calla: 'Calla', aldric: 'Brother Aldric', ren: 'Ren', stag: 'The Verdant Stag', ilara: 'Ilara', auren: 'Auren',
  // One-off speakers in the scenes.
  'voice.girl': 'The girl', 'voice.boy': 'The boy', 'voice.old-woman': 'The old woman', 'voice.a-voice': 'A voice',
};

/**
 * The speaker of a scene: a conversation a system starts by its id (`talk.start`) at a moment of the story.
 * Nobody is called this, so `talkTo` never picks one.
 */
export const SCENE: NpcId = 'scene';

// ------------------------------------------------------------------------------------------ helpers

const flag = (name: string): Condition => ({ flag: name });
const is = (name: string, value: string): Condition => ({ flag: name, is: value });
const no = (c: Condition): Condition => ({ not: c });
const both = (...all: Condition[]): Condition => ({ all });
const either = (...any: Condition[]): Condition => ({ any });
const step = (quest: QuestId, id: string): Condition => ({ quest, step: id });
const chapter = (n: 1 | 2 | 3 | 4 | 5): Condition => ({ chapter: n });
const scene = (n: SceneNumber): Condition => flag(FLAG.scene(n));
const chose = <C extends ChoiceId>(choice: C, value: string): Condition => is(FLAG.choice(choice), value);
/** One of the three needs of someone on your land is not met. The settlement sets these. */
const need = (who: PersonId, what: 'bed' | 'meal' | 'lamp'): Condition => flag(FLAG.need(who, what));

const narrator = (text: string, extra: Partial<Line> = {}): Line => ({ by: 'narrator', text, ...extra });
/** Lines by one person: `hobb('Up, Button.', 'glad')`. */
const by = (who: NpcId) => (text: string, mood?: Mood, extra: Partial<Line> = {}): Line => ({ by: who, text, ...(mood ? { mood } : {}), ...extra });
const hobb = by('hobb'), dax = by('dax'), mina = by('mina'), custodian = by('custodian'), tamsin = by('tamsin');
const wren = by('wren'), maren = by('maren'), gus = by('gus'), elowen = by('elowen'), calla = by('calla');
const aldric = by('aldric'), stag = by('stag'), ilara = by('ilara'), auren = by('auren'), ren = by('ren');
const guildmaster = by('guildmaster'), girl = by('voice.girl'), boy = by('voice.boy'), oldWoman = by('voice.old-woman');
const aVoice = by('voice.a-voice');

/** A scene of chapter 22, started by the story director (or the hall) by its id. */
const play = (n: SceneNumber, lines: (string | Line)[], extra: Partial<Conversation> = {}): Conversation =>
  ({ id: `scene.${n}`, npc: SCENE, scene: n, lines, ...extra });

/** What someone says on taking the job they were walked to: `took.<who>.<job>`, with nobody to talk to. */
const took = (who: PersonId, job: string, line: Line): Conversation => ({ id: `took.${who}.${job}`, npc: SCENE, lines: [line] });

/** A walk-up line: one line, said while `when` holds. */
const walkUp = (who: PersonId, id: string, when: Condition | undefined, text: string, extra: Partial<Conversation> = {}): Conversation =>
  ({ id: `${who}.${id}`, npc: who, ...(when ? { when } : {}), lines: [text], ...extra });

/** The three need lines of someone on your land, in the order chapter 22 gives: bed, meal, lamp. */
const needs = (who: PersonId, bed: string, meal: string, lamp: string): Conversation[] => [
  walkUp(who, 'need.bed', need(who, 'bed'), bed),
  walkUp(who, 'need.meal', need(who, 'meal'), meal),
  walkUp(who, 'need.lamp', need(who, 'lamp'), lamp),
];

/** The line said once, the day their wish is granted. */
const wish = (who: PersonId, text: string): Conversation => walkUp(who, 'wish', flag(FLAG.wish(who)), text, { once: true });

/** Any farm is on Take. */
const TAKING: Condition = either(...FARM_IDS.map((farm) => is(FLAG.farmMode(farm), 'take')));
/** The queen's ledger has a section filled, and all four. */
const LEDGER_BEGUN: Condition = either(...LEDGER_SECTIONS.map((s) => flag(FLAG.ledgerFilled(s))));
const LEDGER_FULL: Condition = both(...LEDGER_SECTIONS.map((s) => flag(FLAG.ledgerFilled(s))));
/** The Order's pump is running in the player's field. The goods system runs it; the choice sets it going. */
const PUMP_ON: Condition = either(flag(FLAG.pumpRunning), both(chose('pump', 'running'), no({ flag: FLAG.pumpRunning, is: false })));

export const CONVERSATIONS: readonly Conversation[] = [
  // ======================================================================================== chapter 1: the Shut Door
  // Grant day, in the guild hall at Saltgate. The opening builds the set; these are its lines.
  play(1, [
    hobb('(from the door) Up, Button. Grant day. Nobody signs a deed on an empty stomach.', 'glad'),
    narrator('Above your bunk: a king, six friends in gold, and the bare patch you used to hold a candle to.'),
    hobb('Sixteen years you\'ve been staring at that wall. Never the nice bits. Always the damp.'),
    hobb('I kept your basket, you know. Don\'t tell Dax. He\'d want it for kindling.', 'glad'),
    hobb('Porridge. All of it. Then go and find Dax. He\'s been at the lock table since dawn.'),
  ]),
  play(2, [
    narrator('Dax at a table of locks. Every one has a chalk cross on it but one.'),
    dax('Cellar. Sea chest. Older than the hall.'),
    dax('Last lock in Saltgate you haven\'t tried.'),
    narrator('You take the key off its cord. It goes in all the way. It does not turn.'),
    dax('(chalking a cross on the lid) That\'s all of them, then.', 'troubled'),
    dax('So it opens something that isn\'t here. Good thing you\'re leaving.'),
  ]),
  play(3, [
    mina('Plot forty-one. Greenhollow, south of Hollowmere. I looked it up before you asked.'),
    mina('One dry field, one pond, and a sealed door in the hill. Nobody\'s ever opened one of those. Anywhere.'),
    mina('And look. Last year\'s survey has the wood north of you green. This year\'s has it grey. I don\'t know why yet.', 'troubled'),
    mina('(looking round at last) Write to me if the door does anything. It will not. Write anyway.', 'glad'),
  ]),
  {
    // The rack: the one choice of grant day. The opening may offer it its own way; this is the plain one.
    id: 'choice.weapon',
    npc: SCENE,
    kind: 'staged',
    lines: [
      narrator('A sword, a bow and a staff. The guild lends a ward one, and it does not lend twice.', {
        choices: [
          { text: 'Take the sword', effects: [{ flag: FLAG.choice('weapon'), value: 'sword' }] },
          { text: 'Take the bow', effects: [{ flag: FLAG.choice('weapon'), value: 'bow' }] },
          { text: 'Take the staff', effects: [{ flag: FLAG.choice('weapon'), value: 'staff' }] },
        ],
      }),
    ],
  },
  { id: 'scene.4.before', npc: SCENE, lines: [dax('Go on. Hit me. Not the face. Hobb counts my teeth.')] },
  play(4, [
    dax('Go on. Hit me. Not the face. Hobb counts my teeth.'),
    narrator('The crate lid rings. You dodge, and dodge again, and then he is open.'),
    dax('(shaking out his arm) Fine. You\'ll do.', 'glad'),
    dax('I\'m coming up anyway. Once you\'ve got a roof.'),
  ]),
  play(5, [
    guildmaster('Ward of the guild, sixteen years. By right of the grant: plot forty-one, Greenhollow.'),
    narrator('Somebody laughs. "The one with the door!" The girl before you got a vineyard.'),
    narrator('You sign. The name you write is the name the game calls you.'),
    hobb('(quietly, behind you) Let them laugh. They\'ll all come visiting once you\'ve got a kitchen.'),
  ]),
  play(6, [
    hobb('Bread, cheese, and a note on the back of your deed. Read it when you land. Not before.'),
    dax('Don\'t open any doors till I get there.'),
    hobb('(fixing your collar, which was fine) Go on, then, Button. Make it a home.', 'troubled'),
    narrator('The ferry pushes off. Hobb does not wave. She stands on the quay until the bend.'),
  ]),
  play(7, [
    narrator('The ferryman is already poling away. Nobody is waiting on the jetty.'),
    narrator('A dry field. A pond on the rise above it. A standing stone with your plot\'s number cut in it.'),
    narrator('In the side of the hill, a round stone door wrapped in roots.'),
    narrator('On the back of your deed, in Hobb\'s writing: "Water first. Then fire. Then a roof. EAT."'),
  ]),

  // ------------------------------------------------------------------------------------ Ilara's Hall
  // The first night. src/game/hall starts each of these by its id, and acts on the flag it sets.
  {
    id: 'door.shut',
    npc: SCENE,
    scene: 8,
    lines: [
      narrator('You push the stone door. It is like pushing the hill.'),
      narrator('Scratches all round its rim: picks, levers, a century of delvers.'),
      narrator('Seven small hollows are cut in a ring at its center. One of them is chipped away.', { effects: [{ flag: 'door.seen' }] }),
    ],
  },
  {
    id: 'night.door',
    npc: SCENE,
    scene: 10,
    lines: [
      narrator('The fox is grey from nose to tail. Its eyes are dull, and it does not blink.'),
      narrator('Your back is against the stone door. You raise your weapon.'),
      narrator('It is thin. It is shaking. You lower your hand.'),
      narrator('Behind you, the stone moves.', { effects: [{ flag: 'door.open' }] }),
    ],
  },
  {
    id: 'hall.mark',
    npc: SCENE,
    scene: 11,
    lines: [
      // The lamps wake as the first line says so (world-hall.view.ts lights them one after another).
      narrator('Lamps wake along the walls, one after another, as if someone walked ahead of you.', { effects: [{ flag: 'hall.lit' }] }),
      narrator('Your hand burns. A mark rises under the skin: a ring of seven points.'),
      narrator('The burning stops. The ring stays.', { effects: [{ flag: 'mark' }] }),
    ],
  },
  {
    id: 'custodian.wake',
    npc: SCENE,
    scene: 12,
    lines: [
      narrator('A small beast of moss and brass sleeps on a plinth.'),
      narrator('There is a keyhole in its back. The key on your cord has never fitted anything. It fits this.'),
      custodian('(one eye opening) You\'re late.', 'troubled'),
      custodian('A thousand years and sixty-one days late. I counted. There was nothing else to do.'),
      custodian('Hand. Show me. (a long look) Yes. That is her mark. So it is you.'),
      custodian('I am the Custodian. I kept this hall for Ilara. It seems I keep it for you now.'),
      custodian('The fox, first. It is Blighted, not wicked. Hold out the hand.', undefined, { effects: [{ flag: 'custodian.awake' }] }),
    ],
  },
  {
    id: 'fox.calm',
    npc: SCENE,
    scene: 13,
    lines: [
      narrator('You hold out your marked hand. The fox stops shaking.'),
      narrator('The grey runs out of its fur like water. Under it, red fur and a leaf for a tail.'),
      narrator('It looks at you. Then it turns round twice in the doorway and lies down, facing out.', { effects: [{ flag: 'fox.calmed' }] }),
    ],
  },
  {
    id: 'heart.first',
    npc: SCENE,
    scene: 14,
    lines: [
      custodian('That is the Heartstone. It runs on what lives up there, on your land.'),
      custodian('Every roof, every field, every beast that trusts you. It all comes down here.'),
      custodian('(squinting at it) So far: one wet field and one fox. I have seen brighter puddles.', 'troubled'),
      narrator('It noses a book off the plinth. The page is blank. Then a fox draws itself there, in teal line.'),
      // Ilara's field book is the Almanac. It is the Custodian's to give, not Tamsin's.
      custodian('Her field book. It writes down whatever you take the trouble to watch.', undefined, { effects: [{ flag: 'has.almanac' }] }),
      custodian('Fill the stone and that arch wakes. Now sleep. You look the way the fox did.', undefined, { effects: [{ flag: 'heart.seen' }] }),
    ],
  },
  {
    id: 'hall.mural',
    npc: SCENE,
    lines: [
      narrator('A king, carved taller than the rest. Beside him stand seven figures.'),
      narrator('Six are whole. The seventh has been scraped back to bare stone. A fox sits at its feet.', { effects: [{ flag: 'mural.seen' }] }),
    ],
  },
  {
    // The same look once the Custodian is awake to be asked.
    id: 'hall.mural.asked',
    npc: SCENE,
    lines: [
      narrator('A king, carved taller than the rest. Beside him stand seven figures.'),
      narrator('Six are whole. The seventh has been scraped back to bare stone. A fox sits at its feet.'),
      custodian('Do not ask me yet. I lost most of it. I only know that I am angry.', 'troubled', { effects: [{ flag: 'mural.seen' }] }),
    ],
  },
  { id: 'hall.gate', npc: SCENE, lines: [narrator('A stone arch, three paces wide. It leads nowhere.')] },
  {
    id: 'hall.gate.asked',
    npc: SCENE,
    lines: [
      narrator('A stone arch, three paces wide. It leads nowhere.'),
      custodian('A Gate. It is dead. Fill the stone and it wakes. Then it goes somewhere.'),
    ],
  },
  {
    // The morning after. Half of Hollowmere is at your fence.
    id: 'scene.15',
    npc: 'tamsin',
    scene: 15,
    when: step('night', 'tamsin'),
    lines: [
      narrator('A man in a white coat is already running back down the road, holding his hat on.'),
      narrator('A lean old woman in a grey coat comes through the crowd. People step aside without looking.'),
      tamsin('(looking at your hand) So it opened. I\'ve walked past that door for years.'),
      tamsin('Tamsin. The guild\'s warden here. I signed your grant. I should have met your boat.'),
      narrator('She takes a glove from her belt and puts it in your marked hand.'),
      tamsin('Wear it. In town, and above all near the priests of the Dawn.', 'troubled'),
      tamsin('(watching the white coat go) Not that it\'ll help. He\'ll be at his bell by now.'),
      tamsin('Why? Later.', undefined, { effects: [{ flag: 'night.told' }, { flag: 'glove' }, { befriend: 'tamsin' }] }),
    ],
  },

  // ======================================================================================== chapter 2: the herald
  play(16, [
    aldric('(out of breath) Is it true? No. Do not show me. She is coming herself.', 'troubled'),
    narrator('People kneel along the path. A small old woman walks up it, telling them to get up.'),
    elowen('Up, up. The grass is wet. You will all catch cold, and then who nurses you? I do.', 'glad'),
    elowen('(to you) May I see it? You may say no. People forget they may say no to me.'),
    narrator('You take off the glove. She looks at the Mark for a long time. Her eyes are wet.'),
    elowen('Forgive me. We have waited a very long time for that hand. All of us.', 'troubled'),
    narrator('Two novices set down a crate. Inside is a brass pump, polished until it shines.'),
    elowen('Set it in your field. Three crops where you now get one, and nothing to wind or mend.'),
    elowen('And this is Calla. She is cleverer than she is gentle. Forgive her that.', 'glad'),
    calla('(not looking at Tamsin) I know these hills, Mother. I was taught well. For a while.'),
    elowen('A god sleeps under the old terraces. Wake it when you are ready, and not before.'),
    elowen('Then this valley will be well again. And then we shall talk, you and I.', 'glad'),
  ]),
  {
    // The step after the blessing: the pump, in its crate at the edge of your field.
    id: 'choice.pump',
    npc: SCENE,
    lines: [
      narrator('The crate sits at the edge of your field. The pump shines in its straw.', {
        choices: [
          {
            text: 'Set it running in your field',
            effects: [{ flag: FLAG.choice('pump'), value: 'running' }],
            then: [narrator('It drinks from your ditch and starts to hum. The rows round it darken.')],
          },
          {
            text: 'Leave it in its crate',
            effects: [{ flag: FLAG.choice('pump'), value: 'crated' }],
            then: [narrator('You put the lid back on. The straw smells of incense.')],
          },
        ],
      }),
    ],
  },
  play(17, [
    custodian('She was here. The old woman. I could smell her through the stone.'),
    custodian('She smells like the old days. I do not know why that makes me want to bite.', 'troubled'),
    custodian('That thing in your field hums. Nothing honest hums. Look at the stone.', 'troubled', { when: PUMP_ON }),
    narrator('The Heartstone is a shade dimmer than it was this morning.', { when: PUMP_ON }),
    custodian('You left her gift in its crate. Good. I cannot tell you why. Good.', undefined, { when: no(PUMP_ON) }),
    custodian('I am coming with you. In the pack. I have sat on that plinth long enough.', undefined, { effects: [{ flag: 'custodian.pack' }] }),
  ]),
  play(18, [
    hobb('There you are, Button. Thin as a rake. I knew it. I said so to Dax.', 'glad'),
    dax('(setting the crate down) She did. Every mile of the river.'),
    hobb('A miracle, they tell me. Miracles still eat breakfast. Where is your kitchen?'),
    narrator('She looks at your tent, your fire and your one pot.'),
    hobb('No kitchen. (rolling up her sleeves) Dax. The big pot.', 'troubled'),
    dax('I\'ll sleep by the gate. Somebody should.'),
  ]),
  // A room chosen on the settler's card, once the hero has walked them to it (src/game/settlement). The story
  // director plays `took.<who>.<job>` when the settlement sets `job.<who>`.
  took('hobb', 'kitchen', hobb('A meal a day for everyone on this hill. That\'s what a kitchen\'s for.', 'glad')),
  took('hobb', 'smokehouse', hobb('Meals that keep for the road. So you\'re planning on going somewhere.')),
  took('dax', 'watch', dax('Gate. Fence. Road. Fine.')),
  took('dax', 'yard', dax('Carry things from there to there. Fine.')),
  play(19, [
    narrator('Grey runs out of its quills. It blinks, sneezes, and starts scratching itself on your fence post.'),
    dax('Huh. (a pause) It\'s staying, isn\'t it.'),
    dax('Does that work on Hobb?', 'glad'),
  ]),
  {
    id: 'scene.19.before',
    npc: SCENE,
    lines: [
      narrator('Something is rooting up your seedlings. It is the size of a barrel, and grey all over.'),
      dax('(the crate\'s lid up, like a shield) I will hold it. You do the hand.'),
    ],
  },
  play(20, [
    narrator('The forest\'s edge. Half the trees are grey. A woman with a bow sits on a stump, facing them.'),
    wren('(softly, to the trees) Easy. It\'s only me. Same as yesterday.'),
    wren('(to you, not turning) Stay behind me. He hasn\'t eaten in two winters. He doesn\'t know me now.', 'troubled'),
    narrator('A boar as big as a cart stands in the grey trees. Gold shows in the cracks of its hide.'),
    wren('His name is Bramble. I raised him on a bottle.'),
    wren('I\'m Wren. The queen\'s forester. For what that\'s worth out here.'),
    narrator('Three grey foxes come out of the wood, low and quick. Wren already has an arrow on the string.'),
  ]),
  {
    id: 'scene.21.before',
    npc: SCENE,
    lines: [
      narrator('The three foxes are red again. Wren watches the last of the grey run out of them.'),
      wren('So that\'s what the bells are about. (nodding at the boar) Do that to him.'),
    ],
  },
  play(21, [
    narrator('You hold out your hand to the boar. Nothing happens. He does not even look round.'),
    custodian('(from the pack) No. Not that one. Not yet.', 'troubled'),
    custodian('His Blight is five deep. Your stone is at two. Go home and build.'),
    wren('Then I\'ll wait. I\'m good at it.'),
    narrator('Your fox drops a seed at your feet, and sits down on your boot.'),
    custodian('That is a pact. It paid first. They always do. See that you pay back.'),
  ]),
  {
    id: 'choice.burrowers',
    npc: SCENE,
    lines: [
      narrator('Copper glints in the loose earth where the burrower went down.', {
        choices: [
          {
            text: 'Let them feed. They come back tomorrow',
            effects: [{ flag: FLAG.choice('burrowers'), value: 'give' }],
          },
          {
            text: 'Dig the burrow out for its copper',
            effects: [{ flag: FLAG.choice('burrowers'), value: 'take' }, { flag: 'burrow.dug' }],
            then: [narrator('The copper comes up all at once. The ground round the hole goes pale.')],
          },
        ],
      }),
    ],
  },
  {
    // Queen Maren, asleep on a sack in the granary. Talk to her.
    id: 'scene.22',
    npc: 'maren',
    scene: 22,
    when: step('count', 'queen'),
    lines: [
      maren('(waking, not getting up) Forty sacks. I counted twice. Counting a third time won\'t help.', 'troubled'),
      maren('The Mother\'s pumps gave us three crops a year. Then two. This year one, and a grey wood.'),
      maren('You\'re the one from the hill. They say your field\'s green, and there\'s no pump in it.'),
      maren('Show me a field that feeds people without one. Then I\'ll know what to say to the priests.'),
      narrator('She pushes a sack of seed across the floor to you with her foot.', { effects: [{ give: 'wheat_seeds', count: 12 }, { give: 'hoe' }, { give: 'watering_can' }] }),
    ],
  },
  play(23, [
    aldric('(on a cart, arms raised) For the Ascended, who lit the way! Let it be lit again!', 'glad'),
    narrator('Gold runs along the tops of the arches, one after another, toward your hill. It stops just short of it.'),
    narrator('Far to the north the Dawn pulses, once. The whole town turns to face it and bows.'),
    narrator('One person does not turn. Tamsin is counting arches.'),
    tamsin('Four stretches. There were three when I came to this valley.', 'troubled'),
  ]),

  // ======================================================================================== chapter 3: what the ruins say
  play(24, [
    narrator('A stone no bigger than a plum. Under your marked hand it grows warm.'),
    narrator('This same ground, green. A boy is planting. A girl sits on the wall with a fox.'),
    girl('The fox says you\'re doing it wrong.'),
    boy('It\'s a fox. It doesn\'t say anything.'),
    girl('It says a great deal. Mostly about you.'),
    boy('(laughing) Then tell it I\'ll be king one day. It can say that to my face.'),
    narrator('The stone goes dark. In your pack, the Custodian has gone very still.'),
    custodian('I remember the fox.', 'troubled'),
  ]),
  {
    // The Custodian marks the three vaults, as the step after the first Echo.
    id: 'talk.vaults',
    npc: SCENE,
    lines: [
      custodian('There are more stones like that one. Three. I can feel them from here.'),
      narrator('It climbs out of the pack and scratches three marks on your map with one claw.'),
      custodian('South-east, where the wheel turns. North-east, under the hill. West, under the roots.'),
      custodian('Any order. I did not say they would be pleasant.', undefined, { effects: [{ flag: 'vaults.marked' }] }),
    ],
  },
  {
    id: 'scene.25',
    npc: SCENE,
    scene: 25,
    lines: [
      calla('You went in alone. You are not to go in alone. It is in my instructions.'),
      narrator('She presses a gold seal across the door. It sets like wax.'),
      calla('For your safety. These places fall in. What did you find?', undefined, {
        choices: [
          {
            text: 'Show her the Echo stone',
            effects: [{ flag: FLAG.choice('calla'), value: 'shown' }],
            then: [
              calla('A dead stone. They carry sickness. It is in my instructions.'),
              narrator('She sets it on the step and presses her seal to it. It goes to white ash. She does not look pleased.'),
              calla('(writing) "One stone, destroyed." Thank you. That was the right thing to do.'),
            ],
          },
          {
            text: 'Say nothing',
            effects: [{ flag: FLAG.choice('calla'), value: 'kept' }],
            then: [calla('(writing) "Found nothing." (a look at your pack) Very well. Nothing.')],
          },
        ],
      }),
    ],
  },
  play(26, [
    narrator('Water, sun, a wheel turning. A young man carries two pails up the steps for an old woman.'),
    oldWoman('You\'ll be a lord one day, Auren. Lords don\'t carry pails.'),
    auren('Then I will be a poor sort of lord, and your garden will be wet.', 'glad'),
  ]),
  {
    id: 'choice.gearlings',
    npc: SCENE,
    lines: [
      narrator('A gearling stands stopped in your pit, ticking.', {
        choices: [
          {
            text: 'Push it on. It comes back tomorrow',
            effects: [{ flag: FLAG.choice('gearlings'), value: 'give' }],
          },
          {
            text: 'Break it for its four springs',
            effects: [{ flag: FLAG.choice('gearlings'), value: 'take' }],
            then: [narrator('The springs come out in your hand. In your pack, the Custodian turns round and will not look at you.')],
          },
        ],
      }),
    ],
  },
  play(27, [
    maren('Seventy sheaves. On this ground. The best pumped field in my valley gave fifty-two.'),
    maren('How? Do not say a miracle. I have had enough miracles this month.', 'troubled'),
    narrator('You show her the wheel, the shaft and the sprinklers. She writes it all down.'),
    gus('Soil is wet, and it rests. That is all it is. Nobody listens to soil.'),
    aldric('Majesty, the pumps are the Mother\'s own gift. One cannot simply... a gift is not...', 'troubled'),
    maren('Her gift gave me three thin harvests and a grey wood. Start pulling them out.'),
    narrator('By evening the hum is gone from two of Hollowmere\'s fields. Calla writes one line in her ledger.'),
  ]),
  {
    // The end of scene 27: the last section of the queen's ledger fills, and the road above the town goes dark.
    id: 'scene.27.dark',
    npc: SCENE,
    kind: 'film',
    lines: [
      narrator('The last pump comes out of Hollowmere\'s fields. That night the gold goes out of the newest arches.'),
      narrator('On the bridge, Tamsin counts them again.'),
      tamsin('Three.', undefined, { effects: [{ flag: 'road.dark' }] }),
    ],
  },
  play(28, [
    narrator('A long table, lamps, a feast. Eight chairs. Seven are full and loud.'),
    narrator('Auren stands at the head with a cup. He looks at each of them in turn.'),
    auren('Six realms, and not one sword drawn all year. I didn\'t do that. You did.', 'glad'),
    narrator('The eighth chair is the one you are seeing this from.'),
  ]),
  play(29, [
    narrator('A young woman stands with her hand on the nose of a stag the size of a house.'),
    ilara('He wants to meet you. I said you are frightened of big things.', 'glad'),
    auren('I\'m not frightened. I\'m being respectful. From over here.', 'troubled'),
    narrator('The Stag lowers its head to him. He laughs, and puts his hand on it.'),
  ]),
  {
    id: 'choice.gus',
    npc: 'gus',
    when: step('itself', 'gus'),
    lines: [
      gus('Your arms cut the terrace. My field\'s next to it. Your machine or my hands.', undefined, {
        choices: [
          {
            text: 'Give his field an arm',
            effects: [{ flag: FLAG.choice('gus'), value: 'arm' }],
            then: [gus('Machine, then. I\'ll find something else to do.', 'troubled')],
          },
          {
            text: 'Leave it to Gus',
            effects: [{ flag: FLAG.choice('gus'), value: 'gus' }],
            then: [gus('My rows. Good. One in four rests.')],
          },
        ],
      }),
    ],
  },
  took('mina', 'maproom', mina('One small ruin a day. I\'ll have it marked before you\'ve had breakfast.', 'glad')),
  took('mina', 'survey', mina('Your farms, then. Every rate. I\'ll know your terrace better than you do.')),
  play(30, [
    mina('The door opened and you didn\'t write. I had to hear it from a ferryman. A ferryman!', 'troubled'),
    mina('Sixty years of delvers\' notes on this valley. Every ruin they couldn\'t open.'),
    mina('(looking at your hand) Couldn\'t. I\'m going to need a bigger table.', 'glad'),
    narrator('That evening, three windows are lit. Under the hill, something answers.'),
    custodian('There. Do you feel it? Look at the arch.'),
    narrator('A thread of teal runs round the dead Gate, and holds.'),
    custodian('One Gate. As far as the town and no further. Do not be smug. There are seven.'),
  ]),
  {
    id: 'scene.31.before',
    npc: SCENE,
    lines: [
      wren('He\'s still here. So am I. Don\'t tell me the number.'),
      custodian('Five. It is five now. Break his guard. Then be kind to him.'),
    ],
  },
  play(31, [
    narrator('The gold goes out of the cracks in his hide. The grey runs off him like rain off a roof.'),
    narrator('He looks at Wren for a long time. Then he puts his whole head in her arms.'),
    wren('(into his neck) You great fool. Two winters. You great fool.', 'glad'),
    wren('(not looking up) We\'re coming to live on your hill. He\'ll want a yard. Near water.'),
  ]),

  // ======================================================================================== chapter 4: the Rootworks
  play(32, [
    calla('I will come down with you. It is in my instructions.'),
    narrator('The door opens for your hand. When she steps after you, it closes in her face.'),
    calla('(through the stone, very calm) That is not in my instructions.', 'troubled'),
    custodian('(from the pack) Ha.', 'glad'),
  ]),
  {
    id: 'scene.33.before',
    npc: SCENE,
    lines: [custodian('It will not know you. Chains do that. Break the pins. Hurt it no more than you must.')],
  },
  play(33, [
    narrator('The collar drops. The Stag stands very still. Then, slowly, it lowers its head to you.'),
    stag('Small. Marked.'),
    stag('Ilara?'),
    narrator('It breathes in the smell of your hand.'),
    stag('No. Her hand. Not her.', 'troubled'),
    stag('Chained. Standing. A thousand years.'),
    narrator('Its legs fold. It lies down, slowly, and the roots in the floor bend to make room.'),
    stag('I go with you, small one. With you. Not for you.'),
    narrator('One point of your Mark fills with green light.'),
    custodian('(quietly) Hello, old friend. You have moss on you.', 'glad'),
  ]),

  // ======================================================================================== chapter 5: the pilgrimage
  play(34, [
    narrator('In the morning the grey wood is green to the last leaf, and loud with birds.'),
    narrator('North, on the Dawn, one band of the gold has gone thin. You can see towers through it.'),
    narrator('In Hollowmere every bell is ringing. On the road, people stand and point north.'),
    maren('(at your gate, a charter in her hand) I had a speech. I\'ve lost it.', 'glad'),
    maren('The valley round your door is yours. All of it, to the forest. Hold it better than we did.'),
  ]),
  play(35, [
    narrator('Warm light, like a kitchen seen from outside at night. Someone stands in it with his back to you.'),
    aVoice('There you are. I have waited a long time to say thank you.'),
    aVoice('Rest now. There are five more to wake.'),
    narrator('You wake. The Custodian is sitting on your chest, staring at you.'),
    custodian('You were smiling. Stop it.', 'troubled'),
  ]),
  play(36, [
    elowen('You woke him gently. I heard. I am so glad it was gently.', 'glad'),
    elowen('Five more sleep. The Lion is next, in the desert, west along the High Road.'),
    elowen('This writ opens every chapel door from here to the sea. Eat well. Sleep indoors.'),
    elowen('And this is Ren, who asked to carry your water.'),
    ren('(bowing too low) I can carry forty days of it. I have counted.'),
    elowen('(to the town) Bless this child\'s road!', 'glad'),
    narrator('Everyone does. It is very loud.'),
  ]),
  play(37, [
    narrator('On the terraces, the Stag watches the white figure go down the road.'),
    stag('She was kinder, before.', 'troubled'),
    narrator('It will not say more.'),
  ]),
  play(38, [
    tamsin('I\'ll mind the plot. Hobb will mind me.'),
    tamsin('Out there they will tell you what the ruins mean. Look at the ruins yourself.'),
    hobb('Bread for six days. Cheese for four. Eat the cheese first, Button.'),
    hobb('And write. Not to Mina. To me.', 'troubled'),
    dax('Gate\'ll be here when you get back. So will I.'),
    wren('Bramble will keep the wood. (to your fox) You keep that one.'),
    custodian('(from the pack) West, then. I have not been west in a thousand years. Walk smoothly.'),
  ]),

  // ======================================================================================== Echoes, a second time
  // A stone you have already seen gives one more line from the same moment (chapter 22, "Ilara and Auren"). The
  // ruins system starts these by id when a spent stone is touched again.
  { id: 'memory.hall.again', npc: SCENE, kind: 'film', lines: [girl('Don\'t let him near the bees. He talks to them. They hate it.'), boy('One day there\'ll be water on every field in this valley. Uphill too.')] },
  { id: 'memory.pumphouse.again', npc: SCENE, kind: 'film', lines: [auren('Sit down, Nan. I\'ll fetch the other two.', 'glad')] },
  { id: 'memory.lampgallery.again', npc: SCENE, kind: 'film', lines: [auren('Somebody fill the smith\'s cup before he makes a speech.', 'glad')] },
  { id: 'memory.seedvault.again', npc: SCENE, kind: 'film', lines: [ilara('Put your hand flat. Flat. He isn\'t a dog.', 'glad')] },

  // ======================================================================================== walk-up lines
  // What each person says when you walk up to them outside a scene: an unmet need, then a wish just granted, then
  // a moment, then the chapter. Each person ends with a fallback that has no condition.

  // ------------------------------------------------------------------------------------ Hobb
  ...needs('hobb',
    'I\'m sleeping on a sack of flour, Button. It isn\'t even good flour.',
    'Nothing in the pot tonight. First time in thirty years. I don\'t like it.',
    'Can\'t tell the salt from the sugar after dark. Somebody\'s getting a sweet stew.'),
  wish('hobb', 'Look at that. The river. Now I can watch the ferry and burn the onions.'),
  walkUp('hobb', 'burrow', flag('burrow.dug'), 'You dug them out, didn\'t you. The ground\'s gone pale. Hope the copper was worth it.', { once: true }),
  walkUp('hobb', 'breakfast', both(chapter(1), no(flag(FLAG.step('grantday', 'breakfast')))), 'Breakfast first. That deed\'s not going anywhere. Nobody else wants it.'),
  walkUp('hobb', 'hall', chapter(1), 'Full? Good. Dax is at the lock table, and the deed waits in the yard.'),
  walkUp('hobb', 'chapter2', chapter(2), 'Three mouths, one pot. I\'ve fed forty wards on less. Don\'t make me prove it.'),
  walkUp('hobb', 'chapter3', chapter(3), 'Everyone on this hill ate today. Count them if you like. I did.'),
  walkUp('hobb', 'chapter4', chapter(4), 'Packed you a hot one, wrapped twice. Eat it before you go down. Not after.'),
  walkUp('hobb', 'fallback', undefined, 'The Mother sent pastries. I\'m not saying they\'re bad. I\'m saying I\'ve had them.'),

  // ------------------------------------------------------------------------------------ Dax
  ...needs('dax', 'Ground\'s hard. Not complaining. Saying.', 'Hobb\'s not cooking. Something\'s wrong.', 'Can\'t see the road. Can\'t watch what I can\'t see.'),
  wish('dax', 'Good post. I can see both. Thanks.'),
  walkUp('dax', 'hall', chapter(1), 'Rack\'s in the yard. I\'ll be the crate lid.'),
  walkUp('dax', 'chapter2', chapter(2), 'Fence held. Nothing came. Checked twice.'),
  walkUp('dax', 'chapter3', chapter(3), 'Lamps are up. I slept. First time.'),
  walkUp('dax', 'chapter4', chapter(4), 'Want me down there? No? I\'ll be at the gate.'),
  walkUp('dax', 'fallback', undefined, 'Gate\'s mine. Go.'),

  // ------------------------------------------------------------------------------------ Mina
  ...needs('mina',
    'I slept on the map case. I\'ve got the coast of Greenhollow printed on my face.',
    'I forgot to eat. No, wait. There was nothing to forget. That\'s different.',
    'I can\'t draw in the dark. I tried. It\'s a very bad map.'),
  wish('mina', 'North light, no shadow on the paper. And the table fits the whole valley. Twice.'),
  walkUp('mina', 'hall', chapter(1), 'Forty-one, forty-one... I\'ve got the old survey somewhere. Don\'t touch the ladder.'),
  walkUp('mina', 'arrived', both(chapter(3), no(flag('mina.settled'))), 'That ruin by the mill isn\'t on any of the guild\'s maps. It\'s on mine now.', { once: true }),
  walkUp('mina', 'maproom', both(chapter(3), chose('mina', 'maproom')), 'Today\'s is a sunk tower. One room. Probably. I\'ll know when you\'ve been.'),
  walkUp('mina', 'chapter3', chapter(3), 'Every farm you\'ve got, at its best rate. Your terrace is showing off.'),
  walkUp('mina', 'chapter4', chapter(4), 'Tell me everything about the Rootworks. Count the stairs. All of them.'),
  walkUp('mina', 'fallback', undefined, 'West? Nobody\'s mapped the desert properly. Bring me back everything.'),

  // ------------------------------------------------------------------------------------ Gus
  ...needs('gus', 'Slept in the barn. Barn\'s fine. Barn\'s got a draught.', 'No supper. A man can farm hungry. Not well.', 'Dark comes early here. Can\'t see my rows.'),
  wish('gus', 'Row\'s resting. Good. Come back in two weeks. You\'ll see.'),
  walkUp('gus', 'arm', chose('gus', 'arm'), 'Machine\'s doing my rows. Off to town. Somebody there must want a farmer.'),
  walkUp('gus', 'grey', chapter(2), 'Field\'s grey. Pump\'s still humming in it. Soil\'s not dead. Soil\'s tired.'),
  walkUp('gus', 'chapter3', either(chapter(3), chapter(4)), 'Wet it. Rest it. One row in four. Same as my father did.'),
  walkUp('gus', 'fallback', undefined, 'Forest\'s green. Smell that? That\'s soil waking up.'),

  // ------------------------------------------------------------------------------------ Wren
  ...needs('wren',
    'I slept in the yard with him. He snores. It\'s fine. It isn\'t fine.',
    'Bramble ate. I didn\'t. Get the order right next time.',
    'No lamp by the yard. He wanders at night, and so do I, after him.'),
  wish('wren', 'Water right there. He\'s been in it since noon. Look at him.'),
  walkUp('wren', 'edge', chapter(2), '(to the boar first) Quiet today. (to you) Quiet\'s good. Means tired, not hungry.'),
  walkUp('wren', 'waiting', both(chapter(3), no(flag(FLAG.fightWon(11)))), 'Don\'t tell me. I\'ll know when you\'re ready. So will he.'),
  walkUp('wren', 'chapter3', both(chapter(3), flag(FLAG.fightWon(11))), 'He ploughed half your east strip and fell asleep in it. That\'s a compliment.'),
  walkUp('wren', 'chapter4', chapter(4), 'A chained beast fights the chain, not you. Stay out of the way of the chain.'),
  walkUp('wren', 'fallback', undefined, 'The wood\'s loud again. I\'d forgotten how loud.'),

  // ------------------------------------------------------------------------------------ Tansy
  ...needs('tansy', 'I slept with the hive. They don\'t mind. I do.', 'Honey\'s not supper. People think it is. It isn\'t.', 'The bees go to bed at dusk. I don\'t. Light, please.'),
  wish('tansy', 'The far row\'s all flowers. Thirty-one, and two I can\'t name.'),
  walkUp('tansy', 'took', TAKING, 'You took. The bees knew before I did. I\'ll say it once.', { once: true }),
  walkUp('tansy', 'arrived', both(flag(FLAG.settler('tansy')), chapter(3)), 'Twenty flowers and nobody taking. You know how rare that is?', { once: true }),
  walkUp('tansy', 'chapter3', either(chapter(3), chapter(4)), 'Eleven, twelve, thirteen clover by the ditch. Up from nine. Don\'t mow it.'),
  walkUp('tansy', 'fallback', undefined, 'My hive by the wood is full. The wood\'s well. When it thins, you\'ll hear it from me first.'),

  // ------------------------------------------------------------------------------------ Holt
  ...needs('holt', 'I can sleep under a lamp post. I have. I\'d rather not.', 'A lamplighter eats at dusk, before the round. There was nothing at dusk.', 'A lamplighter with no lamp on his own door. People will talk.'),
  wish('holt', 'A lamp at the landing. Now the late ferry has something to steer by.'),
  walkUp('holt', 'arrived', flag(FLAG.settler('holt')), 'A lamp is a promise. Somebody walks toward it.', { once: true }),
  {
    // Chapter 3: one line, and if you ask about the road, one more that says nothing.
    id: 'holt.chapter3',
    npc: 'holt',
    when: either(chapter(3), chapter(4)),
    lines: [
      {
        text: 'That one by the bait field. Leave it dark. Some things need the dark.',
        choices: [
          { text: 'Ask about the lamps on the High Road', then: ['(looking at the arches) No. Ask me about any other lamp.'] },
          { text: 'Leave him to his round' },
        ],
      },
    ],
  },
  walkUp('holt', 'fallback', undefined, 'Every lamp on your hill lit at dusk. None of them on that road.'),

  // ------------------------------------------------------------------------------------ the Custodian
  // On its plinth on the first night, and in your pack from the end of scene 17.
  walkUp('custodian', 'fox', both(step('night', 'calm'), no(flag('fox.calmed'))), 'The fox, first. Hold out the hand. It remembers that mark.'),
  walkUp('custodian', 'heart', both(flag('custodian.awake'), no(flag('heart.seen'))), 'Now the stone. Go and touch it. It does not bite. I checked.'),
  walkUp('custodian', 'sleep', step('night', 'sleep'), 'Sleep. Up there, under your roof. I have slept enough for both of us.'),
  { id: 'custodian.gearling', npc: 'custodian', when: chose('gearlings', 'take'), once: true, lines: [narrator('It turns round in the pack and will not look at you. It says nothing all day.')] },
  walkUp('custodian', 'pump', PUMP_ON, 'It still hums. I can hear it from in here.'),
  walkUp('custodian', 'hall', chapter(1), 'The stone does not get brighter while you stand and look at it.'),
  walkUp('custodian', 'chapter2', chapter(2), 'Brighter or dimmer. Those are the only two words I need from your day.'),
  walkUp('custodian', 'chapter3', chapter(3), 'Three vaults. I marked them. I did not say they would be pleasant.'),
  walkUp('custodian', 'chapter4', chapter(4), 'There is an old friend down there. I have not decided what to say.'),
  walkUp('custodian', 'fallback', undefined, 'West. I am told there is sand. I do not care for sand.'),

  // ------------------------------------------------------------------------------------ Tamsin
  {
    // Never stuck: a lost tool is replaced by the guild's warden.
    id: 'tamsin.axe',
    npc: 'tamsin',
    when: both({ quest: 'grantday', state: 'done' }, no({ bag: 'axe' }), no(flag('owed.axe'))),
    lines: [tamsin('No axe. I won\'t ask. (taking a spare off her belt) The guild sends its wardens spares.', undefined, { effects: [{ give: 'axe' }] })],
  },
  walkUp('tamsin', 'glove', both(chapter(1), flag('night.told')), 'Glove on. Good.'),
  walkUp('tamsin', 'counted', both(chapter(2), scene(23)), 'Four. I\'ll count again tomorrow.'),
  walkUp('tamsin', 'chapter2', chapter(2), 'The Mother\'s kind. She\'s always been kind. Keep the glove on anyway.'),
  walkUp('tamsin', 'chapter3', either(chapter(3), chapter(4)), 'Another door sealed. That girl was always quick with wax.'),
  walkUp('tamsin', 'before', chapter(1), 'Mind the wet planks. The jetty\'s older than the town.'),
  walkUp('tamsin', 'fallback', undefined, 'Write to Hobb. She worries out loud. I don\'t.'),

  // ------------------------------------------------------------------------------------ Queen Maren
  walkUp('maren', 'chapter2', chapter(2), 'They crowned me at sixteen because I could add. Nobody said the adding never stops.'),
  walkUp('maren', 'pumps', both(chapter(3), LEDGER_FULL), 'The priests are very polite to me now. Very. I\'m counting that too.'),
  walkUp('maren', 'ledger', both(either(chapter(3), chapter(4)), LEDGER_BEGUN), 'Two pumps out. Granary\'s at forty-six. I\'m writing it in ink.'),
  walkUp('maren', 'chapter3', either(chapter(1), chapter(3), chapter(4)), '(not opening her eyes) If it\'s about the sacks, there are forty. Come back later.'),
  walkUp('maren', 'fallback', undefined, 'You have a valley. I have a winter\'s bread. Fair trade. Sit down, I\'m tired.'),

  // ------------------------------------------------------------------------------------ Brother Aldric
  walkUp('aldric', 'road', both(chapter(2), step('count', 'relit')), 'Tonight, on the road! You will come? Do come. Bring a... bring a cloak.'),
  walkUp('aldric', 'chapter2', chapter(2), 'Bless you. Is that... may I... no. No. Bless you.'),
  walkUp('aldric', 'chapter3', either(chapter(3), chapter(4)), 'The pumps were a gift. One does not... a gift is not... Good day.'),
  walkUp('aldric', 'fallback', undefined, 'Every bell! I rang every bell. My arms are a gift to the Ascended now.'),

  // ------------------------------------------------------------------------------------ the Green Mother
  // She is in the valley only on the two days she blesses you. Each day she says one of hers.
  { id: 'elowen.chapter2', npc: 'elowen', when: either(chapter(1), chapter(2), chapter(3), chapter(4)), pool: true, lines: ['Have you eaten? You have the look of someone who forgets.', 'Calla bites, a little. Somebody left her young. Be patient with her.'] },
  { id: 'elowen.fallback', npc: 'elowen', pool: true, lines: ['Look at you. A season ago you had a tent.', 'It is a long road. Write to your cook. Cooks worry.'] },

  // ------------------------------------------------------------------------------------ Calla
  walkUp('calla', 'chapter2', either(chapter(1), chapter(2)), 'I will be near. You will not notice me. That is also in my instructions.'),
  walkUp('calla', 'nothing', both(chapter(3), chose('calla', 'kept')), 'I wrote "found nothing". I have read it several times since.'),
  walkUp('calla', 'chapter3', chapter(3), 'That door is sealed for your safety. Please do not pick at the seal.'),
  walkUp('calla', 'chapter4', chapter(4), 'The gate did not open for me. I have written that down. It does not need a reason.'),
  walkUp('calla', 'fallback', undefined, 'I am to report to the Mother. I have a great deal to report.'),

  // ------------------------------------------------------------------------------------ Ren
  { id: 'ren.fallback', npc: 'ren', pool: true, lines: ['Forty days of water. Thirty-nine if you drink like the Stag.', 'Where I\'m from, a cup of water is a day\'s pay. Here you leave it lying in ditches.', 'The Mother chose me. I want you to know I asked first.'] },

  // ------------------------------------------------------------------------------------ the Verdant Stag
  walkUp('stag', 'chapter4', chapter(4), 'Small one. Again.'),
  { id: 'stag.fallback', npc: 'stag', pool: true, lines: ['The wood. Loud now. Good.', 'West. The Lion. Old. Angry.'] },

  // Grant day's own: Hobb's porridge and the bout with Dax (content/opening.ts). The scenes are above.
  ...OPENING_TALKS,
];

// ------------------------------------------------------------------------------------------ the town

export interface VillagerLine {
  id: string;
  text: string;
  /** A line with a condition is said only while it holds, and then ahead of the everyday ones. */
  when?: Condition;
}

/**
 * The pool for the people of Hollowmere with no conversations of their own. Each has one line a day, picked by
 * their id. A line for the moment comes first while it holds: the pumps, the lit road, the green wood.
 */
export const VILLAGER_LINES: readonly VillagerLine[] = [
  { id: 'villager.1', text: 'Teal roofs. My grandmother picked the color. Nobody\'s had the nerve to change it.' },
  { id: 'villager.2', text: 'The well\'s sweet this year. Don\'t tell the next town.' },
  { id: 'villager.3', text: 'You\'re on the old grant? The one with the door? Rather you than me.' },
  { id: 'villager.4', text: 'The queen was asleep in the granary again. We go round. Quietly.' },
  { id: 'villager.5', text: 'There\'s a ring of grey grass round every pump. Nobody mows it. Nothing to mow.' },
  { id: 'villager.6', text: 'Brother Aldric rings that bell like it owes him money.' },
  { id: 'villager.7', text: 'Tamsin filled a hole by my door. Now I\'ve a pear tree. Didn\'t ask.' },
  { id: 'villager.8', text: 'Three crops a year, my mother had. Then two. Don\'t ask me about this year.' },
  { id: 'villager.9', text: 'They say your hand glows. Don\'t show me. I\'d only tell people.', when: both(flag('night.told'), no(scene(16))) },
  { id: 'villager.10', text: 'Did you see it last night? Gold all the way to the bend. I cried, a bit.', when: both(scene(23), no(flag('road.dark'))) },
  { id: 'villager.11', text: 'We pulled our pump. Field\'s wet, and it rests. Gus was right, the old goat.', when: LEDGER_BEGUN },
  { id: 'villager.12', text: 'The wood\'s green. All of it. My boy\'s been up there since dawn, shouting at birds.', when: scene(34) },
];
