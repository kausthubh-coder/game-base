import { expect, test } from 'bun:test';
import { CONVERSATIONS } from '../../src/game/content/dialogue.ts';
import { heardShare, revealTimes, spokenLines, tagsReadOut, voiceText, withoutCues } from './lines.ts';

const align = (text: string, step = 0.1) => {
  const characters = [...text];
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => +(i * step).toFixed(3)),
    character_end_times_seconds: characters.map((_, i) => +((i + 1) * step).toFixed(3)),
  };
};

test('every line a person says is found once, with each place it is said, and narration is left out', () => {
  const lines = spokenLines(CONVERSATIONS);
  const gift = lines.find((l) => l.key === "gus|Rain'd do it better. Rain always does it better.");
  expect(gift?.ids).toEqual(['gus.seeds.first.5', 'gus.seeds.3']);
  expect(gift?.conversations).toEqual(['gus.seeds.first', 'gus.seeds']);
  // A line after a choice.
  expect(lines.find((l) => l.text.startsWith('They crowned me'))?.ids).toEqual(['maren.ask.3.2.0']);
  expect(lines.some((l) => l.text.startsWith('She puts it in your hands'))).toBe(false);
  expect(lines.some((l) => l.text === 'Twenty sheaves. Done.')).toBe(false);
});

test('a stage cue is never given to the voice, and a direction replaces the words when there is one', () => {
  expect(withoutCues('(waking) Forty sacks. I counted twice.')).toBe('Forty sacks. I counted twice.');
  expect(withoutCues('Still here. (smiling) Good.')).toBe('Still here. Good.');
  expect(voiceText('(palm out) Stand in it.', {})).toBe('Stand in it.');
  expect(voiceText('(waking) Forty.', { '(waking) Forty.': '[sleepily] Forty.' })).toBe('[sleepily] Forty.');
});

test('each letter of the box appears when the voice says it, a leading cue with the first word, a tag takes no letter', () => {
  const text = '(waking) Hi. Yo';
  const { reveal, aligned } = revealTimes(text, align('[sleepily] Hi. Yo'), 2);
  expect(aligned).toBe(true);
  // "[sleepily] " is 11 characters at 0.1 s each, so H is said at 1.1 s.
  expect(reveal.slice(0, 9)).toEqual(new Array(9).fill(1100));
  expect(reveal[text.indexOf('H')]).toBe(1100);
  expect(reveal[text.indexOf('Y')]).toBe(1500);
  expect(reveal.at(-1)).toBe(1600);
});

test('letters that do not match the alignment are spread evenly over the clip instead', () => {
  const { reveal, aligned } = revealTimes('Forty sacks.', align('40 sacks.'), 2);
  expect(aligned).toBe(false);
  expect(reveal[0]).toBe(0);
  expect(reveal.at(-1)).toBeLessThanOrEqual(1900);
  for (let i = 1; i < reveal.length; i++) expect(reveal[i]).toBeGreaterThanOrEqual(reveal[i - 1]);
});

test('a transcript is scored by the words heard in order, and a tag heard as a word is caught', () => {
  expect(heardShare('Soil\'s tired. Not lazy.', 'soil\'s tired, not lazy')).toBe(1);
  expect(heardShare('Rain\'d do it better.', 'Rain do it better')).toBe(0.75);
  expect(heardShare('Eighteen. Thirty-nine sacks.', '18. 39 sacks')).toBe(1);
  expect(tagsReadOut('[sleepily] Forty sacks.', 'Sleepily, forty sacks.')).toEqual(['sleepily']);
  expect(tagsReadOut('[sighs] They crowned me.', '[sighs] They crowned me.')).toEqual([]);
});
