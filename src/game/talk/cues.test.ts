import { expect, test } from 'bun:test';
import { CONVERSATIONS } from '../content/dialogue.ts';
import { splitCues } from './cues.sim.ts';

test('a cue is taken out of the words shown and kept for the stage', () => {
  expect(splitCues("(one eye opening) You're late.")).toEqual({ shown: "You're late.", cues: ['one eye opening'], keep: Array.from("You're late.", (_, i) => i + 18) });
  const mid = splitCues('Hand. Show me. (a long look) Yes. That is her mark.');
  expect(mid.shown).toBe('Hand. Show me. Yes. That is her mark.');
  expect(mid.cues).toEqual(['a long look']);
  // Each letter shown points at the same letter of the whole line, for the voice's timings.
  const whole = 'Hand. Show me. (a long look) Yes. That is her mark.';
  expect(mid.keep.map((i) => whole[i]).join('')).toBe(mid.shown);
  expect(splitCues('No cue here.')).toEqual({ shown: 'No cue here.', cues: [], keep: Array.from('No cue here.', (_, i) => i) });
});

test('no line of the act shows a bracket once its cues are out', () => {
  for (const conversation of CONVERSATIONS) {
    for (const line of conversation.lines) {
      const text = typeof line === 'string' ? line : line.text;
      const { shown } = splitCues(text);
      expect(shown, `${conversation.id}: ${text}`).not.toMatch(/[()]/);
      expect(shown.length, `${conversation.id}: ${text}`).toBeGreaterThan(0);
    }
  }
});
