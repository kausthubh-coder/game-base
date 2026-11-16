// The opening's music, as notes laid on the film. Nothing is at a fixed second: every note is placed by its
// shot's start and length or on a named beat, so the score follows the film whatever length a take makes it.
//
// It is in D, built on the valley's tune (the planning site's MOTIF: D F# A F# E C# D A). Handbook chapter 21:
// the hymn of the Dawn is that tune slowed on held voices, and the seven notes are a rising scale on glass with
// the seventh a rest. Here:
//   the legend   old, warm and small: held voices sing the tune slowly over a low drone, a far drum, a harp
//   his friends  the harp walks six notes, one a friend, and the seventh never comes (the scraped place)
//   the night    the biggest moment: lights rise on glass, the voices climb to a full D on `dome`, and under the
//                gold a low cluster a semitone wide beats slowly, which is the unease nobody names
//   the Mark     almost nothing: a thin high note, six glass notes on `light1` to `light6`, then silence
//   the room     close and quiet: a few low harp notes, and a two-note cadence after "Bed, Button."
//   the rain     low strings and the tune plucked slowly, a glint on `key`
//   the morning  the flute plays the tune through and resolves it to D on `title`, with the full chord
import type { Film, Shot, ShotId } from '../types.ts';
import type { Note } from './synth.ts';

// MIDI numbers.
const D2 = 38, A2 = 45, B1 = 35, Fs2 = 42, G2 = 43, E2 = 40, Cs2 = 37;
const D3 = 50, E3 = 52, Fs3 = 54, G3 = 55, A3 = 57, B3 = 59, C4 = 60, Cs3 = 49, B2 = 47, C3 = 48;
const D4 = 62, E4 = 64, Fs4 = 66, G4 = 67, A4 = 69, B4 = 71;
const D5 = 74, E5 = 76, Fs5 = 78, G5 = 79, A5 = 81, B5 = 83, Cs5 = 73;
const D6 = 86, E6 = 88, Fs6 = 90, G6 = 91, A6 = 93, B6 = 95;

/** The valley's tune. */
export const TUNE = [D5, Fs5, A5, Fs5, E5, Cs5, D5, A4] as const;
/** The seven notes on glass. The film sounds six; the seventh is the rest. */
export const SEVEN = [D6, E6, Fs6, G6, A6, B6] as const;

/** `voiceSeconds` places what answers a line, such as the cadence after "Bed, Button." */
export function scoreOf(film: Film, voiceSeconds: Partial<Record<ShotId, number>>): Note[] {
  const notes: Note[] = [];
  const s = (id: ShotId) => film.shot(id);
  /** Film seconds at a share of a shot. */
  const at = (shot: Shot, share: number) => shot.at + shot.len * share;
  const beat = (shot: Shot, name: string) => shot.at + (shot.beats[name] as number);
  const add = (n: Note) => notes.push(n);
  const chord = (inst: Note['inst'], from: number, to: number, midis: readonly number[], vel: number, name?: string) =>
    midis.forEach((midi, i) => add({ inst, at: from, len: Math.max(0.2, to - from), midi, vel, pan: (i / Math.max(1, midis.length - 1) - 0.5) * 0.5, name }));
  const pluck = (time: number, midi: number, vel: number, pan = 0, name?: string) => add({ inst: 'harp', at: time, len: 0, midi, vel, pan, name });
  const roll = (time: number, midis: readonly number[], vel: number, gap = 0.06) => midis.forEach((m, i) => pluck(time + i * gap, m, vel * (0.8 + 0.2 * (i / midis.length)), (i / midis.length - 0.5) * 0.6));
  const sing = (from: number, to: number, midi: number, vel: number) => add({ inst: 'choir', at: from, len: Math.max(0.3, to - from), midi, vel, pan: 0.1 });

  // ---- 1. The war: from nothing, a low drone, a soft D, the tune's first notes, a far drum that does not stop.
  const war = s('war'), king = s('king');
  add({ inst: 'strings', at: war.at, len: king.at + king.len * 0.5 - war.at, midi: D2, vel: 0.5 });
  add({ inst: 'strings', at: war.at + 0.8, len: king.at - war.at, midi: A2, vel: 0.32 });
  chord('choir', at(war, 0.08), war.at + war.len, [D3, Fs3, A3], 0.42);
  sing(at(war, 0.22), at(war, 0.6), D5, 0.36);
  sing(at(war, 0.6), king.at + 0.2, Fs5, 0.36);
  for (const [share, vel] of [[0.26, 0.32], [0.46, 0.26], [0.66, 0.36], [0.86, 0.24]] as const) add({ inst: 'drum', at: at(war, share), len: 0, midi: D2, vel, pan: -0.3 });
  // The wall has painted itself in: a quiet run up the harp.
  roll(beat(war, 'painted'), [D4, E4, Fs4, A4, B4, D5], 0.32, 0.07);

  // ---- 2. The farm boy: G, and on `crown` the chord comes home to D with a glint.
  chord('choir', king.at, beat(king, 'crown') + 0.3, [G2 + 12, B3, D4], 0.4);
  chord('choir', beat(king, 'crown'), king.at + king.len + 0.3, [D3, Fs3, A3, D4], 0.48);
  sing(king.at + 0.15, at(king, 0.35), A5, 0.36);
  sing(at(king, 0.35), beat(king, 'crown'), G5, 0.34);
  sing(beat(king, 'crown'), king.at + king.len + 0.4, Fs5, 0.4);
  roll(beat(king, 'crown'), [D4, A4, D5, Fs5], 0.36, 0.05);
  add({ inst: 'glass', at: beat(king, 'crown') + 0.02, len: 0, midi: A6, vel: 0.3, pan: 0.3 });
  add({ inst: 'drum', at: beat(king, 'crown'), len: 0, midi: D2, vel: 0.4 });

  // ---- 3. His friends: six harp notes, one a friend, and none on the scraped place. The chord goes bare there.
  const friends = s('friends');
  const scraped = beat(friends, 'scraped');
  add({ inst: 'strings', at: friends.at - 0.2, len: friends.len, midi: E2, vel: 0.4 });
  chord('choir', friends.at, scraped, [E3, G3, B3, D4], 0.34);
  const walk = [G4, A4, B4, D5, E5, Fs5];
  walk.forEach((m, i) => pluck(friends.at + 0.35 + ((scraped - friends.at - 0.35) * i) / walk.length, m, 0.5, -0.4 + i * 0.16));
  // The seventh, G5, would come on `scraped`. It does not. A bare fifth holds instead, thin and cool.
  chord('choir', scraped, friends.at + friends.len + 0.2, [E3, B3], 0.3);
  add({ inst: 'strings', at: scraped, len: friends.at + friends.len - scraped, midi: B2, vel: 0.22 });

  // ---- 4. Roads of light: D, then A, then D on `lit`; the harp climbs; glass as the last road reaches the city.
  const roads = s('roads');
  const lit = beat(roads, 'lit');
  add({ inst: 'strings', at: roads.at, len: roads.len, midi: D2, vel: 0.45 });
  chord('choir', roads.at, at(roads, 0.35), [D3, Fs3, A3], 0.42);
  chord('choir', at(roads, 0.35), lit, [Cs3, E3, A3], 0.42);
  chord('choir', lit, roads.at + roads.len + 0.3, [D3, Fs3, A3, D4], 0.5);
  sing(roads.at + 0.1, at(roads, 0.35), E5, 0.36);
  sing(at(roads, 0.35), lit, Cs5, 0.36);
  sing(lit, roads.at + roads.len + 0.3, D5, 0.42);
  const climb = [D4, Fs4, A4, D5, Fs4, A4, D5, E5, A4, Cs5, E5, A5];
  climb.forEach((m, i) => pluck(roads.at + 0.2 + ((lit - roads.at - 0.2) * i) / climb.length, m, 0.3 + 0.2 * (i / climb.length), Math.sin(i) * 0.4));
  [D6, Fs6, A6].forEach((m, i) => add({ inst: 'glass', at: lit + i * 0.09, len: 0, midi: m, vel: 0.28, pan: -0.3 + i * 0.3 }));

  // ---- 5. The sickness: B minor, darker, the tune falling; a far bell tolls twice, the second on `dim`.
  const sick = s('sickness');
  add({ inst: 'strings', at: sick.at, len: sick.len, midi: B1, vel: 0.5 });
  chord('choir', sick.at, at(sick, 0.5), [B2, D3, Fs3], 0.36);
  chord('choir', at(sick, 0.5), sick.at + sick.len + 0.2, [G2 + 12, B2, D3], 0.32);
  sing(sick.at + 0.1, at(sick, 0.3), D5, 0.3);
  sing(at(sick, 0.3), beat(sick, 'dim'), Cs5, 0.28);
  sing(beat(sick, 'dim'), sick.at + sick.len, B4, 0.26);
  add({ inst: 'bell', at: at(sick, 0.08), len: 0, midi: B2, vel: 0.5, pan: -0.4 });
  add({ inst: 'bell', at: beat(sick, 'dim'), len: 0, midi: B2, vel: 0.42, pan: -0.4 });

  // ---- 6. The night: the biggest moment. Lights rise from `rise`; the voices climb G, E minor, C to a full D on
  // `dome`, with air swelling into it and the drum on it. Under the gold, from `rise` through the gods, a low
  // cluster a semitone wide (C# against D) beats slowly.
  const night = s('night');
  const rise = beat(night, 'rise'), dome = beat(night, 'dome');
  const gods = s('gods');
  add({ inst: 'strings', at: night.at, len: dome - night.at, midi: G2, vel: 0.5 });
  add({ inst: 'strings', at: rise, len: gods.at + gods.len - 2.2 - rise, midi: Cs2, vel: 0.24 });
  add({ inst: 'strings', at: rise + 0.4, len: gods.at + gods.len - 2.2 - rise - 0.4, midi: D2, vel: 0.24 });
  const step = (dome - rise) / 3;
  chord('choir', night.at, rise + step, [G2 + 12, B3, D4], 0.38);
  chord('choir', rise + step, rise + 2 * step, [E3, G3, B3, E4], 0.5);
  chord('choir', rise + 2 * step, dome, [C3, E3, G3, C4], 0.58);
  sing(night.at + 0.2, rise + step, Fs5, 0.34);
  sing(rise + step, rise + 2 * step, G5, 0.38);
  sing(rise + 2 * step, dome, A5, 0.42);
  // The lights rising: glass sparkles climbing the D scale, faster as they go.
  const lights = [D5, Fs5, A5, B5, D6, E6, Fs6, A6, B6, D6 + 12, A5, D6, Fs6, A6, D6 + 12, Fs6 + 12];
  lights.forEach((m, i) => add({ inst: 'glass', at: rise + (dome - rise - 0.2) * (1 - (1 - i / lights.length) ** 1.4), len: 0, midi: m, vel: 0.12 + 0.1 * (i / lights.length), pan: Math.sin(i * 2.3) * 0.7, wet: 0.7 }));
  for (const share of [0.35, 0.52, 0.64, 0.73]) add({ inst: 'drum', at: at(night, share), len: 0, midi: D2, vel: 0.3 + share * 0.3 });
  add({ inst: 'swell', at: dome - 1.8, len: 1.8, midi: D4, vel: 0.5 });
  // The dome closes: the full chord.
  chord('choir', dome, gods.at + gods.len * 0.3, [D2 + 12, A2 + 12, D3 + 12, Fs4, A4, D5], 0.75);
  add({ inst: 'strings', at: dome, len: gods.at + gods.len - 2.2 - dome, midi: D2, vel: 0.6 });
  sing(dome, gods.at + gods.len * 0.25, A5, 0.6);
  add({ inst: 'drum', at: dome, len: 0, midi: D2, vel: 1 });
  roll(dome, [D3, A3, D4, Fs4, A4, D5, Fs5, A5], 0.6, 0.04);
  [D6, A6].forEach((m, i) => add({ inst: 'glass', at: dome + i * 0.03, len: 0, midi: m, vel: 0.3, pan: i ? 0.3 : -0.3 }));

  // ---- 7. The old gods: the gold holds and fades; on `bands` a dark bell, metal under the chord.
  const bands = beat(gods, 'bands');
  chord('choir', at(gods, 0.45), gods.at + gods.len - 1.8, [D3, A3, D4], 0.3);
  add({ inst: 'bell', at: bands, len: 0, midi: D2, vel: 0.55, pan: 0.2 });
  sing(at(gods, 0.42), gods.at + gods.len - 1.8, E4 + 12, 0.24);

  // ---- 8. The Mark: almost nothing. A thin high A, then six glass notes on their beats. The seventh is silence:
  // the thin note is gone by then too.
  const mark = s('mark');
  const lightTimes = [1, 2, 3, 4, 5, 6].map((k) => beat(mark, `light${k}`));
  const seventh = (lightTimes[5] as number) + ((lightTimes[5] as number) - (lightTimes[4] as number));
  add({ inst: 'choir', at: mark.at, len: Math.max(0.5, seventh - 2.1 - mark.at), midi: A5, vel: 0.16, wet: 0.8 });
  SEVEN.forEach((m, i) => add({ inst: 'glass', at: lightTimes[i] as number, len: 0, midi: m, vel: 0.42, pan: -0.25 + i * 0.1, wet: 0.45, name: 'mark' }));

  // ---- 9. The wall: the dark room. Close and quiet: three low harp notes of the tune, a soft pad, and when
  // "Bed, Button." is said, a two-note cadence, A to D.
  const wall = s('wall');
  const lineEnd = (shot: Shot) => shot.at + film.lead + (voiceSeconds[shot.id] ?? shot.len - film.lead - 1.1);
  chord('strings', at(wall, 0.25), wall.at + wall.len, [D3 - 12, A2], 0.22);
  pluck(at(wall, 0.12), D4, 0.32, -0.2);
  pluck(at(wall, 0.28), Fs4, 0.3, -0.1);
  pluck(at(wall, 0.44), A4, 0.3, 0);
  pluck(lineEnd(wall) + 0.05, A3, 0.34, 0.1);
  pluck(lineEnd(wall) + 0.6, D4, 0.36, 0.1);

  // ---- 10. The doorstep: low strings in B minor, the tune plucked slowly in the rain, a glint on `key`.
  const door = s('doorstep');
  chord('strings', door.at, door.at + door.len, [B1, Fs2], 0.34);
  chord('choir', at(door, 0.2), door.at + door.len, [B2, D3, Fs3], 0.16);
  const plucked = TUNE.slice(0, 6);
  plucked.forEach((m, i) => pluck(door.at + 0.5 + ((door.len - 0.7) * i) / plucked.length, m - 12, 0.38, 0.15));
  add({ inst: 'glass', at: beat(door, 'key'), len: 0, midi: A6, vel: 0.24, pan: 0.35, wet: 0.6 });

  // ---- 11. The morning: the flute plays the tune through and lands on D with the title, the whole chord under it.
  const morning = s('morning');
  const title = beat(morning, 'title');
  chord('choir', morning.at, at(morning, 0.25), [D3, Fs3, A3], 0.3);
  chord('choir', at(morning, 0.25), title, [G2 + 12, B3, D4], 0.34);
  add({ inst: 'strings', at: morning.at, len: title - morning.at, midi: D2, vel: 0.36 });
  const phrase = [D5, Fs5, A5, Fs5, E5, Cs5];
  const gap = (title - morning.at - 0.4) / phrase.length;
  phrase.forEach((m, i) => add({ inst: 'flute', at: morning.at + 0.4 + i * gap, len: gap * 0.92, midi: m, vel: 0.5 }));
  for (let i = 0; i < 8; i++) pluck(morning.at + 0.4 + i * ((title - morning.at - 0.4) / 8), [D4, A4, Fs4, A4, G4, B4, A4, Cs5][i] as number, 0.26, Math.sin(i) * 0.5);
  // The title: D on the flute, the full chord, glass, the drum. It rings out by the end of the film.
  const ring = morning.at + morning.len - title;
  add({ inst: 'flute', at: title, len: Math.max(1, ring - 1.4), midi: D5, vel: 0.45, name: 'title' });
  chord('choir', title, title + Math.max(0.6, ring - 2.2), [D3, A3, D4, Fs4, A4], 0.36, 'title');
  add({ inst: 'strings', at: title, len: Math.max(0.5, ring - 2.4), midi: D2, vel: 0.38, name: 'title' });
  roll(title, [D3, A3, D4, Fs4, A4, D5], 0.36, 0.035);
  [D6, A6].forEach((m, i) => add({ inst: 'glass', at: title + i * 0.02, len: 0, midi: m, vel: 0.32, pan: i ? 0.3 : -0.3, name: 'title' }));
  add({ inst: 'drum', at: title, len: 0, midi: D2, vel: 0.4, name: 'title' });

  return notes.sort((a, b) => a.at - b.at);
}
