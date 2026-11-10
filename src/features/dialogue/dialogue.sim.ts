// A conversation is data: lines, up to three choices on a line, conditions and effects on named
// flags. This file is the small interpreter that runs one, and the rule for how text types out.
// It knows nothing about the page, so a server can run a conversation and a test can read one.

/** A flag's value. A flag that was never set reads as false, and as 0 where a number is asked for. */
export type FlagValue = boolean | number | string;
export type Flags = Record<string, FlagValue>;

/**
 * A test on flags. With only `flag` it passes when the flag is set to something truthy.
 * `is` and `isNot` compare the value, `atLeast` and `below` compare it as a number.
 */
export type Condition =
  | { flag: string; is?: FlagValue; isNot?: FlagValue; atLeast?: number; below?: number }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { not: Condition };

/** A change to a flag: set it (to true by default), add to it (1 by default), or clear it. */
export type Effect =
  | { set: string; to?: FlagValue }
  | { add: string; by?: number }
  | { clear: string };

export interface Speaker {
  name: string;
  /** The voice the sound engine uses for this speaker's letters. */
  voice: string;
  /** Which portrait to show. The speaker's key by default. */
  portrait?: string;
  /** Letters a second. The box's own speed by default. */
  speed?: number;
}

export interface Choice {
  text: string;
  /** The choice is offered only when this passes. */
  if?: Condition;
  /** Applied when the player picks it. */
  do?: readonly Effect[];
  /** The line to go to. The conversation ends when it is left out. */
  to?: string;
}

export interface Line {
  /** A key of the conversation's `speakers`. */
  who: string;
  text: string;
  /** When this fails the line is not said, and the conversation goes on at `else`, or at `to` without one. */
  if?: Condition;
  else?: string;
  /** Applied when the line is said. */
  do?: readonly Effect[];
  /** Up to three are offered. More may be written when conditions keep the offered ones to three. */
  choices?: readonly Choice[];
  /** The next line when there are no choices. The conversation ends when it is left out. */
  to?: string;
}

export interface Conversation {
  id: string;
  /** The key of the first line. */
  start: string;
  speakers: Record<string, Speaker>;
  lines: Record<string, Line>;
}

export const MAX_CHOICES = 3;

export function readFlag(flags: Flags, name: string): FlagValue {
  return flags[name] ?? false;
}

export function passes(condition: Condition | undefined, flags: Flags): boolean {
  if (!condition) return true;
  if ('all' in condition) return condition.all.every((c) => passes(c, flags));
  if ('any' in condition) return condition.any.some((c) => passes(c, flags));
  if ('not' in condition) return !passes(condition.not, flags);
  const value = readFlag(flags, condition.flag);
  const asNumber = typeof value === 'number' ? value : value === true ? 1 : 0;
  let tested = false;
  if (condition.is !== undefined) { tested = true; if (value !== condition.is) return false; }
  if (condition.isNot !== undefined) { tested = true; if (value === condition.isNot) return false; }
  if (condition.atLeast !== undefined) { tested = true; if (!(asNumber >= condition.atLeast)) return false; }
  if (condition.below !== undefined) { tested = true; if (!(asNumber < condition.below)) return false; }
  return tested ? true : Boolean(value);
}

export function applyEffects(effects: readonly Effect[] | undefined, flags: Flags): void {
  if (!effects) return;
  for (const effect of effects) {
    if ('set' in effect) flags[effect.set] = effect.to ?? true;
    else if ('add' in effect) {
      const before = flags[effect.add];
      flags[effect.add] = (typeof before === 'number' ? before : 0) + (effect.by ?? 1);
    } else delete flags[effect.clear];
  }
}

/** A choice as offered to the player. */
export interface OfferedChoice {
  text: string;
  /** Its place in the line's `choices`, for telling which one was picked. */
  index: number;
}

/** What the box shows now. */
export interface Said {
  /** The key of the line. */
  line: string;
  /** The speaker's key, and the speaker. */
  who: string;
  speaker: Speaker;
  text: string;
  choices: readonly OfferedChoice[];
}

/** One run of a conversation. It changes the flags it was given as lines are said and choices are picked. */
export class Talk {
  readonly conversation: Conversation;
  readonly flags: Flags;
  /** The line being said, or null once the conversation is over. */
  current: Said | null = null;
  /** The keys of the lines said so far, in order. */
  readonly said: string[] = [];

  constructor(conversation: Conversation, flags: Flags = {}) {
    this.conversation = conversation;
    this.flags = flags;
    this.enter(conversation.start);
  }

  get done(): boolean {
    return this.current === null;
  }

  /** Moves on from a line that has no choices. Returns false on a line with choices, where the player has to pick, and after the end. */
  advance(): boolean {
    if (!this.current || this.current.choices.length > 0) return false;
    this.enter(this.conversation.lines[this.current.line].to);
    return true;
  }

  /** Picks one of the offered choices by its place among them, 0 first. Returns false when there is no such choice. */
  choose(offered: number): boolean {
    const choice = this.current?.choices[offered];
    if (!this.current || !choice) return false;
    const picked = this.conversation.lines[this.current.line].choices![choice.index];
    applyEffects(picked.do, this.flags);
    this.enter(picked.to);
    return true;
  }

  private enter(key: string | undefined): void {
    // A line whose condition fails is skipped. The count stops a conversation whose skips form a ring.
    for (let hops = 0; key !== undefined && hops < 100; hops++) {
      const line = this.conversation.lines[key];
      if (!line) break;
      if (!passes(line.if, this.flags)) {
        key = line.else ?? line.to;
        continue;
      }
      applyEffects(line.do, this.flags);
      const choices: OfferedChoice[] = [];
      (line.choices ?? []).forEach((choice, index) => {
        if (choices.length < MAX_CHOICES && passes(choice.if, this.flags)) choices.push({ text: choice.text, index });
      });
      this.said.push(key);
      this.current = { line: key, who: line.who, speaker: this.conversation.speakers[line.who] ?? { name: line.who, voice: line.who }, text: line.text, choices };
      return;
    }
    this.current = null;
  }
}

/** What is wrong with a conversation as written, as sentences. An empty list means it can run. */
export function checkConversation(conversation: Conversation): string[] {
  const problems: string[] = [];
  const { lines, speakers } = conversation;
  const known = (key: string | undefined, from: string): void => {
    if (key !== undefined && !(key in lines)) problems.push(`${from} goes to "${key}", which is not a line.`);
  };
  if (!(conversation.start in lines)) problems.push(`The start "${conversation.start}" is not a line.`);
  for (const [key, line] of Object.entries(lines)) {
    if (!(line.who in speakers)) problems.push(`Line "${key}" is said by "${line.who}", who is not a speaker.`);
    if (!line.text.trim()) problems.push(`Line "${key}" has no text.`);
    known(line.to, `Line "${key}"`);
    known(line.else, `Line "${key}"`);
    if (line.else !== undefined && !line.if) problems.push(`Line "${key}" has an else and no condition.`);
    const choices = line.choices ?? [];
    if (choices.length > 0 && line.to !== undefined) problems.push(`Line "${key}" has choices and a next line. The choices decide.`);
    if (choices.filter((c) => !c.if).length > MAX_CHOICES) problems.push(`Line "${key}" always offers more than ${MAX_CHOICES} choices.`);
    if (choices.length > 0 && choices.every((c) => c.if)) problems.push(`Line "${key}" may offer no choice at all: give one of them no condition.`);
    choices.forEach((choice, i) => {
      if (!choice.text.trim()) problems.push(`Choice ${i + 1} of line "${key}" has no text.`);
      known(choice.to, `Choice ${i + 1} of line "${key}"`);
    });
  }
  return problems;
}

/** Seconds added after a letter, so a sentence breathes: a short stop at a comma, a longer one at the end of a sentence. */
function pauseAfter(char: string, next: string): number {
  if (next === '' || '.,!?;:…'.includes(next)) return 0;
  if (char === ',' || char === ';' || char === ':') return 0.12;
  if (char === '.' || char === '!' || char === '?' || char === '…') return 0.3;
  return 0;
}

/** Types a line out a letter at a time. Feed it the frame's seconds. */
export class Typewriter {
  text = '';
  /** How many characters are showing. */
  shown = 0;
  charsPerSecond: number;
  private wait = 0;

  constructor(charsPerSecond = 32) {
    this.charsPerSecond = charsPerSecond;
  }

  get done(): boolean {
    return this.shown >= this.text.length;
  }

  start(text: string, charsPerSecond = this.charsPerSecond): void {
    this.text = text;
    this.charsPerSecond = charsPerSecond;
    this.shown = 0;
    this.wait = 0;
  }

  /** Shows the whole line at once. */
  finish(): void {
    this.shown = this.text.length;
    this.wait = 0;
  }

  /**
   * Moves time on and shows the characters that are due. `each` is called for every character as
   * it appears, spaces and punctuation included. Returns how many appeared.
   */
  tick(dt: number, each?: (char: string, index: number) => void): number {
    let appeared = 0;
    this.wait -= dt;
    while (this.shown < this.text.length && this.wait <= 0) {
      const char = this.text[this.shown];
      this.shown++;
      appeared++;
      each?.(char, this.shown - 1);
      // A space costs nothing, so the speed is in letters.
      this.wait += (char === ' ' ? 0 : 1 / this.charsPerSecond) + pauseAfter(char, this.text[this.shown] ?? '');
    }
    if (this.done) this.wait = 0;
    return appeared;
  }
}

/** True for a character the sound engine gives a voice to: a letter or a digit. */
export function isVoiced(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}
