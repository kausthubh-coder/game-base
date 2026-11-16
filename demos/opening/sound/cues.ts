// Where the voice and the recorded sounds go in the film, and how the music and the effects step back under
// each line. Data only, worked out from the film, so the soundtrack and the checks read the same plan.
import type { Film, ShotId } from '../types.ts';

export type Group = 'voice' | 'score' | 'fx';

/** One recorded sound placed on the film. */
export interface Cue {
  group: 'voice' | 'fx';
  /** A file: `voice/<shot>` for a line, else the effect's id in recorded.ts. */
  sound: string;
  /** Film seconds it starts. */
  at: number;
  /** Film seconds it is gone by. A bed loops until then. */
  end: number;
  gain: number;
  loop?: boolean;
  /** Seconds to come in and to go out. */
  fadeIn?: number;
  fadeOut?: number;
  /** A long sound joins part-way when the film is seeked into it. A short one-shot already past is skipped. */
  rejoin: boolean;
  /** Share sent to the hall. */
  wet?: number;
  name?: string;
}

/** A gain over film time, as points joined by straight lines. */
export type Curve = readonly (readonly [t: number, v: number])[];

/** How far the music and the effects step back while Hobb speaks: about 8 dB and 4 dB. */
export const DUCK = { score: 0.4, fx: 0.62 } as const;

export interface Plan {
  cues: Cue[];
  duck: { score: Curve; fx: Curve };
  /** Film seconds each line is heard, by shot. */
  lines: Partial<Record<ShotId, readonly [from: number, to: number]>>;
}

/** `hit` is each one-shot's loudest moment in its file (fx/fx.json), so the hit lands on the beat. */
export function planOf(film: Film, voiceSeconds: Partial<Record<ShotId, number>>, fileSeconds: Partial<Record<ShotId, number>>, hit: Record<string, number>): Plan {
  const s = (id: ShotId) => film.shot(id);
  const beat = (id: ShotId, name: string) => s(id).at + (s(id).beats[name] as number);
  const end = (id: ShotId) => s(id).at + s(id).len;
  const cues: Cue[] = [];
  const lines: Plan['lines'] = {};

  // Hobb. The legend is told with a little of the hall about it; the last three lines are close and dry.
  for (const shot of film.shots) {
    const seconds = voiceSeconds[shot.id];
    if (!seconds) continue;
    const at = shot.at + film.lead;
    lines[shot.id] = [at, at + seconds];
    cues.push({ group: 'voice', sound: `voice/${shot.id}`, at, end: at + (fileSeconds[shot.id] ?? seconds), gain: shot.part === 1 ? 1.1 : 1, rejoin: true, wet: shot.part === 1 ? 0 : 0.14 });
  }

  const shot = (sound: string, at: number, gain: number, name?: string): Cue => ({ group: 'fx', sound, at: at - (hit[sound] ?? 0), end: at - (hit[sound] ?? 0) + 30, gain, rejoin: false, name });
  const bed = (sound: string, at: number, until: number, gain: number, fadeIn: number, fadeOut: number): Cue => ({ group: 'fx', sound, at, end: until, gain, loop: true, fadeIn, fadeOut, rejoin: true });

  // The dark room is under the whole legend, very low, as if the story were told in it; it comes up for the wall.
  cues.push(bed('candle-room', 0, s('wall').at + 0.4, 0.28, 2, 0.6));
  cues.push(bed('candle-room', s('wall').at - 0.4, s('doorstep').at + 0.5, 1, 0.8, 0.9));
  cues.push(shot('paint', s('war').at + 0.1 + (hit.paint ?? 0), 0.55));
  cues.push(bed('breath', s('gods').at - 0.3, end('gods') + 0.6, 0.85, 1.2, 1.2));
  cues.push(shot('chain', beat('gods', 'bands'), 0.6));
  cues.push(shot('creak', beat('wall', 'hobb'), 0.7));
  // Sixteen years ago: rain, far thunder on its beat, someone walking away.
  cues.push(bed('rain', s('doorstep').at - 0.25, s('morning').at + 1.6, 1, 0.5, 1.6));
  cues.push(shot('thunder', beat('doorstep', 'thunder'), 0.8, 'thunder'));
  const steps = shot('steps-away', s('doorstep').at + s('doorstep').len * 0.3 + (hit['steps-away'] ?? 0), 0.75);
  cues.push({ ...steps, rejoin: true, end: s('morning').at + 0.8, fadeOut: 0.8 });
  // Sixteen years on: the street in the morning.
  cues.push(bed('morning', s('morning').at - 0.2, film.length, 1, 1.6, 2.4));

  // The music and the effects step back under each line, from just before it to just after.
  const score: [number, number][] = [[0, 1]];
  const fx: [number, number][] = [[0, 1]];
  for (const [from, to] of Object.values(lines) as [number, number][]) {
    score.push([from - 0.3, 1], [from - 0.05, DUCK.score], [to + 0.1, DUCK.score], [to + 0.6, 1]);
    fx.push([from - 0.3, 1], [from - 0.05, DUCK.fx], [to + 0.1, DUCK.fx], [to + 0.6, 1]);
  }
  return { cues: cues.sort((a, b) => a.at - b.at), duck: { score, fx }, lines };
}
