// Scripted scenes for the checks. Each one drives the engine in an offline render the way a player would,
// then hands back the sound as a WAV and a log of the conductor. tools/audio-check.mjs calls these by name
// through `window.__audioLab` and does the measuring.
import type { Surface } from '../../src/engine/types.ts';
import type { AudioState, AudioSystem, Element, LayerId, PetMood } from '../../src/features/audio/index.ts';
import { renderOffline, type OfflineScene } from '../../src/features/audio/render-offline.ts';
import { NPCS } from './cast.ts';
import { LANDS, pointAt, regionWeights } from './world.ts';

export interface LabSample {
  t: number;
  bar: number;
  beat: number;
  bpm: number;
  baseBpm: number;
  intensity: number;
  voices: number;
  nodes: number;
  lead: string;
  layers: string;
  notes: Record<string, number>;
  weights: Record<string, number>;
}

export interface LabResult {
  name: string;
  seconds: number;
  sampleRate: number;
  channels: number;
  /** A 16-bit WAV file, base64 encoded. */
  wav: string;
  log: LabSample[];
  marks: { t: number; label: string }[];
  /** Times that mean something to the scene: each footstep, each pickup. */
  events: { t: number; label: string }[];
  update: { mean: number; p95: number; max: number; calls: number };
  /** Wall-clock milliseconds the whole render took, the audio thread's work included. */
  renderMs: number;
  voicePeak: number;
  dropped: number;
  refused: Record<string, number>;
  fixedNodes: number;
}

type Scene = Pick<OfflineScene, 'seconds' | 'setup' | 'frame'> & { marks?: { t: number; label: string }[]; events?: { t: number; label: string }[]; decimate?: number; pause?: number[] };

const calm: AudioState = { regions: { meadow: 1 }, town: 0, indoors: 0, danger: 0, fight: 0, boss: 0, timeOfDay: 0.5, rain: 0, wind: 0.2, nearWater: 0, trees: 0.3, stone: 0 };
const SURFACES: Surface[] = ['grass', 'tallGrass', 'dirt', 'stone', 'wood', 'sand', 'water', 'snow', 'leaves', 'metal'];
const ELEMENTS: Element[] = ['bloom', 'flame', 'tide', 'spark', 'gale', 'stone'];
const MOODS: PetMood[] = ['happy', 'curious', 'sad', 'alert'];
const STEP = 0.05;
/** True on the step that holds the time `at`. Steps are counted, so rounding cannot skip an event. */
const hits = (index: number, at: number): boolean => Math.round(at / STEP) === index;
/** True once every `every` seconds, starting at `from`. */
const each = (t: number, every: number, from = 0): boolean => t >= from && Math.floor((t - from + 1e-6) / every) !== Math.floor((t - from - STEP + 1e-6) / every);
/** Steps in a minute. The soak scene repeats every minute. */
const MINUTE = Math.round(60 / STEP);

const musicOnly = (audio: AudioSystem): void => {
  audio.setVolume('ambience', 0);
};
const effectsOnly = (audio: AudioSystem): void => {
  audio.setVolume('ambience', 0);
  audio.setVolume('music', 0);
};

function walkWeights(bearing: number, radius: number): Record<string, number> {
  const p = pointAt(bearing, radius);
  const out: Record<string, number> = {};
  regionWeights(p.x, p.z, out);
  return out;
}

function talk(audio: AudioSystem, who: number, index: number): void {
  const npc = NPCS[who % NPCS.length];
  if (!npc) return;
  const line = npc.lines[0] ?? 'hello';
  audio.emit({ type: 'talk', voice: npc.voice, char: line[index % line.length] ?? 'a' });
}

const scenes: Record<string, (arg: string) => Scene> = {
  /** One land alone for a minute, music only. */
  solo: (land) => ({
    seconds: 60,
    setup: musicOnly,
    frame: (_t, audio) => audio.setState({ ...calm, regions: { [land]: 1 } }),
  }),

  /** One land with its whole sound world, for listening. */
  full: (land) => ({
    seconds: 40,
    frame: (t, audio) => audio.setState({ ...calm, regions: { [land]: 1 }, trees: 0.5, wind: 0.35, nearWater: land === 'coast' || land === 'rainvalley' ? 0.4 : 0, timeOfDay: t > 28 ? 0 : 0.5 }),
    marks: [{ t: 28, label: 'night' }],
  }),

  /** One layer of one land alone, to measure its level. `arg` is "land:layer:mood". */
  stem: (arg) => {
    const [land = 'meadow', layer = 'melody', mood = 'day'] = arg.split(':');
    return {
      seconds: 26,
      setup: (audio) => {
        musicOnly(audio);
        audio.soloLayer(layer as LayerId);
      },
      frame: (_t, audio) => audio.setState({ ...calm, regions: { [land]: 1 }, fight: mood === 'fight' ? 1 : 0, town: mood === 'town' ? 1 : 0, danger: mood === 'danger' ? 1 : 0, boss: mood === 'boss' ? 1 : 0 }),
    };
  },

  /** A 90 second walk from the meadow into the desert and back, along the demo map's own weights. */
  crossing: () => {
    // The border is at bearing 210 on the ring. At radius 300 the 60-unit band is 11.5 degrees wide.
    const bearingAt = (t: number): number => (t < 10 ? 195 : t < 40 ? 195 + (t - 10) : t < 50 ? 225 : t < 80 ? 225 - (t - 50) : 195);
    return {
      seconds: 90,
      setup: musicOnly,
      frame: (t, audio) => audio.setState({ ...calm, regions: walkWeights(bearingAt(t), 300) }),
      marks: [
        { t: 19.3, label: 'enters band' }, { t: 25, label: 'mid band' }, { t: 30.7, label: 'in desert' },
        { t: 59.3, label: 'enters band' }, { t: 65, label: 'mid band' }, { t: 70.7, label: 'in meadow' },
      ],
    };
  },

  /** A fight that starts at 20 s and ends at 50 s. */
  fight: () => ({
    seconds: 80,
    setup: musicOnly,
    frame: (t, audio) => audio.setState({ ...calm, fight: t >= 20 && t < 50 ? 1 : 0 }),
    marks: [{ t: 20, label: 'fight on' }, { t: 50, label: 'fight off' }],
  }),

  /** Two steps on every surface, with the music and ambience off. */
  footsteps: () => {
    const events = SURFACES.flatMap((surface, i) => [{ t: 0.5 + i, label: surface }, { t: 1.0 + i, label: surface }]);
    return {
      seconds: SURFACES.length + 1,
      setup: effectsOnly,
      events,
      frame: (_t, audio, i) => {
        audio.setState(calm);
        for (const e of events) if (hits(i, e.t)) audio.onEvent({ type: 'footstep', surface: e.label as Surface, at: { x: 0, y: 0, z: 0 } });
      },
    };
  },

  /** Everything at once: a boss fight in a town on a border, in a storm, with machines, talk and pickups. */
  stress: () => ({
    seconds: 45,
    frame: (t, audio, i) => {
      audio.setState({ regions: { meadow: 0.5, desert: 0.5 }, town: 1, indoors: 0, danger: 1, fight: 1, boss: 1, timeOfDay: 0.26, rain: 1, wind: 1, nearWater: 1, trees: 1 });
      audio.emit({ type: 'machine' });
      talk(audio, Math.floor(t / 3), i);
      if (i % 2 === 0) audio.emit({ type: 'pickup' });
      if (i % 4 === 0) audio.emit({ type: 'footstep', surface: SURFACES[(i / 4) % SURFACES.length] as Surface });
      if (i % 7 === 0) audio.emit({ type: 'hit' });
      if (i % 9 === 0) audio.emit({ type: i % 2 ? 'blockPlaced' : 'blockBroken', surface: 'stone' });
      if (i % 10 === 0) audio.emit({ type: 'spell', element: ELEMENTS[(i / 10) % ELEMENTS.length] as Element });
      if (i % 20 === 0) audio.emit({ type: 'pet', mood: MOODS[(i / 20) % MOODS.length] as PetMood });
      if (i % 100 === 50) audio.emit({ type: 'stinger' });
      if (i % 150 === 75) audio.emit({ type: 'thunder' });
    },
  }),

  /** Five minutes of ordinary play. Each minute is the same loop, so the first and the last can be compared. */
  soak: () => ({
    seconds: 300,
    decimate: 4,
    // The render stops at these times so the check can ask Chrome how many nodes are alive.
    pause: [51, 53, 55, 57, 59.9, 291, 293, 295, 297, 299.9],
    marks: [{ t: 60, label: 'one minute' }, { t: 299.9, label: 'five minutes' }],
    frame: (t, audio, i) => {
      const p = t % 60;
      const across = p < 10 ? 195 : p < 20 ? 195 + (p - 10) * 3 : p < 50 ? 225 : 225 - (p - 50) * 3;
      audio.setState({
        regions: p >= 40 && p < 50 ? { coast: 1 } : walkWeights(across, 300),
        town: p >= 32 && p < 40 ? 1 : 0,
        indoors: p >= 43 && p < 47 ? 1 : 0,
        danger: p >= 18 && p < 20 ? 1 : 0,
        fight: p >= 20 && p < 32 ? 1 : 0,
        boss: p >= 26 && p < 32 ? 1 : 0,
        timeOfDay: p >= 40 && p < 50 ? 0 : 0.5,
        rain: p >= 32 && p < 42 ? 0.8 : 0,
        wind: 0.3 + 0.3 * Math.sin(t / 7),
        nearWater: p >= 40 && p < 50 ? 0.7 : 0,
        trees: 0.5,
      });
      if (each(t, 0.35)) audio.emit({ type: 'footstep', surface: SURFACES[Math.floor(p / 6) % SURFACES.length] as Surface });
      if (p >= 3 && p < 4.5 && each(t, 0.3)) audio.emit({ type: 'pickup' });
      if (p >= 12 && p < 15) talk(audio, Math.floor(t / 60), i);
      if (p >= 20 && p < 32 && each(t, 0.5)) audio.emit({ type: 'hit' });
      if (p >= 22 && p < 32 && each(t, 1.7)) audio.emit({ type: 'spell', element: ELEMENTS[i % ELEMENTS.length] as Element });
      if (p >= 32 && p < 40 && each(t, 0.3)) audio.emit({ type: 'machine' });
      if (each(t, 7)) audio.emit({ type: 'pet', mood: MOODS[i % MOODS.length] as PetMood });
      const step = i % MINUTE;
      if (hits(step, 52)) audio.emit({ type: 'stinger' });
      if (hits(step, 55)) audio.emit({ type: 'jump' });
      if (hits(step, 55.45)) audio.emit({ type: 'land', surface: 'grass' });
      if (hits(step, 36)) audio.emit({ type: 'thunder' });
    },
  }),

  /** The meadow through its moods: day, town, night, rain, indoors, danger, a boss fight. */
  moods: () => ({
    seconds: 110,
    setup: musicOnly,
    frame: (t, audio) =>
      audio.setState({
        ...calm,
        town: t >= 15 && t < 30 ? 1 : 0,
        timeOfDay: t >= 30 && t < 50 ? 0 : 0.5,
        rain: t >= 50 && t < 65 ? 1 : 0,
        indoors: t >= 65 && t < 75 ? 1 : 0,
        danger: t >= 75 && t < 87 ? 1 : 0,
        fight: t >= 87 && t < 102 ? 1 : 0,
        boss: t >= 87 && t < 102 ? 1 : 0,
      }),
    marks: [
      { t: 15, label: 'town' }, { t: 30, label: 'night' }, { t: 50, label: 'day, rain' }, { t: 65, label: 'indoors' },
      { t: 75, label: 'danger' }, { t: 87, label: 'boss fight' }, { t: 102, label: 'ends' },
    ],
  }),

  /** The ambience alone: wind, leaves, water, rain, night, then each land's own bed. */
  ambience: () => ({
    seconds: 100,
    setup: (audio) => audio.setVolume('music', 0),
    frame: (t, audio, i) => {
      const land = t < 58 ? 'meadow' : (LANDS[Math.floor((t - 58) / 6) % LANDS.length] as string);
      audio.setState({
        ...calm,
        regions: { [land]: 1 },
        wind: t < 10 ? t / 10 : t < 58 ? 0.3 : 0.5,
        trees: t >= 10 && t < 20 ? 1 : 0.3,
        nearWater: t >= 20 && t < 30 ? (t - 20) / 10 : 0,
        rain: t >= 30 && t < 40 ? 1 : 0,
        timeOfDay: t >= 44 && t < 58 ? 0 : 0.5,
      });
      if (hits(i, 36)) audio.emit({ type: 'thunder' });
    },
    marks: [
      { t: 0, label: 'wind rises' }, { t: 10, label: 'trees' }, { t: 20, label: 'water nears' }, { t: 30, label: 'rain' }, { t: 44, label: 'night' },
      ...LANDS.map((land, i) => ({ t: 58 + i * 6, label: land })),
    ],
  }),

  /** Every one-shot in turn, with the music silent but still keeping time. */
  effects: () => {
    const events: { t: number; label: string }[] = [];
    for (let i = 0; i < 6; i++) events.push({ t: 1 + i * 0.3, label: 'pickup' });
    ELEMENTS.forEach((element, i) => events.push({ t: 4 + i, label: `spell ${element}` }));
    events.push({ t: 10.5, label: 'hit' }, { t: 11.2, label: 'jump' }, { t: 11.7, label: 'land' }, { t: 12.5, label: 'placed' }, { t: 13.2, label: 'broken' });
    events.push({ t: 14, label: 'ui click' }, { t: 14.4, label: 'ui open' }, { t: 14.9, label: 'ui close' });
    MOODS.forEach((mood, i) => events.push({ t: 16 + i * 0.8, label: `pet ${mood}` }));
    events.push({ t: 20, label: 'talk 0' }, { t: 23, label: 'talk 1' }, { t: 26, label: 'talk 2' }, { t: 30, label: 'machine' }, { t: 41, label: 'stinger' }, { t: 45, label: 'thunder' });
    return {
      seconds: 52,
      setup: (audio) => {
        audio.setVolume('ambience', 0);
        audio.setVolume('music', 0);
        // The stinger plays on the music bus. With every layer silenced, bringing the music up lets it alone through.
        audio.soloLayer('boss');
      },
      events,
      marks: events.filter((e) => !e.label.startsWith('pickup') || e.t === 1),
      frame: (t, audio, i) => {
        audio.setState(calm);
        audio.setVolume('music', t >= 40.5 && t < 45.5 ? 0.8 : 0);
        // Thunder is part of the ambience, so bring that up for it.
        audio.setVolume('ambience', t >= 44.8 ? 0.7 : 0);
        for (const e of events) {
          if (!hits(i, e.t)) continue;
          const [kind, what] = e.label.split(' ');
          if (kind === 'pickup') audio.emit({ type: 'pickup' });
          else if (kind === 'spell') audio.emit({ type: 'spell', element: what as Element });
          else if (kind === 'hit') audio.emit({ type: 'hit' });
          else if (kind === 'jump') audio.emit({ type: 'jump' });
          else if (kind === 'land') audio.emit({ type: 'land', surface: 'wood' });
          else if (kind === 'placed') audio.emit({ type: 'blockPlaced', surface: 'stone' });
          else if (kind === 'broken') audio.emit({ type: 'blockBroken', surface: 'stone' });
          else if (kind === 'ui') audio.emit({ type: 'ui', sound: what as 'click' | 'open' | 'close' });
          else if (kind === 'pet') audio.emit({ type: 'pet', mood: what as PetMood });
          else if (kind === 'stinger') audio.emit({ type: 'stinger' });
          else if (kind === 'thunder') audio.emit({ type: 'thunder' });
        }
        for (let who = 0; who < 3; who++) {
          const from = 20 + who * 3;
          const npc = NPCS[who];
          if (!npc || t < from || t >= from + 2.4) continue;
          // Type the line at the speaker's own speed.
          const at = Math.floor((t - from) * npc.voice.speed);
          const before = Math.floor((t - STEP - from) * npc.voice.speed);
          if (at !== before) talk(audio, who, at);
        }
        // A machine that acts at uneven moments for ten seconds. The engine should put every tick on a half beat.
        if (t >= 30 && t < 40 && (i * 7919) % 5 === 0) audio.emit({ type: 'machine' });
      },
    };
  },
};

function toWav(channels: Float32Array[], rate: number): string {
  const frames = channels[0]?.length ?? 0;
  const bytes = new Uint8Array(44 + frames * channels.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * channels.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * channels.length * 2, true);
  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (const data of channels) {
      const v = Math.max(-1, Math.min(1, data[i] as number));
      view.setInt16(at, Math.round(v * 32767), true);
      at += 2;
    }
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function runScene(name: string, arg = ''): Promise<LabResult> {
  const make = scenes[name];
  if (!make) throw new Error(`no scene called ${name}`);
  const scene = make(arg);
  const log: LabSample[] = [];
  let voicePeak = 0;
  let dropped = 0;
  let refused: Record<string, number> = {};
  let fixedNodes = 0;
  const hook = (window as unknown as { __labMark?: (time: number) => Promise<void> }).__labMark;
  const began = performance.now();
  const { buffer, updateMs } = await renderOffline({
    seconds: scene.seconds,
    step: STEP,
    seed: 7,
    setup: scene.setup,
    frame: scene.frame,
    marks: scene.pause,
    onMark: hook ? (time) => hook(time) : undefined,
    sample: (d, t) => {
      voicePeak = d.voicePeak;
      dropped = d.dropped;
      refused = { ...d.refused };
      fixedNodes = d.fixedNodes;
      let layers = '';
      for (const id in d.layers) if (d.layers[id as LayerId].on) layers += (layers ? ' ' : '') + id;
      log.push({ t, bar: d.bar, beat: d.beat, bpm: d.bpm, baseBpm: d.baseBpm, intensity: d.intensity, voices: d.voices, nodes: d.nodes, lead: d.lead, layers, notes: { ...d.notesByPalette }, weights: { ...d.weights } });
    },
  });
  const renderMs = performance.now() - began;
  const decimate = scene.decimate ?? 1;
  let channels: Float32Array[] = [buffer.getChannelData(0), buffer.getChannelData(1)];
  if (decimate > 1) {
    // Long renders go back as mono at a lower rate. Each output sample is the mean of a block.
    const left = channels[0] as Float32Array;
    const right = channels[1] as Float32Array;
    const out = new Float32Array(Math.floor(left.length / decimate));
    for (let i = 0; i < out.length; i++) {
      let sum = 0;
      for (let k = 0; k < decimate; k++) sum += (left[i * decimate + k] as number) + (right[i * decimate + k] as number);
      out[i] = sum / (2 * decimate);
    }
    channels = [out];
  }
  const sorted = updateMs.slice().sort((a, b) => a - b);
  return {
    name: arg ? `${name}-${arg.replaceAll(':', '-')}` : name,
    seconds: scene.seconds,
    sampleRate: buffer.sampleRate / decimate,
    channels: channels.length,
    wav: toWav(channels, buffer.sampleRate / decimate),
    log,
    marks: scene.marks ?? [],
    events: scene.events ?? [],
    update: {
      mean: updateMs.reduce((a, b) => a + b, 0) / Math.max(1, updateMs.length),
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      calls: updateMs.length,
    },
    renderMs,
    voicePeak,
    dropped,
    refused,
    fixedNodes,
  };
}
