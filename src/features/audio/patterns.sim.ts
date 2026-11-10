// Turns a palette and a bar number into notes. Nothing here makes sound: it returns plain lists that the
// engine schedules. The same palette, bar and mode always give the same notes, so the music can be tested.
//
// A bar has 48 ticks (12 a beat). The melody is planned eight bars at a time, in four two-bar cells: the
// world motif, an answer, a variation and a cadence. Every palette shares that form, so two lands playing
// together in a border band state the tune and fall silent at the same moments.
import { bossBrass, stingerBell, tensionPad } from '../../content/palettes/instruments.ts';
import { bossMotif, worldMotif } from '../../content/palettes/motif.ts';
import type { Chord, DrumId, Palette, Patch } from '../../content/palettes/types.ts';
import type { PaletteLayer } from './blend.sim.ts';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from './conductor.sim.ts';
import { mulberry32, pick, seedOf, type Rng } from './rng.sim.ts';

export type NoteLayer = PaletteLayer | 'tension' | 'boss' | 'stinger';

export interface NoteEvent {
  layer: NoteLayer;
  /** Ticks from the start of the bar. It can be a fraction. */
  tick: number;
  /** How long the note is held, in ticks. */
  ticks: number;
  midi: number;
  /** 0 to 1. */
  vel: number;
  patch: Patch;
  /** Semitones below the note that it slides in from. */
  bend?: number;
}

export interface DrumEvent {
  layer: 'perc' | 'drums' | 'tension' | 'boss';
  tick: number;
  drum: DrumId;
  vel: number;
  /** The pitch of a tuned drum. */
  midi?: number;
}

export interface BarPlan {
  notes: NoteEvent[];
  drums: DrumEvent[];
}

/** What the music is doing, fixed on a beat. `resolve` is the one bar that closes a fight. */
export interface Mode {
  fight: boolean;
  night: boolean;
  town: boolean;
  rain: boolean;
  resolve: boolean;
}

export const PHRASE_BARS = 8;

/** A scale degree as semitones above the root. Degrees past the end of the scale run into the next octave. */
export function degreeSemis(scale: readonly number[], degree: number): number {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  return (scale[degree - octave * n] as number) + 12 * octave;
}

/** Steps up a chord: its tones, then the same tones an octave higher, and so on. */
export function ladderSemis(tones: readonly number[], index: number): number {
  const n = tones.length;
  const octave = Math.floor(index / n);
  return (tones[index - octave * n] as number) + 12 * octave;
}

/** Keeps chord roots within a fourth below and a tritone above home, so parts do not leap an octave. */
function near(root: number): number {
  return root > 6 ? root - 12 : root;
}

export function chordFor(p: Palette, bar: number, resolve: boolean): Chord {
  return (resolve ? p.chords[0] : p.chords[bar % p.chords.length]) as Chord;
}

function rotate(patch: Patch | Patch[], turn: number): Patch {
  return Array.isArray(patch) ? (patch[turn % patch.length] as Patch) : patch;
}

function snapTick(tick: number, grid: number): number {
  const step = TICKS_PER_BEAT / grid;
  return Math.round(tick / step) * step;
}

// ---------------------------------------------------------------------------------------------------
// Melody

interface Tone {
  /** Beats from the start of the two-bar cell. */
  beat: number;
  beats: number;
  degree: number;
  vel: number;
}

type CellKind = 'motif' | 'answer' | 'vary' | 'seq' | 'cadence' | 'rest' | 'echo' | 'drive';

const tones = (degrees: number[], beats: number[], lengths: number[], vel: number): Tone[] =>
  degrees.map((degree, i) => ({ degree, beat: beats[i] as number, beats: lengths[i] as number, vel: i === 0 ? Math.min(1, vel + 0.08) : vel }));

function cellTones(kind: CellKind, rng: Rng): Tone[] {
  const m = worldMotif;
  switch (kind) {
    case 'motif':
      return tones(m.degrees, m.beats, m.lengths, 0.82);
    case 'echo':
      return tones([0, 2, 4], [0, 1, 2], [1, 1, 3], 0.6);
    case 'answer':
      return pick(rng, [
        tones([4, 3, 2, 3, 1, 0], [0, 1, 2, 3, 4, 5], [1, 1, 1, 1, 1, 2.6], 0.76),
        tones([2, 1, 0, 1, 2], [0, 1.5, 2, 3, 4], [1.5, 0.5, 1, 1, 3.4], 0.76),
        tones([4, 5, 4, 2, 1, 2], [0, 0.5, 1, 2, 3, 4], [0.5, 0.5, 1, 1, 1, 3], 0.76),
      ]);
    case 'vary':
      return pick(rng, [
        // A passing note fills the first leap.
        tones([0, 1, 2, 4, 3, 2, 1, 0], [0, 0.5, 1, 2, 3.5, 4, 5, 6], [0.5, 0.5, 1, 1.5, 0.5, 1, 1, 2], 0.8),
        // The opening a third higher, then home the same way.
        tones([2, 4, 6, 5, 4, 1, 0], m.beats, m.lengths, 0.82),
        // A turn at the top.
        tones([0, 2, 4, 5, 4, 3, 2, 1, 0], [0, 1, 2, 2.5, 3, 3.5, 4, 5, 6], [1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1, 2], 0.8),
      ]);
    case 'seq':
      return tones([0, 2, 4, 1, 3, 5], [0, 1, 2, 4, 5, 6], [1, 1, 2, 1, 1, 2], 0.78);
    case 'cadence':
      return pick(rng, [
        tones([2, 1, 0], [0, 1, 2], [1, 1, 4], 0.74),
        tones([1, 0], [0, 2], [2, 4], 0.72),
        tones([0, 1, 2], [0, 1, 2], [1, 1, 3.5], 0.72),
        tones([4, 2, 1, 0], [0, 1.5, 2, 3], [1.5, 0.5, 1, 3.5], 0.76),
      ]);
    case 'drive': {
      // The motif at double speed, then a run or a held note. This is the lead in a fight.
      const fast = tones(m.degrees, m.beats.map((b) => b / 2), m.lengths.map((l) => l / 2), 0.95);
      const tail = pick(rng, [
        tones([2, 4, 6, 5, 4, 2, 1], m.beats.map((b) => 4 + b / 2), m.lengths.map((l) => l / 2), 0.95),
        tones([4, 3, 2, 3, 4, 5, 4, 2], [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.9),
        tones([4, 2, 1, 0], [4, 6, 6.5, 7], [2, 0.5, 0.5, 1], 0.95),
      ]);
      return fast.concat(tail);
    }
    case 'rest':
      return [];
  }
}

function phraseCells(p: Palette, phrase: number, mode: Mode): CellKind[] {
  if (mode.fight) return ['drive', 'drive', 'drive', 'drive'];
  // The form is seeded by the phrase alone: every palette picks the same one.
  const form = mulberry32(seedOf('form', phrase))();
  const cells: CellKind[] =
    phrase === 0 || form < 0.4 ? ['motif', 'answer', 'vary', 'cadence']
    : form < 0.65 ? ['motif', 'rest', 'seq', 'cadence']
    : form < 0.85 ? ['rest', 'motif', 'answer', 'cadence']
    : ['echo', 'rest', 'echo', 'cadence'];
  const taste = mulberry32(seedOf(p.id, 'rests', phrase));
  for (let i = 0; i < cells.length; i++) {
    const roll = taste();
    const kind = cells[i] as CellKind;
    const chance = kind === 'motif' || kind === 'cadence' ? (mode.night ? 0.25 : 0) : p.melody.rest * (mode.night ? 2.2 : 1);
    if (roll < chance) cells[i] = 'rest';
  }
  return cells;
}

function buildPhrase(p: Palette, phrase: number, mode: Mode): NoteEvent[] {
  const out: NoteEvent[] = [];
  const cells = phraseCells(p, phrase, mode);
  const base = p.root + 12 * p.melody.octave;
  const doubling = rotate(p.harmony.patch, 0);
  for (let c = 0; c < cells.length; c++) {
    const rng = mulberry32(seedOf(p.id, 'cell', phrase, c));
    const kind = cells[c] as CellKind;
    const patch = mode.night ? p.melody.night : rotate(p.melody.patch, phrase * 4 + c);
    const start = c * 2 * TICKS_PER_BAR;
    const list = cellTones(kind, rng);
    for (const tone of list) {
      const tick = start + snapTick(tone.beat * TICKS_PER_BEAT, p.grid);
      let ticks = Math.max(2, tone.beats * TICKS_PER_BEAT * 0.92);
      let degree = tone.degree;
      const roll = rng();
      // A long note leans on the chord under it.
      if (ticks >= 2 * TICKS_PER_BEAT) {
        const chord = chordFor(p, phrase * PHRASE_BARS + Math.floor(tick / TICKS_PER_BAR), false);
        degree = settle(p, chord, degree);
      }
      const vel = tone.vel * (mode.night ? 0.85 : 1);
      const midi = base + degreeSemis(p.scale, degree);
      const note: NoteEvent = { layer: 'melody', tick, ticks, midi, vel, patch };
      const ornament = mode.fight ? 'none' : p.melody.ornament;
      if (ornament === 'bend' && ticks >= 9 && roll < 0.65) {
        note.bend = degreeSemis(p.scale, degree) - degreeSemis(p.scale, degree - 1);
      } else if (ornament === 'grace' && ticks >= TICKS_PER_BEAT && tick >= 2 && roll < 0.3) {
        out.push({ layer: 'melody', tick: tick - 1.5, ticks: 1.5, midi: base + degreeSemis(p.scale, degree + 1), vel: vel * 0.6, patch });
      } else if (ornament === 'trill' && ticks >= 1.5 * TICKS_PER_BEAT && roll < 0.5) {
        out.push({ layer: 'melody', tick, ticks: 2.8, midi, vel, patch });
        out.push({ layer: 'melody', tick: tick + 3, ticks: 2.8, midi: base + degreeSemis(p.scale, degree + 1), vel: vel * 0.8, patch });
        note.tick = tick + 6;
        ticks -= 6;
        note.ticks = ticks;
        note.vel = vel * 0.9;
      }
      out.push(note);
      // The town arrangement: a second voice two scale steps under the long notes.
      if (mode.town && !mode.fight && ticks >= TICKS_PER_BEAT) {
        out.push({ layer: 'full', tick: note.tick, ticks, midi: base + degreeSemis(p.scale, degree - 2), vel: vel * 0.5, patch });
      }
      // A fight lifts the melody: the harmony instrument doubles it an octave above.
      if (mode.fight && midi + 12 <= 96) {
        out.push({ layer: 'melody', tick: note.tick, ticks: Math.min(ticks, 6), midi: midi + 12, vel: vel * 0.5, patch: doubling });
      }
    }
  }
  return out;
}

/** Moves a degree one step if that lands it on a chord tone. */
function settle(p: Palette, chord: Chord, degree: number): number {
  const inChord = (d: number): boolean => {
    const pc = (((degreeSemis(p.scale, d) - chord.root) % 12) + 12) % 12;
    return chord.tones.some((t) => t % 12 === pc);
  };
  if (inChord(degree)) return degree;
  if (inChord(degree - 1)) return degree - 1;
  if (inChord(degree + 1)) return degree + 1;
  return degree;
}

// ---------------------------------------------------------------------------------------------------
// The other layers

function drones(p: Palette, bar: number, chord: Chord, out: NoteEvent[]): void {
  for (const d of p.drone) {
    const at = bar % d.bars;
    for (const n of d.notes) {
      if (Math.floor(n.beat / 4) !== at) continue;
      out.push({
        layer: 'drone',
        tick: (n.beat - at * 4) * TICKS_PER_BEAT,
        ticks: n.beats * TICKS_PER_BEAT,
        midi: p.root + 12 * d.octave + n.semi + (d.follow ? near(chord.root) : 0),
        vel: (n.vel ?? 1) * d.gain,
        patch: d.patch,
      });
    }
  }
}

function bass(p: Palette, bar: number, chord: Chord, next: Chord, mode: Mode, out: NoteEvent[]): void {
  const b = p.bass;
  if (!b) return;
  const base = p.root + 12 * b.octave + near(chord.root);
  if (mode.resolve) {
    out.push({ layer: 'bass', tick: 0, ticks: 44, midi: base, vel: 0.9 * b.gain, patch: b.patch });
    return;
  }
  const rhythm = mode.fight ? b.fight : (b.rhythms[bar % b.rhythms.length] as string);
  const step = TICKS_PER_BAR / rhythm.length;
  for (let i = 0; i < rhythm.length; i++) {
    const ch = rhythm[i];
    if (ch === '.') continue;
    let length = 1;
    while (i + length < rhythm.length && rhythm[i + length] === '.') length++;
    const semi = ch === '5' ? 7 : ch === '8' ? 12 : ch === 'a' ? near(next.root) - near(chord.root) - 2 : 0;
    out.push({
      layer: 'bass',
      tick: i * step,
      ticks: Math.min(length * step, 2 * TICKS_PER_BEAT) * 0.9,
      midi: base + semi,
      vel: (i === 0 ? 0.95 : 0.8) * b.gain * (mode.fight ? 0.9 : 1),
      patch: b.patch,
    });
  }
}

function harmony(p: Palette, bar: number, chord: Chord, mode: Mode, out: NoteEvent[]): void {
  const h = p.harmony;
  const patch = rotate(h.patch, bar >> 1);
  const base = p.root + 12 * h.octave + near(chord.root);
  if (mode.resolve) {
    // One rolled chord, bottom to top, and then it rings.
    for (let i = 0; i < 5; i++) out.push({ layer: 'harmony', tick: i * 1.5, ticks: 30, midi: base + ladderSemis(chord.tones, i), vel: (0.85 - i * 0.06) * h.gain, patch });
    return;
  }
  const rhythm = mode.fight && h.fight ? h.fight : (h.rhythms[bar % h.rhythms.length] as string);
  const shape = h.shapes[(bar >> 1) % h.shapes.length] as number[];
  const step = TICKS_PER_BAR / rhythm.length;
  let hit = 0;
  for (let i = 0; i < rhythm.length; i++) {
    const ch = rhythm[i];
    if (ch === '.') continue;
    const onBeat = (i * step) % TICKS_PER_BEAT === 0;
    const vel = (ch === 'X' ? 0.9 : onBeat ? 0.72 : 0.6) * h.gain;
    const index = shape[hit % shape.length] as number;
    hit++;
    if (h.style === 'strum') {
      for (let k = 0; k < 3; k++) out.push({ layer: 'harmony', tick: i * step + k * 0.8, ticks: 2 * step, midi: base + ladderSemis(chord.tones, index + k), vel: vel * (1 - k * 0.12), patch });
    } else {
      out.push({ layer: 'harmony', tick: i * step, ticks: 2 * step, midi: base + ladderSemis(chord.tones, index), vel, patch });
    }
  }
  // The town arrangement: the chord again an octave up, on one and three.
  if (mode.town && !mode.fight) {
    for (const beat of [0, 2]) {
      for (let k = 0; k < 2; k++) {
        out.push({ layer: 'full', tick: beat * TICKS_PER_BEAT + k, ticks: TICKS_PER_BEAT, midi: base + 12 + ladderSemis(chord.tones, k + 1), vel: 0.45 * h.gain, patch });
      }
    }
  }
}

function percussion(p: Palette, bar: number, mode: Mode, out: DrumEvent[]): void {
  if (mode.resolve) return;
  const rng = mulberry32(seedOf(p.id, 'perc', bar));
  for (const line of p.perc) {
    if (line.when === 'rain' && !mode.rain) continue;
    if (line.when === 'town' && !mode.town) continue;
    const steps = line.steps[bar % line.steps.length] as string;
    const step = TICKS_PER_BAR / steps.length;
    for (let i = 0; i < steps.length; i++) {
      const ch = steps[i];
      if (ch === '.') continue;
      const ghost = rng();
      if (ch === 'o' && ghost < 0.5) continue;
      const vel = (ch === 'X' ? 1 : ch === 'x' ? 0.7 : 0.45) * line.gain * (mode.fight ? 1.15 : 1);
      out.push({ layer: 'perc', tick: i * step, drum: line.drum, vel, midi: p.root + 12 });
    }
  }
}

function sparkle(p: Palette, bar: number, chord: Chord, mode: Mode, out: NoteEvent[]): void {
  const s = p.sparkle;
  const rng = mulberry32(seedOf(p.id, 'sparkle', bar));
  const steps = p.grid * 4;
  const step = TICKS_PER_BAR / steps;
  const chance = s.chance * (mode.town ? 1.8 : 1) * (mode.night ? 0.7 : 1) * (mode.fight ? 0.5 : 1);
  const pool = chord.tones.map((t) => near(chord.root) + (t % 12)).concat(p.color ?? []);
  let count = 0;
  for (let i = 0; i < steps && count < 3; i++) {
    const roll = rng();
    const tone = pick(rng, pool);
    const vel = 0.4 + rng() * 0.3;
    if (roll >= chance) continue;
    count++;
    out.push({ layer: 'sparkle', tick: i * step, ticks: 6, midi: p.root + 12 * s.octave + tone, vel: vel * s.gain, patch: s.patch });
  }
}

/** Everything one palette plays in one bar. */
function planBar(p: Palette, bar: number, mode: Mode, phrase: NoteEvent[]): BarPlan {
  const notes: NoteEvent[] = [];
  const drums: DrumEvent[] = [];
  const chord = chordFor(p, bar, mode.resolve);
  const next = chordFor(p, bar + 1, false);
  drones(p, bar, chord, notes);
  bass(p, bar, chord, next, mode, notes);
  harmony(p, bar, chord, mode, notes);
  if (mode.resolve) {
    // The fight is over: step down to the home note and hold it.
    const base = p.root + 12 * p.melody.octave;
    const patch = mode.night ? p.melody.night : rotate(p.melody.patch, 0);
    const steps: [number, number, number][] = [[2, 0, 11], [1, 12, 11], [0, 24, 23]];
    for (const [degree, tick, ticks] of steps) {
      notes.push({ layer: 'melody', tick, ticks, midi: base + degreeSemis(p.scale, degree), vel: 0.8 * p.melody.gain, patch });
    }
  } else {
    const from = (bar % PHRASE_BARS) * TICKS_PER_BAR;
    for (const n of phrase) {
      if (n.tick < from || n.tick >= from + TICKS_PER_BAR) continue;
      notes.push({ ...n, tick: n.tick - from, vel: n.vel * p.melody.gain });
    }
  }
  percussion(p, bar, mode, drums);
  sparkle(p, bar, chord, mode, notes);
  return { notes, drums };
}

export interface Composer {
  /** The notes one palette plays in one bar. Pitches are the palette's own: the engine snaps them to the shared notes. */
  plan(p: Palette, bar: number, mode: Mode): BarPlan;
}

const modeKey = (m: Mode): number => (m.fight ? 1 : 0) | (m.night ? 2 : 0) | (m.town ? 4 : 0) | (m.rain ? 8 : 0) | (m.resolve ? 16 : 0);

/** Keeps the bars and phrases it has planned, so asking for the same bar on every beat costs nothing. */
export function createComposer(): Composer {
  const phrases = new Map<string, NoteEvent[]>();
  const bars = new Map<string, BarPlan>();
  return {
    plan(p, bar, mode) {
      const key = `${p.id}:${bar}:${modeKey(mode)}`;
      const known = bars.get(key);
      if (known) return known;
      const phrase = Math.floor(bar / PHRASE_BARS);
      const phraseKey = `${p.id}:${phrase}:${modeKey(mode) & 7}`;
      let notes = phrases.get(phraseKey);
      if (!notes) {
        if (phrases.size > 48) phrases.clear();
        notes = buildPhrase(p, phrase, mode);
        phrases.set(phraseKey, notes);
      }
      if (bars.size > 96) bars.clear();
      const plan = planBar(p, bar, mode, notes);
      bars.set(key, plan);
      return plan;
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// Laid over every land

const FIGHT_KIT: Record<3 | 4, { drum: DrumId; steps: string[]; gain: number }[]> = {
  4: [
    { drum: 'kick', gain: 0.9, steps: ['X.....x.X..x....', 'X.....x.X..x..x.'] },
    { drum: 'snare', gain: 0.6, steps: ['....X.......X...', '....X.......X..x'] },
    { drum: 'hat', gain: 0.3, steps: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.xx'] },
    { drum: 'tom', gain: 0.6, steps: ['................', '................', '................', '..........x.xxxx'] },
  ],
  3: [
    { drum: 'kick', gain: 0.9, steps: ['X.....X..x..', 'X.....X..x.x'] },
    { drum: 'snare', gain: 0.6, steps: ['...X.....X..'] },
    { drum: 'hat', gain: 0.3, steps: ['x.xx.xx.xx.x'] },
    { drum: 'tom', gain: 0.6, steps: ['............', '............', '............', '.........xxx'] },
  ],
};

/** The fight kit. It plays on the grid of the heaviest land. The resolve bar is one last hit and a cymbal. */
export function planFightDrums(grid: 3 | 4, bar: number, resolve: boolean): DrumEvent[] {
  if (resolve) return [{ layer: 'drums', tick: 0, drum: 'kick', vel: 0.9 }, { layer: 'drums', tick: 0, drum: 'swell', vel: 0.5 }];
  const out: DrumEvent[] = [];
  for (const line of FIGHT_KIT[grid]) {
    const steps = line.steps[bar % line.steps.length] as string;
    const step = TICKS_PER_BAR / steps.length;
    for (let i = 0; i < steps.length; i++) {
      const ch = steps[i];
      if (ch === '.') continue;
      out.push({ layer: 'drums', tick: i * step, drum: line.drum, vel: (ch === 'X' ? 1 : 0.7) * line.gain, midi: 45 - (i % 4) * 2 });
    }
  }
  return out;
}

/** Danger: a heartbeat and a low held fifth under whatever is playing. */
export function planTension(root: number, bar: number): BarPlan {
  const low = root - 24 + (root - 24 < 33 ? 12 : 0);
  const notes: NoteEvent[] = [];
  if (bar % 2 === 0) {
    notes.push({ layer: 'tension', tick: 0, ticks: 100, midi: low, vel: 0.7, patch: tensionPad });
    notes.push({ layer: 'tension', tick: 0, ticks: 100, midi: low + 7, vel: 0.45, patch: tensionPad });
  }
  const drums: DrumEvent[] = [];
  for (const beat of [0, 2]) {
    drums.push({ layer: 'tension', tick: beat * TICKS_PER_BEAT, drum: 'pulse', vel: 0.9 });
    drums.push({ layer: 'tension', tick: beat * TICKS_PER_BEAT + 4, drum: 'pulse', vel: 0.55 });
  }
  return { notes, drums };
}

/** The boss's own motif, in low brass octaves with a drum under each note. It fills two bars. */
export function planBoss(root: number, bar: number): BarPlan {
  const notes: NoteEvent[] = [];
  const drums: DrumEvent[] = [];
  const half = bar % 2;
  const low = root - 12 + (root - 12 < 40 ? 12 : 0);
  for (let i = 0; i < bossMotif.semis.length; i++) {
    const beat = bossMotif.beats[i] as number;
    if (Math.floor(beat / 4) !== half) continue;
    const tick = (beat - half * 4) * TICKS_PER_BEAT;
    const ticks = (bossMotif.lengths[i] as number) * TICKS_PER_BEAT * 0.9;
    const midi = low + (bossMotif.semis[i] as number);
    notes.push({ layer: 'boss', tick, ticks, midi, vel: 0.8, patch: bossBrass });
    notes.push({ layer: 'boss', tick, ticks, midi: midi - 12, vel: 0.6, patch: bossBrass });
    drums.push({ layer: 'boss', tick, drum: 'deep', vel: 0.7 });
  }
  return { notes, drums };
}

/** The quest stinger: up the palette's scale and a held top note, one bar long. The engine starts it on a bar line. */
export function planStinger(p: Palette, chord: Chord): NoteEvent[] {
  const base = p.root + 24;
  const n = p.scale.length;
  const out: NoteEvent[] = [];
  const degrees = [0, 2, 4, n];
  for (let i = 0; i < degrees.length; i++) {
    const last = i === degrees.length - 1;
    out.push({ layer: 'stinger', tick: i * 6, ticks: last ? 30 : 6, midi: base + degreeSemis(p.scale, degrees[i] as number), vel: last ? 0.9 : 0.75, patch: stingerBell });
  }
  out.push({ layer: 'stinger', tick: 18, ticks: 30, midi: p.root + 12 + near(chord.root), vel: 0.6, patch: stingerBell });
  out.push({ layer: 'stinger', tick: 18, ticks: 30, midi: p.root + 12 + near(chord.root) + 7, vel: 0.5, patch: stingerBell });
  return out;
}

/** A pickup plays a note of the chord. `combo` counts quick pickups in a row, and each one steps higher. */
export function pickupNote(p: Palette, chord: Chord, combo: number): number {
  // The chord's notes inside one octave, low to high, so each step really is higher than the last.
  const steps = [...new Set(chord.tones.map((t) => t % 12))].sort((a, b) => a - b);
  return p.root + 24 + near(chord.root) + ladderSemis(steps, Math.min(Math.max(combo, 0), 6));
}

/** The pitch of one spoken character: near the voice's own pitch, on a note of the scale. */
export function talkNote(p: Palette, pitch: number, char: string): number {
  const offset = ((char.charCodeAt(0) * 7 + 3) % 5) - 2;
  let best = 0;
  let bestGap = Infinity;
  for (let d = -3 * p.scale.length; d <= 4 * p.scale.length; d++) {
    const gap = Math.abs(p.root + degreeSemis(p.scale, d) - pitch);
    if (gap < bestGap) {
      bestGap = gap;
      best = d;
    }
  }
  return p.root + degreeSemis(p.scale, best + offset);
}
