import { expect, test } from 'bun:test';
import type { GameEvents } from '../api.sim.ts';
import { CONVERSATIONS, VILLAGER_LINES, type Conversation, type Line } from '../content/dialogue.ts';
import { QUESTS, type Condition } from '../content/quests.ts';
import { holds } from '../quests/rules.sim.ts';
import { GROUND, stage, type Stage } from '../story/fakes.ts';
import { createTalk } from './index.sim.ts';

const NAMED = ['tamsin', 'maren', 'odo', 'gus', 'mira', 'wren', 'juniper', 'brack'];
const MAX_WORDS = 18;

const words = (text: string): number => text.trim().split(/\s+/).length;

/** Every string a player can read in a list of lines: the lines, the choices and what follows them. */
function texts(lines: readonly (string | Line)[], out: string[] = []): string[] {
  for (const line of lines) {
    if (typeof line === 'string') {
      out.push(line);
      continue;
    }
    out.push(line.text);
    for (const choice of line.choices ?? []) {
      out.push(choice.text);
      texts(choice.then ?? [], out);
    }
  }
  return out;
}

/** The lines over the limit, as `id: text`. */
function tooLong(conversations: readonly Conversation[]): string[] {
  const out: string[] = [];
  for (const c of conversations) for (const text of texts(c.lines)) if (words(text) > MAX_WORDS) out.push(`${c.id}: ${text}`);
  return out;
}

const said = (id: string): string => texts(CONVERSATIONS.find((c) => c.id === id)!.lines).join(' ');

// ---------------------------------------------------------------------------------------- the words

test('every line is at most 18 words', () => {
  expect(tooLong(CONVERSATIONS)).toEqual([]);
  expect(VILLAGER_LINES.filter((line) => words(line.text) > MAX_WORDS)).toEqual([]);
});

test('the scan fails a line of 19 words', () => {
  const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen';
  expect(tooLong([{ id: 'long', npc: 'x', lines: ['Short.', { text: 'Pick.', choices: [{ text: 'A', then: [long] }] }] }])).toEqual([`long: ${long}`]);
});

test('no line offers more than three choices, and no line is empty', () => {
  const visit = (lines: readonly (string | Line)[]): void => {
    for (const line of lines) {
      if (typeof line === 'string') continue;
      expect((line.choices ?? []).length).toBeLessThanOrEqual(3);
      for (const choice of line.choices ?? []) visit(choice.then ?? []);
    }
  };
  for (const c of CONVERSATIONS) {
    visit(c.lines);
    expect(c.lines.length).toBeGreaterThan(0);
    for (const text of texts(c.lines)) expect(text.trim()).not.toBe('');
  }
});

test('the three sample exchanges and the last scene are word for word', () => {
  expect(said('tamsin.meet')).toContain(
    'Twelve people have asked me for this plot. You are the first who looked at the ground before the view. ' +
    'Take the book. It has been blank for forty years. I only ever looked at things to price them.',
  );
  expect(said('maren.ask')).toContain(
    '(waking) Forty sacks. I counted twice. It is not enough, and counting again will not make it enough. ' +
    'Twenty sheaves by the festival. I can pay you in thanks and one good meal.',
  );
  expect(said('gus.seeds.first')).toContain('Soil\'s tired. Not lazy. Tired. You\'d be too.');
  expect(said('gus.first')).toContain('Soil\'s tired. Not lazy. Tired. You\'d be too.');
  expect(texts(CONVERSATIONS.find((c) => c.id === 'tamsin.end')!.lines)).toEqual([
    'Good harvest. Small, and good.',
    '(looking west) Evening came early again. A little sooner every week.',
    'Go on. Float your lamp.',
  ]);
});

test('nobody states the theme', () => {
  const all = [...CONVERSATIONS.flatMap((c) => texts(c.lines)), ...VILLAGER_LINES.map((line) => line.text)].join(' ').toLowerCase();
  expect(all).not.toContain('give back');
  expect(all).not.toContain('gives back');
  expect(all).not.toContain('only keep');
});

test('Brack says the river is lower in one line, the last of its conversation, with no reply offered', () => {
  const river = CONVERSATIONS.filter((c) => texts(c.lines).some((text) => /lower/i.test(text)));
  expect(river.map((c) => c.id)).toEqual(['brack.first']);
  const last = river[0].lines[river[0].lines.length - 1] as Line;
  expect(last.text).toMatch(/lower/);
  expect(last.choices).toBeUndefined();
  expect(river[0].lines.filter((line) => /lower/i.test(typeof line === 'string' ? line : line.text))).toHaveLength(1);
});

test('each of the eight has a first meeting, a fallback that comes last, and ids that are unique', () => {
  expect(new Set(CONVERSATIONS.map((c) => c.id)).size).toBe(CONVERSATIONS.length);
  for (const npc of NAMED) {
    const own = CONVERSATIONS.filter((c) => c.npc === npc);
    expect(own.length).toBeGreaterThanOrEqual(6);
    const open = own.filter((c) => !c.when);
    expect(open.map((c) => c.id)).toEqual([`${npc}.fallback`]);
    expect(own[own.length - 1].id).toBe(`${npc}.fallback`);
    // On a new game the first words from anyone are a first meeting, never the fallback.
    const s = stage({ story: false });
    s.run(0.1);
    s.talk(npc);
    expect(s.lastConversation()).not.toBe(`${npc}.fallback`);
  }
  expect(VILLAGER_LINES).toHaveLength(12);
});

// ---------------------------------------------------------------------------------------- the interpreter

const SMALL: Conversation[] = [
  { id: 'secret', npc: 'x', when: { flag: 'knows' }, lines: ['You know.'] },
  {
    id: 'ask',
    npc: 'x',
    lines: [
      'Hello.',
      { text: 'Skipped.', when: { flag: 'never' } },
      {
        text: 'Left or right?',
        effects: [{ flag: 'asked' }],
        choices: [
          { text: 'Left', effects: [{ give: 'berry', count: 2 }], then: ['Left it is.', 'Mind the step.'] },
          { text: 'Right', effects: [{ flag: 'went.right' }], then: ['Right, then.'] },
          { text: 'Hidden', when: { flag: 'never' } },
        ],
      },
      'Goodbye.',
    ],
  },
];

function small(): Stage {
  const s = stage({ story: false });
  s.game.systems.talk = createTalk(s.game, SMALL).api;
  return s;
}

test('a conversation shows its lines in order, keeps the player busy, and says when it starts and ends', () => {
  const s = small();
  const talk = s.game.systems.talk;
  expect(talk.active).toBe(false);
  expect(talk.current()).toBeNull();
  talk.talkTo('x');
  expect(talk.active).toBe(true);
  expect(s.game.player.busy).toBe(true);
  expect(s.events('talk.started')).toEqual([{ npc: 'x', conversation: 'ask' }]);
  expect(talk.current()).toMatchObject({ npc: 'x', text: 'Hello.', choices: [] });
  talk.advance();
  // The line whose condition is false is skipped, and a choice that is hidden is not offered.
  expect(talk.current()).toMatchObject({ text: 'Left or right?', choices: ['Left', 'Right'] });
  // A line with choices waits for one.
  talk.advance();
  expect(talk.current()!.text).toBe('Left or right?');
  talk.choose(5);
  expect(talk.current()!.text).toBe('Left or right?');
  talk.choose(0);
  expect(talk.current()!.text).toBe('Left it is.');
  talk.advance();
  expect(talk.current()!.text).toBe('Mind the step.');
  talk.advance();
  expect(talk.current()!.text).toBe('Goodbye.');
  expect(s.events('talk.ended')).toEqual([]);
  talk.advance();
  expect(talk.active).toBe(false);
  expect(talk.current()).toBeNull();
  expect(s.game.player.busy).toBe(false);
  expect(s.events('talk.ended')).toEqual([{ npc: 'x', conversation: 'ask' }]);
});

test('a choice branches: each one says and does something else', () => {
  const left = small();
  expect(left.talk('x', 0)).toEqual(['Hello.', 'Left or right?', 'Left it is.', 'Mind the step.', 'Goodbye.']);
  expect(left.bag.get('berry')).toBe(2);
  expect(left.game.flags.is('went.right')).toBe(false);

  const right = small();
  expect(right.talk('x', 1)).toEqual(['Hello.', 'Left or right?', 'Right, then.', 'Goodbye.']);
  expect(right.bag.get('berry')).toBeUndefined();
  expect(right.game.flags.is('went.right')).toBe(true);
});

test('a condition that is false hides a conversation, and the first one that holds wins', () => {
  const s = small();
  s.talk('x');
  expect(s.lastConversation()).toBe('ask');
  s.game.flags.set('knows', true);
  expect(s.talk('x')).toEqual(['You know.']);
  expect(s.lastConversation()).toBe('secret');
});

test('effects run when the conversation ends, so one cut short gives nothing', () => {
  const s = small();
  const talk = s.game.systems.talk;
  talk.talkTo('x');
  talk.advance();
  talk.choose(0);
  expect(s.game.flags.is('asked')).toBe(false);
  expect(s.bag.get('berry')).toBeUndefined();
  let busyAtEnd = true, berriesAtEnd = 0;
  s.game.events.on('talk.ended', () => {
    busyAtEnd = s.game.player.busy;
    berriesAtEnd = s.bag.get('berry') ?? 0;
  });
  s.through();
  expect(s.game.flags.is('asked')).toBe(true);
  expect(berriesAtEnd).toBe(2);
  expect(busyAtEnd).toBe(false);
});

test('a second talk cannot start while one is open, and a named conversation can be started directly', () => {
  const s = small();
  const talk = s.game.systems.talk;
  talk.talkTo('x');
  talk.start('secret');
  talk.talkTo('x');
  expect(s.events('talk.started')).toHaveLength(1);
  s.through();
  talk.start('secret');
  expect(talk.current()).toMatchObject({ npc: 'x', text: 'You know.' });
  s.through();
  talk.start('no.such.conversation');
  expect(talk.active).toBe(false);
});

test('a load closes an open conversation and frees the player, and nothing of it is saved', () => {
  const s = stage({ story: false });
  s.run(0.1);
  const save = s.kernel.save();
  s.game.systems.talk.talkTo('tamsin');
  s.game.systems.talk.advance();
  expect(s.game.player.busy).toBe(true);
  const middle = s.kernel.save();
  expect(middle.systems.talk).toBeNull();
  expect(new Map(middle.flags).get('plot.met')).toBeUndefined();
  s.kernel.load(save);
  expect(s.game.systems.talk.active).toBe(false);
  expect(s.game.player.busy).toBe(false);
  expect(s.bag.get('axe')).toBeUndefined();
  // Starting again plays it from the first line.
  s.game.systems.talk.talkTo('tamsin');
  expect(s.game.systems.talk.current()!.text).toBe('Twelve people have asked me for this plot.');
});

test('the dialogue box gets the speaker from the people system, and the narrator has no name', () => {
  const s = stage({ story: false });
  s.game.flags.set('quest.bread.started', true);
  s.game.flags.set('quest.bread.step', 'queen');
  s.game.systems.talk.talkTo('maren');
  expect(s.game.systems.talk.current()).toMatchObject({ npc: null, name: '', portrait: '', voice: '' });
  s.game.systems.talk.advance();
  expect(s.game.systems.talk.current()).toMatchObject({ npc: 'maren', name: 'Maren', portrait: 'maren', voice: 'maren' });
  expect(s.game.systems.talk.current()!.text.startsWith('(waking) Forty sacks.')).toBe(true);
});

test('a line said once is not said again', () => {
  const s = stage({ story: false });
  s.run(0.1);
  s.talk('brack');
  s.game.ambient.rain = 1;
  s.talk('brack');
  expect(s.lastConversation()).toBe('brack.rain');
  s.talk('brack');
  expect(s.lastConversation()).toBe('brack.fallback');
});

test('a background villager has one line a day from the pool, and a festival line during the festival', () => {
  const s = stage({ story: false });
  s.run(0.1);
  const everyday = VILLAGER_LINES.filter((line) => !line.when).map((line) => line.text);
  const first = s.talk('villager-1');
  expect(first).toHaveLength(1);
  expect(everyday).toContain(first[0]);
  expect(s.talk('villager-1')).toEqual(first);
  expect(s.events('talk.started').at(-1)).toMatchObject({ npc: 'villager-1' });
  // Different villagers do not all share one line.
  const lines = new Set(['villager-1', 'villager-2', 'villager-3', 'villager-4', 'villager-5', 'villager-6'].map((id) => s.talk(id)[0]));
  expect(lines.size).toBeGreaterThan(2);
  s.game.flags.set('festival.started', true);
  const festival = VILLAGER_LINES.filter((line) => line.id === 'villager.9' || line.id === 'villager.10').map((line) => line.text);
  expect(festival).toContain(s.talk('villager-1')[0]);
});

// ---------------------------------------------------------------------------------------- reachability

/** Makes a condition true on the stage, as far as a test can. */
function force(s: Stage, c: Condition): void {
  const { game } = s;
  if ('flag' in c) game.flags.set(c.flag, c.is ?? true);
  else if ('not' in c) deny(s, c.not);
  else if ('all' in c) for (const part of c.all) force(s, part);
  else if ('any' in c) force(s, c.any[0]);
  else if ('bag' in c) s.bag.set(typeof c.bag === 'string' ? c.bag : c.bag[0], c.atLeast ?? 1);
  else if ('quest' in c) forceQuest(s, c);
  else if ('place' in c) s.moveTo(c.place);
  else if ('page' in c) for (const fact of game.systems.almanac.page(c.page)!.facts) game.systems.almanac.learn(c.page, fact.id);
  else if ('known' in c) game.systems.almanac.learn(c.known, c.column);
  else if ('placed' in c) {
    game.systems.placeables.place(c.placed, 3, GROUND, 3, 0);
    if (c.covered) game.world.setBlock(3, GROUND + 2, 3, 1);
  } else if ('bonded' in c) s.pet.bonded = true;
  else if ('petNear' in c) Object.assign(s.pet.pos, game.player.pos);
  else if ('beside' in c) {
    s.pet.bonded = true;
    Object.assign(s.pet.pos, game.player.pos);
  } else if ('event' in c) {
    if (c.event === 'slept') game.systems.time.sleep();
  } else if ('raining' in c) game.ambient.rain = 1;
  else if ('dark' in c) game.clock.timeOfDay = 0.8;
  else if ('npcNear' in c) s.moveTo('grant.stone');
  else {
    s.bag.set(c.short, 0);
    s.bag.set(c.seed, 0);
    s.crops.length = 0;
  }
}

/** Makes a condition false, for the simple kinds dialogue negates. */
function deny(s: Stage, c: Condition): void {
  if ('flag' in c) s.game.flags.set(c.flag, false);
  else if ('bag' in c) s.bag.set(typeof c.bag === 'string' ? c.bag : c.bag[0], 0);
  else if ('all' in c) deny(s, c.all[0]);
  else if ('beside' in c) s.pet.pos.x = s.game.player.pos.x + 500;
  else if ('raining' in c) s.game.ambient.rain = 0;
  else if ('short' in c) s.bag.set(c.seed, c.of);
}

function forceQuest(s: Stage, c: Extract<Condition, { quest: string }>): void {
  const quests = s.game.systems.quests;
  const def = QUESTS.find((q) => q.id === c.quest)!;
  if (c.step === undefined && c.state === 'hidden') return;
  quests.skipTo(c.quest);
  const stop = c.step ?? (c.state === 'done' ? null : def.steps[0].id);
  for (const step of def.steps) {
    if (step.id === stop) break;
    force(s, step.done);
    // Long enough for the quest system's twice-a-second check.
    s.run(0.6);
  }
}

/** States a game passes through: new, at the start of each quest, and with everything done. */
const BASES: ((s: Stage) => void)[] = [
  () => {},
  ...QUESTS.map((q) => (s: Stage) => s.game.systems.quests.skipTo(q.id)),
  (s) => {
    s.game.systems.quests.skipTo('festival');
    for (const flag of ['festival.started', 'festival.lamp.given', 'festival.lamp', 'festival.ended', 'festival.over']) s.game.flags.set(flag, true);
  },
];

test('every conversation an NPC can start is reachable through talkTo', () => {
  const unreachable: string[] = [];
  for (const c of CONVERSATIONS) {
    let reached = false;
    for (const base of BASES) {
      for (const met of [false, true]) {
        const s = stage({ story: false });
        s.run(0.1);
        base(s);
        // The state a player would be in: an axe in the bag, and the once-only lines before this one already heard.
        s.bag.set('axe', 1);
        if (met) s.game.flags.set(`met.${c.npc}`, true);
        for (const earlier of CONVERSATIONS) {
          if (earlier === c) break;
          if (earlier.npc === c.npc && earlier.once) s.game.flags.set(`said.${earlier.id}`, true);
        }
        if (c.when) force(s, c.when);
        s.run(0.6);
        if (!holds(s.game, c.when)) continue;
        s.game.systems.talk.talkTo(c.npc);
        if ((s.events('talk.started').at(-1) as GameEvents['talk.started'] | undefined)?.conversation === c.id) {
          // It also has to run to its end and let the player go.
          s.through();
          expect(s.game.player.busy).toBe(false);
          reached = true;
        }
        if (reached) break;
      }
      if (reached) break;
    }
    if (!reached) unreachable.push(c.id);
  }
  expect(unreachable).toEqual([]);
});

test('every line and every choice of every conversation can be shown', () => {
  // Lines with a condition come in pairs that cover both sides, so each one shows in some state.
  const missing: string[] = [];
  for (const c of CONVERSATIONS) {
    const wanted = new Set(texts(c.lines));
    for (let variant = 0; variant < 8 && wanted.size; variant++) {
      const s = stage({ story: false });
      s.run(0.1);
      if (c.when) force(s, c.when);
      if (variant & 1) {
        s.pet.bonded = true;
        Object.assign(s.pet.pos, s.game.player.pos);
      } else s.pet.pos.x += 500;
      s.game.ambient.rain = variant & 2 ? 1 : 0;
      s.game.flags.set('festival.lamp.given', variant >= 4);
      if (c.id === 'juniper.trade') s.game.flags.set('juniper.secrets', variant % 4);
      if (c.id === 'tamsin.after') s.bag.set('river_lamp', variant & 1);
      const talk = s.game.systems.talk;
      for (const choice of [0, 1, 2]) {
        talk.start(c.id);
        for (let guard = 0; talk.active && guard < 50; guard++) {
          const line = talk.current()!;
          wanted.delete(line.text);
          for (const text of line.choices) wanted.delete(text);
          if (line.choices.length) talk.choose(Math.min(choice, line.choices.length - 1));
          else talk.advance();
        }
      }
    }
    for (const text of wanted) missing.push(`${c.id}: ${text}`);
  }
  expect(missing).toEqual([]);
});

test('job barks follow the assigned appearance and yield to festival lines', () => {
  const s = stage({story: false});
  s.run(.1);
  s.people.get('villager-1')!.sprite = 'town-pell';
  const talk = s.game.systems.talk;
  talk.talkTo('villager-1');
  expect(talk.current()?.text).toBe('Fish took my bait. Left me the hook. Polite of them.');
  s.through();
  s.people.get('villager-1')!.sprite = 'town-pip';
  talk.talkTo('villager-1');
  expect(talk.current()?.text).toBe('Mira let me sort the nails. Bent ones have their own pot.');
  s.through();
  s.game.flags.set('festival.started', true);
  talk.talkTo('villager-1');
  expect(VILLAGER_LINES.filter(l => l.when).map(l => l.text)).toContain(talk.current()?.text ?? '');
});
