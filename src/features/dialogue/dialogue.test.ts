import { describe, expect, test } from 'bun:test';
import { bakerTalk, childTalk, sampleConversations, sampleVoices } from '../../content/dialogue-samples.ts';
import {
  MAX_CHOICES, Talk, Typewriter, applyEffects, checkConversation, isVoiced, passes,
  type Conversation, type Flags,
} from './dialogue.sim.ts';

const texts = (talk: Talk): string[] => talk.current?.choices.map((c) => c.text) ?? [];

describe('conditions on flags', () => {
  const flags: Flags = { met: true, wood: 12, mood: 'happy', zero: 0 };

  test('a bare flag passes when it is set to something truthy', () => {
    expect([passes({ flag: 'met' }, flags), passes({ flag: 'wood' }, flags), passes({ flag: 'zero' }, flags), passes({ flag: 'never' }, flags)])
      .toEqual([true, true, false, false]);
    expect(passes(undefined, flags)).toBe(true);
  });

  test('is, isNot, atLeast and below', () => {
    expect(passes({ flag: 'mood', is: 'happy' }, flags)).toBe(true);
    expect(passes({ flag: 'mood', is: 'sad' }, flags)).toBe(false);
    expect(passes({ flag: 'mood', isNot: 'sad' }, flags)).toBe(true);
    expect(passes({ flag: 'wood', atLeast: 10 }, flags)).toBe(true);
    expect(passes({ flag: 'wood', atLeast: 13 }, flags)).toBe(false);
    expect(passes({ flag: 'wood', atLeast: 10, below: 12 }, flags)).toBe(false);
    // A flag that was never set is false, and 0 as a number.
    expect(passes({ flag: 'never', is: false }, flags)).toBe(true);
    expect(passes({ flag: 'never', below: 1 }, flags)).toBe(true);
    expect(passes({ flag: 'never', atLeast: 1 }, flags)).toBe(false);
  });

  test('all, any and not', () => {
    expect(passes({ all: [{ flag: 'met' }, { flag: 'wood', atLeast: 10 }] }, flags)).toBe(true);
    expect(passes({ all: [{ flag: 'met' }, { flag: 'never' }] }, flags)).toBe(false);
    expect(passes({ any: [{ flag: 'never' }, { flag: 'mood', is: 'happy' }] }, flags)).toBe(true);
    expect(passes({ not: { flag: 'never' } }, flags)).toBe(true);
    expect(passes({ not: { any: [{ flag: 'met' }] } }, flags)).toBe(false);
  });
});

describe('effects on flags', () => {
  test('set, add and clear', () => {
    const flags: Flags = { wood: 12 };
    applyEffects([{ set: 'met' }, { set: 'oven', to: 'lit' }, { add: 'wood', by: -10 }, { add: 'friend' }, { add: 'friend' }], flags);
    expect(flags).toEqual({ wood: 2, met: true, oven: 'lit', friend: 2 });
    applyEffects([{ clear: 'met' }], flags);
    expect('met' in flags).toBe(false);
  });
});

describe('a conversation', () => {
  const talk: Conversation = {
    id: 'test',
    start: 'a',
    speakers: { npc: { name: 'Npc', voice: 'low' } },
    lines: {
      a: { who: 'npc', text: 'One.', to: 'b' },
      b: {
        who: 'npc', text: 'Pick.',
        choices: [
          { text: 'Rich only', if: { flag: 'gold', atLeast: 5 }, do: [{ add: 'gold', by: -5 }, { set: 'paid' }], to: 'c' },
          { text: 'Leave', to: 'd' },
        ],
      },
      c: { who: 'npc', text: 'Thanks.' },
      d: { who: 'npc', if: { flag: 'paid' }, else: 'e', text: 'Never said.' },
      e: { who: 'npc', text: 'Bye.' },
    },
  };

  test('lines follow each other and the conversation ends after the last', () => {
    const run = new Talk(talk, {});
    expect(run.current).toMatchObject({ line: 'a', who: 'npc', text: 'One.', speaker: { name: 'Npc', voice: 'low' }, choices: [] });
    expect(run.advance()).toBe(true);
    expect(run.current!.line).toBe('b');
    // A line with choices waits for a pick.
    expect(run.advance()).toBe(false);
    expect(run.current!.line).toBe('b');
    expect(run.choose(0)).toBe(true);
    expect(run.current!.text).toBe('Bye.');
    expect(run.advance()).toBe(true);
    expect(run.done).toBe(true);
    expect(run.advance()).toBe(false);
    expect(run.said).toEqual(['a', 'b', 'e']);
  });

  test('a choice with a condition is offered only when the condition passes', () => {
    const poor = new Talk(talk, { gold: 2 });
    poor.advance();
    expect(texts(poor)).toEqual(['Leave']);
    const rich = new Talk(talk, { gold: 7 });
    rich.advance();
    expect(texts(rich)).toEqual(['Rich only', 'Leave']);
  });

  test('picking a choice applies its effects to the flags', () => {
    const flags: Flags = { gold: 7 };
    const run = new Talk(talk, flags);
    run.advance();
    expect(run.choose(0)).toBe(true);
    expect(flags).toEqual({ gold: 2, paid: true });
    expect(run.current!.text).toBe('Thanks.');
    // Picking a choice that is not offered does nothing.
    expect(run.choose(5)).toBe(false);
  });

  test('a line whose condition fails is skipped to its else', () => {
    const run = new Talk(talk, { gold: 0 });
    run.advance();
    run.choose(0);
    expect(run.current!.line).toBe('e');
    expect(run.said).not.toContain('d');
  });

  test('no more than three choices are offered', () => {
    const many: Conversation = {
      id: 'many', start: 'a', speakers: { npc: { name: 'Npc', voice: 'low' } },
      lines: { a: { who: 'npc', text: 'Pick.', choices: [{ text: '1', if: { flag: 'x' } }, { text: '2' }, { text: '3' }, { text: '4' }, { text: '5' }] } },
    };
    expect(MAX_CHOICES).toBe(3);
    expect(texts(new Talk(many, {}))).toEqual(['2', '3', '4']);
    const withX = new Talk(many, { x: true });
    expect(texts(withX)).toEqual(['1', '2', '3']);
    // The offered place maps back to the right written choice.
    expect(withX.current!.choices.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(new Talk(many, {}).current!.choices.map((c) => c.index)).toEqual([1, 2, 3]);
  });

  test('skips that form a ring end the conversation and do not hang', () => {
    const ring: Conversation = {
      id: 'ring', start: 'a', speakers: { npc: { name: 'Npc', voice: 'low' } },
      lines: { a: { who: 'npc', text: 'A', if: { flag: 'no' }, else: 'b' }, b: { who: 'npc', text: 'B', if: { flag: 'no' }, else: 'a' } },
    };
    expect(new Talk(ring, {}).done).toBe(true);
  });
});

describe('the sample conversations', () => {
  test('they are well formed', () => {
    for (const conversation of sampleConversations) expect(checkConversation(conversation)).toEqual([]);
    for (const conversation of sampleConversations) {
      for (const speaker of Object.values(conversation.speakers)) expect(sampleVoices[speaker.voice]).toBeDefined();
    }
  });

  test('the checker finds what is wrong with a broken one', () => {
    const broken: Conversation = {
      id: 'broken', start: 'nowhere', speakers: {},
      lines: { a: { who: 'ghost', text: ' ', to: 'gone', choices: [{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4', to: 'lost' }] } },
    };
    const problems = checkConversation(broken);
    expect(problems.length).toBe(7);
    expect(problems.join(' ')).toContain('more than 3 choices');
  });

  test('the baker: the wood choice needs ten logs, and giving them lights the oven and earns a sweet', () => {
    const flags: Flags = { wood: 4 };
    let run = new Talk(bakerTalk, flags);
    expect(run.current!.speaker.name).toBe('Odo');
    expect(run.current!.text).toContain('Gerald');
    expect(flags['met.odo']).toBe(true);
    run.advance();
    expect(flags.oven).toBe('asked');
    // Four logs are not enough, so the first choice is not offered.
    expect(texts(run)).toEqual(['I will find you some wood.', 'Why is he called Gerald?']);
    run.choose(1);
    run.choose(0);
    expect(run.current!.text).toContain('Ten logs');
    run.advance();
    expect(run.done).toBe(true);

    // Later, still short of wood: he remembers, and does not introduce himself again.
    run = new Talk(bakerTalk, flags);
    expect(run.current!.line).toBe('waiting');
    expect(texts(run)).toEqual(['I am still looking.']);

    // With twelve logs the choice appears, and picking it changes four flags.
    flags.wood = 12;
    run = new Talk(bakerTalk, flags);
    expect(texts(run)).toEqual(['Here. Ten logs.', 'I am still looking.']);
    run.choose(0);
    expect(flags).toMatchObject({ wood: 2, oven: 'lit', 'friend.odo': 1, sweets: 1 });
    expect(run.current!.line).toBe('thanks');

    // After that he talks about the lit oven.
    expect(new Talk(bakerTalk, flags).current!.line).toBe('lit');
  });

  test('the baker: with wood in hand on the first visit it is one talk', () => {
    const flags: Flags = { wood: 12 };
    const run = new Talk(bakerTalk, flags);
    run.advance();
    expect(texts(run)).toEqual(['I have wood right here.', 'I will find you some wood.', 'Why is he called Gerald?']);
    run.choose(0);
    expect(flags.oven).toBe('lit');
  });

  test('the child: the secret costs a sweet, and telling it sets the rumor flag', () => {
    const flags: Flags = {};
    let run = new Talk(childTalk, flags);
    expect(run.current!.speaker.name).toBe('Juniper');
    expect(texts(run)).toEqual(['Just tell me.', 'Not now.']);
    run.choose(0);
    expect(run.current!.text).toContain('one sweet');
    run.advance();
    expect(flags['rumor.leaftail']).toBeUndefined();

    flags.sweets = 1;
    run = new Talk(childTalk, flags);
    expect(texts(run)[0]).toBe('Trade you a honey bun.');
    run.choose(0);
    expect(flags).toEqual({ sweets: 0, 'rumor.leaftail': true });
    run.advance();
    run.advance();
    expect(run.done).toBe(true);
    expect(run.said).toEqual(['psst', 'secret', 'promise']);

    // She knows she told you, and later that you found it.
    expect(new Talk(childTalk, flags).current!.line).toBe('told');
    flags['pet.leaftail'] = true;
    expect(new Talk(childTalk, flags).current!.line).toBe('found');
  });
});

describe('typing a line out', () => {
  test('letters appear at the speed given, and each is reported once in order', () => {
    const type = new Typewriter(10);
    const seen: string[] = [];
    type.start('Hello');
    type.tick(0, (c) => seen.push(c));
    expect(seen).toEqual(['H']);
    type.tick(0.25, (c) => seen.push(c));
    expect(seen.join('')).toBe('Hel');
    expect(type.done).toBe(false);
    for (let i = 0; i < 30; i++) type.tick(0.05, (c) => seen.push(c));
    expect(seen.join('')).toBe('Hello');
    expect([type.shown, type.done]).toEqual([5, true]);
    expect(type.tick(1)).toBe(0);
  });

  test('a comma and the end of a sentence make a pause', () => {
    const plain = new Typewriter(20), paused = new Typewriter(20);
    plain.start('ab cd ef');
    paused.start('ab. cd, ef');
    const time = (type: Typewriter): number => { let t = 0; while (!type.done) { type.tick(0.01); t += 0.01; } return t; };
    expect(time(paused) - time(plain)).toBeGreaterThan(0.4);
  });

  test('finish shows the whole line at once', () => {
    const type = new Typewriter(10);
    type.start('A long line of text.');
    type.tick(0.1);
    type.finish();
    expect([type.shown, type.done]).toEqual([20, true]);
  });

  test('a speaker can have their own speed', () => {
    const type = new Typewriter(10);
    type.start('abcdefghij', 100);
    type.tick(0.05);
    expect(type.shown).toBeGreaterThanOrEqual(5);
  });

  test('only letters and digits are voiced', () => {
    expect(['a', 'Z', 'é', '7', ' ', '.', '!', ','].map(isVoiced)).toEqual([true, true, true, true, false, false, false, false]);
  });
});
