// The pure half of the voice tool: which lines are spoken, what the voice is given, the hash that names a clip,
// and when each letter of the box's text should appear. tools/voice.ts does the calls and the files.
import { createHash } from 'node:crypto';
import type { Conversation, Line } from '../../src/game/content/dialogue.ts';
import type { CastVoice } from '../../src/game/content/cast.ts';
import type { Alignment } from './eleven.ts';

/** One line someone says, however many conversations it is in. */
export interface SpokenLine {
  /** `<speaker>|<text>`: what the game looks a clip up by. */
  key: string;
  speaker: string;
  /** The line as the box shows it. */
  text: string;
  /** Where it is in dialogue.ts: `<conversation>.<index>`, with `.<choice>.<index>` for a line after a choice. */
  ids: string[];
  conversations: string[];
}

/** Every line a person says in the conversations, in order, once each. Narration and the player's choices are not spoken. */
export function spokenLines(conversations: readonly Conversation[]): SpokenLine[] {
  const found = new Map<string, SpokenLine>();
  const walk = (conversation: Conversation, list: readonly (string | Line)[], path: string): void => {
    list.forEach((raw, i) => {
      const line: Line = typeof raw === 'string' ? { text: raw } : raw;
      const speaker = line.by ?? conversation.npc;
      if (speaker !== 'narrator') {
        const key = `${speaker}|${line.text}`;
        const entry = found.get(key) ?? { key, speaker, text: line.text, ids: [], conversations: [] };
        entry.ids.push(`${conversation.id}.${path}${i}`);
        if (!entry.conversations.includes(conversation.id)) entry.conversations.push(conversation.id);
        found.set(key, entry);
      }
      (line.choices ?? []).forEach((choice, c) => walk(conversation, choice.then ?? [], `${path}${i}.${c}.`));
    });
  };
  for (const conversation of conversations) walk(conversation, conversation.lines, '');
  return [...found.values()];
}

/** The line without its stage cues: "(waking) Forty sacks." is said as "Forty sacks." */
export const withoutCues = (text: string): string => text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

/** What the voice is given: the line's direction when it has one, else the words without the stage cues. */
export function voiceText(text: string, direction: Readonly<Record<string, string>>): string {
  return direction[text] ?? withoutCues(text);
}

/** Names a clip: the same words, voice, model, settings and format always give the same hash. */
export function clipHash(say: string, voice: CastVoice, model: string, format: string): string {
  return createHash('sha1').update(JSON.stringify([say, voice.voiceId, model, voice.settings, format])).digest('hex').slice(0, 12);
}

/**
 * When each character of the box's text appears, in whole milliseconds from the start of the clip.
 * Letters follow the voice: the alignment's characters, with [tags] taken out, are matched to the text's
 * letters in order. A stage cue in parentheses and a space take the time of the next letter, so a leading
 * "(waking)" shows with the first word. If the letters do not line up, they are spread evenly over the clip,
 * and `aligned` is false.
 */
export function revealTimes(text: string, alignment: Alignment | null, seconds: number): { reveal: number[]; aligned: boolean } {
  const reveal = new Array<number>(text.length).fill(0);
  // The characters that are said: outside parentheses, not spaces.
  const said: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (!depth && !/\s/.test(c)) said.push(i);
  }
  const voiced: number[] = [];
  let aligned = false;
  if (alignment) {
    const chars: { c: string; t: number }[] = [];
    let tag = 0;
    for (let i = 0; i < alignment.characters.length; i++) {
      const c = alignment.characters[i];
      if (c === '[') tag++;
      else if (c === ']') tag = Math.max(0, tag - 1);
      else if (!tag && !/\s/.test(c)) chars.push({ c, t: alignment.character_start_times_seconds[i] });
    }
    aligned = chars.length === said.length && said.every((at, k) => text[at].toLowerCase() === chars[k].c.toLowerCase());
    if (aligned) for (const ch of chars) voiced.push(ch.t);
  }
  if (!aligned) for (let k = 0; k < said.length; k++) voiced.push((k / Math.max(1, said.length)) * seconds * 0.95);
  // Each said letter at its time; everything else at the time of the next said letter (or the last one).
  let k = said.length - 1;
  let next = voiced.length ? voiced[voiced.length - 1] : 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (k >= 0 && said[k] === i) next = voiced[k--];
    reveal[i] = Math.round(next * 1000);
  }
  // Never earlier than the letter before it.
  for (let i = 1; i < reveal.length; i++) if (reveal[i] < reveal[i - 1]) reveal[i] = reveal[i - 1];
  return { reveal, aligned };
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** Scribe writes "18" and "40" for words the line spells out. Under a hundred, as words. */
const spell = (n: number): string => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const words = (s: string) => s.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/\b\d{1,2}\b/g, (d) => ` ${spell(Number(d))} `).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);

/** The share of the line's words heard in a transcript, in order (the longest common run of words). */
export function heardShare(expected: string, transcript: string): number {
  const a = words(expected), b = words(transcript);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return a.length ? dp[a.length][b.length] / a.length : 1;
}

/** A tag's word heard as a word, such as "sleepily" in the transcript: the tag was read out, not performed. */
export function tagsReadOut(say: string, transcript: string): string[] {
  const heard = new Set(words(transcript));
  const tags = [...say.matchAll(/\[([^\]]+)\]/g)].flatMap((m) => words(m[1]));
  const spoken = new Set(words(say));
  return tags.filter((w) => heard.has(w) && !spoken.has(w));
}
