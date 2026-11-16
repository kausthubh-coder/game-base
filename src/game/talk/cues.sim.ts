// Stage cues. A line of content/dialogue.ts may carry a cue in brackets, "(one eye opening) You're late.", for
// whoever stages it and for the voice. The box never prints one: the words shown are the line without its cues,
// and the stage view (src/game/views/story-stage.view.ts) acts out the cues it knows.

export interface Cued {
  /** The words the box shows. */
  shown: string;
  /** The cues, in order, without their brackets. */
  cues: string[];
  /** For each letter shown, where it stands in the whole line: a voice clip's timings are by the whole line. */
  keep: number[];
}

/** Splits a line into the words shown and its cues. A line with no cue is shown as it is. */
export function splitCues(text: string): Cued {
  if (!text.includes('(')) return { shown: text, cues: [], keep: Array.from(text, (_, i) => i) };
  const cues: string[] = [];
  const keep: number[] = [];
  let shown = '';
  let i = 0;
  while (i < text.length) {
    const close = text[i] === '(' ? text.indexOf(')', i) : -1;
    if (close < 0) {
      // Two spaces where a cue stood become one, and none is left at the start.
      if (!(text[i] === ' ' && (shown === '' || shown.endsWith(' ')))) {
        shown += text[i];
        keep.push(i);
      }
      i++;
      continue;
    }
    cues.push(text.slice(i + 1, close).trim());
    i = close + 1;
  }
  while (shown.endsWith(' ')) { shown = shown.slice(0, -1); keep.pop(); }
  return { shown, cues, keep };
}
