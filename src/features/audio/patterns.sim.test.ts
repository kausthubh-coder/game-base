import { expect, test } from 'bun:test';
import { palettes, worldMotif } from '../../content/palettes/index.ts';
import type { Palette } from '../../content/palettes/types.ts';
import { pitchMask } from './blend.sim.ts';
import { TICKS_PER_BAR } from './conductor.sim.ts';
import {
  chordFor, createComposer, degreeSemis, pickupNote, planBoss, planFightDrums, planStinger, planTension, talkNote, type Mode, type NoteEvent,
} from './patterns.sim.ts';

const calm: Mode = { fight: false, night: false, town: false, rain: false, resolve: false };
const pc = (midi: number): number => ((midi % 12) + 12) % 12;
const inScale = (p: Palette, midi: number): boolean => p.scale.includes(pc(midi - p.root));
const byName = (id: string): Palette => palettes.find((p) => p.id === id) as Palette;
/** Every note a palette plays over some bars, with ticks counted from the first bar. */
function notes(p: Palette, mode: Mode, bars: number, layer?: NoteEvent['layer']): NoteEvent[] {
  const composer = createComposer();
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const n of composer.plan(p, bar, mode).notes) if (!layer || n.layer === layer) out.push({ ...n, tick: n.tick + bar * TICKS_PER_BAR });
  }
  return out;
}

test('there are seven palettes, named by land, in the brief order, and the town of Hollowmere after them', () => {
  expect(palettes.map((p) => p.id)).toEqual(['meadow', 'desert', 'coast', 'rainvalley', 'highlands', 'forge', 'center', 'town']);
  expect(palettes.map((p) => p.tempo)).toEqual([84, 96, 72, 100, 120, 80, 60, 92]);
});

test('every palette is well formed', () => {
  for (const p of palettes) {
    const steps = p.grid * 4;
    expect(p.root).toBeGreaterThanOrEqual(45);
    expect(p.root).toBeLessThanOrEqual(57);
    expect(p.scale[0]).toBe(0);
    expect(p.scale.every((s, i) => s < 12 && (i === 0 || s > (p.scale[i - 1] as number)))).toBe(true);
    expect(p.chords.length).toBeGreaterThan(0);
    for (const r of [...(p.bass?.rhythms ?? []), ...(p.bass ? [p.bass.fight] : []), ...p.harmony.rhythms, ...(p.harmony.fight ? [p.harmony.fight] : [])]) expect(r.length).toBe(steps);
    for (const line of p.perc) for (const s of line.steps) expect(s.length).toBe(steps);
  }
});

test('the world motif has five to seven notes and fills two bars', () => {
  expect(worldMotif.degrees.length).toBeGreaterThanOrEqual(5);
  expect(worldMotif.degrees.length).toBeLessThanOrEqual(7);
  const end = (worldMotif.beats.at(-1) as number) + (worldMotif.lengths.at(-1) as number);
  expect(end).toBeLessThanOrEqual(8);
});

test('every land opens with the world motif, in its own scale', () => {
  for (const p of palettes) {
    const played = notes(p, calm, 2, 'melody').map((n) => n.midi);
    const motif = worldMotif.degrees.map((d) => p.root + 12 * p.melody.octave + degreeSemis(p.scale, d));
    // Ornaments may add notes around the tune, but the tune is there in order.
    let at = 0;
    for (const midi of played) if (midi === motif[at]) at++;
    expect(at).toBe(motif.length);
  }
});

test('the same bar always holds the same notes', () => {
  for (const p of palettes) {
    const a = createComposer().plan(p, 37, calm);
    const b = createComposer().plan(p, 37, calm);
    expect(b).toEqual(a);
  }
});

test('the melody stays in the scale and the harmony stays in the chord', () => {
  for (const p of palettes) {
    for (const n of notes(p, calm, 32, 'melody')) expect(inScale(p, n.midi)).toBe(true);
    const composer = createComposer();
    for (let bar = 0; bar < 16; bar++) {
      const chord = chordFor(p, bar, false);
      const tones = chord.tones.map((t) => pc(p.root + chord.root + t));
      for (const n of composer.plan(p, bar, calm).notes) if (n.layer === 'harmony') expect(tones).toContain(pc(n.midi));
    }
  }
});

test('every note a palette plays is one of its own', () => {
  for (const p of palettes) {
    const mask = pitchMask(p);
    for (const n of notes(p, calm, 16)) {
      if (n.layer === 'bass') continue; // approach notes pass through, and the engine snaps them
      expect(mask & (1 << pc(n.midi))).not.toBe(0);
    }
  }
});

test('no bar is empty and nothing starts outside its bar', () => {
  for (const p of palettes) {
    const composer = createComposer();
    for (let bar = 0; bar < 32; bar++) {
      const plan = composer.plan(p, bar, calm);
      expect(plan.notes.length).toBeGreaterThan(0);
      for (const n of plan.notes) {
        expect(n.tick).toBeGreaterThanOrEqual(0);
        expect(n.tick).toBeLessThan(TICKS_PER_BAR);
        expect(n.vel).toBeGreaterThan(0);
      }
      for (const d of plan.drums) expect(d.tick).toBeLessThan(TICKS_PER_BAR);
    }
  }
});

test('a fight makes the lead and the bass busier and doubles the lead an octave up', () => {
  const p = byName('meadow');
  const fight = { ...calm, fight: true };
  expect(notes(p, fight, 8, 'melody').length).toBeGreaterThan(notes(p, calm, 8, 'melody').length * 1.5);
  expect(notes(p, fight, 8, 'bass').length).toBeGreaterThan(notes(p, calm, 8, 'bass').length * 1.5);
  const lead = notes(p, fight, 2, 'melody');
  const top = Math.max(...lead.map((n) => n.midi));
  const usual = Math.max(...notes(p, calm, 2, 'melody').map((n) => n.midi));
  expect(top).toBeGreaterThanOrEqual(usual + 7);
  expect(planFightDrums(4, 0, false).length).toBeGreaterThan(8);
  expect(planFightDrums(3, 0, false).length).toBeGreaterThan(8);
});

test('the bar that ends a fight steps down to the home note and holds it', () => {
  for (const p of palettes) {
    const plan = createComposer().plan(p, 21, { ...calm, resolve: true });
    const lead = plan.notes.filter((n) => n.layer === 'melody');
    const last = lead.at(-1) as NoteEvent;
    expect(pc(last.midi)).toBe(pc(p.root));
    expect(last.ticks).toBeGreaterThanOrEqual(12);
    expect(plan.drums.length).toBe(0);
  }
  expect(planFightDrums(4, 21, true).map((d) => d.drum)).toEqual(['kick', 'swell']);
});

test('night is thinner and has a different lead', () => {
  for (const p of palettes) {
    const day = notes(p, calm, 64, 'melody');
    const night = notes(p, { ...calm, night: true }, 64, 'melody');
    expect(night.length).toBeLessThan(day.length);
    expect(night.every((n) => n.patch === p.melody.night)).toBe(true);
    expect(day.some((n) => n.patch !== p.melody.night)).toBe(true);
  }
});

test('a town adds a second voice and more harmony', () => {
  const p = byName('highlands');
  expect(notes(p, calm, 8, 'full').length).toBe(0);
  expect(notes(p, { ...calm, town: true }, 8, 'full').length).toBeGreaterThan(16);
});

test('when it rains in the rain valley, more drums join', () => {
  const p = byName('rainvalley');
  const composer = createComposer();
  let dry = 0;
  let wet = 0;
  for (let bar = 0; bar < 8; bar++) {
    dry += composer.plan(p, bar, calm).drums.length;
    wet += composer.plan(p, bar, { ...calm, rain: true }).drums.length;
  }
  expect(wet).toBeGreaterThan(dry * 1.4);
});

test('quick pickups climb the chord', () => {
  for (const p of palettes) {
    const chord = chordFor(p, 0, false);
    let last = 0;
    for (let combo = 0; combo < 6; combo++) {
      const midi = pickupNote(p, chord, combo);
      expect(midi).toBeGreaterThan(last);
      expect(chord.tones.map((t) => pc(p.root + chord.root + t))).toContain(pc(midi));
      last = midi;
    }
  }
});

test('speech blips sit on the scale, near the speaker’s own pitch', () => {
  for (const p of palettes) {
    for (const char of 'The quick brown fox') {
      const midi = talkNote(p, 62, char);
      expect(inScale(p, midi)).toBe(true);
      expect(Math.abs(midi - 62)).toBeLessThanOrEqual(8);
    }
  }
});

test('the stinger is one bar long and in key', () => {
  for (const p of palettes) {
    const stinger = planStinger(p, chordFor(p, 0, false));
    const mask = pitchMask(p);
    for (const n of stinger) {
      expect(n.tick + n.ticks).toBeLessThanOrEqual(TICKS_PER_BAR);
      expect(mask & (1 << pc(n.midi))).not.toBe(0);
    }
  }
});

test('danger and the boss lay their own parts over the land', () => {
  expect(planTension(50, 0).drums.length).toBe(4);
  expect(planTension(50, 0).notes.length).toBe(2);
  const boss = [...planBoss(50, 0).notes, ...planBoss(50, 1).notes];
  // The boss motif starts and ends on the land's home note.
  expect(pc(boss[0]?.midi ?? 0)).toBe(pc(50));
  expect(pc(boss.at(-1)?.midi ?? 0)).toBe(pc(50));
  expect(boss.length).toBe(14);
});
