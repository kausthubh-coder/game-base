// The music: one conductor, the palettes that can be heard, and a bus per layer per palette. Each beat it
// fixes what the world is doing, asks the composer for that beat's notes and schedules them a little ahead
// on the audio clock. Gains follow the region weights continuously, so a border is a crossfade by position.
import type { Chord, Palette } from '../../content/palettes/types.ts';
import { allowedMasks, blendTempo, crossoverGains, dominant, PALETTE_LAYERS, pitchMask, SILENT, snapToMask, type PaletteLayer } from './blend.sim.ts';
import { barOf, beatOf, createConductor, resumeAt, stepTick, targetTempo, TICKS_PER_BEAT, type Conductor } from './conductor.sim.ts';
import { playDrum, playNote } from './instruments.ts';
import { gateLayers, LAYERS, layerLevel, newSwitches, type LayerId, type LayerSwitches } from './intensity.sim.ts';
import { Glide, type Mixer } from './mixer.ts';
import { chordFor, createComposer, planBoss, planFightDrums, planStinger, planTension, type DrumEvent, type Mode, type NoteEvent } from './patterns.sim.ts';
import type { Priority, Rig } from './rig.ts';

/** What the music follows. The engine smooths these before they arrive. */
export interface MusicInput {
  /** One weight per palette. They sum to 1. */
  weights: readonly number[];
  intensity: number;
  fight: number;
  /** 0 by day, 1 at night. */
  night: number;
  town: number;
  rain: number;
  danger: number;
  boss: number;
}

/** How loud each layer sits in the mix, how much of it goes to the hall, and where it sits left to right. */
const MIX: Record<LayerId, { level: number; hall: number; pan: number; fade: number }> = {
  drone: { level: 0.3, hall: 0.35, pan: 0, fade: 0.5 },
  harmony: { level: 0.8, hall: 0.4, pan: -0.22, fade: 0.3 },
  melody: { level: 0.6, hall: 0.5, pan: 0.08, fade: 0.25 },
  sparkle: { level: 0.9, hall: 0.7, pan: 0.3, fade: 0.3 },
  bass: { level: 0.75, hall: 0.05, pan: 0, fade: 0.25 },
  perc: { level: 1.1, hall: 0.18, pan: 0.14, fade: 0.25 },
  full: { level: 0.45, hall: 0.4, pan: -0.1, fade: 0.4 },
  drums: { level: 1.1, hall: 0.12, pan: 0, fade: 0.08 },
  tension: { level: 0.3, hall: 0.2, pan: 0, fade: 0.4 },
  boss: { level: 0.38, hall: 0.3, pan: 0, fade: 0.2 },
};

const PRIORITY: Record<NoteEvent['layer'], Priority> = {
  drone: 2, melody: 2, bass: 2, boss: 2, stinger: 2, harmony: 1, perc: 1, tension: 1, sparkle: 0, full: 0,
};

/** Seconds of music scheduled ahead of the clock. Short enough to react, long enough to survive a slow frame. */
export const LOOKAHEAD = 0.25;

export class Music {
  readonly conductor: Conductor;
  readonly switches: LayerSwitches = newSwitches();
  readonly levels: Record<LayerId, number>;
  /** Notes scheduled so far for each palette. The checks read it to see both lands play in a border band. */
  readonly notesByPalette: number[];
  /** The weights fixed on the last beat. */
  readonly weights: number[];
  readonly allowed: number[];
  mode: Mode = { fight: false, night: false, town: false, rain: false, resolve: false };
  targetBpm: number;
  baseBpm: number;
  /** The heaviest palette, fixed on the last bar line. Its key is the one effects play in. */
  lead = 0;
  /** Only this layer sounds. For measuring one layer at a time. */
  solo: LayerId | null = null;
  /** False drops the sparkle and the town arrangement, for a slow machine. */
  rich = true;

  private readonly composer = createComposer();
  private readonly masks: number[];
  private readonly tempos: number[];
  private readonly sums: Record<LayerId, GainNode>;
  private readonly sumGlides: Record<LayerId, Glide>;
  private readonly buses: Record<PaletteLayer, GainNode>[] = [];
  private readonly busGlides: Record<PaletteLayer, Glide>[] = [];
  private readonly cross: Record<PaletteLayer, number[]>;
  private readonly stingerBus: GainNode;
  private readonly nodes: AudioNode[] = [];
  /** The clock time of each tick of the beat scheduled last, and of the first tick of the next beat. */
  private readonly tickTimes = new Float64Array(TICKS_PER_BEAT + 1);
  private wasFighting = false;
  private resolvePending = false;
  private resolveBar = -1;
  private stingerPending = false;
  private stinger: NoteEvent[] = [];
  private stingerBar = -1;
  private machinePending = 0;
  private machineAt = -1;
  private started = false;

  constructor(private readonly rig: Rig, mixer: Mixer, readonly palettes: readonly Palette[]) {
    const ctx = rig.ctx;
    const gain = (value: number): GainNode => {
      const node = rig.keep(ctx.createGain());
      node.gain.value = value;
      this.nodes.push(node);
      return node;
    };
    const n = palettes.length;
    this.masks = palettes.map(pitchMask);
    this.tempos = palettes.map((p) => p.tempo);
    this.weights = palettes.map((_, i): number => (i === 0 ? 1 : 0));
    this.allowed = this.masks.slice();
    this.notesByPalette = new Array<number>(n).fill(0);
    this.baseBpm = this.tempos[0] as number;
    this.targetBpm = this.baseBpm;
    this.conductor = createConductor(this.baseBpm, 0);

    const sums = {} as Record<LayerId, GainNode>;
    const sumGlides = {} as Record<LayerId, Glide>;
    const levels = {} as Record<LayerId, number>;
    for (const id of LAYERS) {
      const mix = MIX[id];
      const sum = gain(0);
      const pan = rig.keep(ctx.createStereoPanner());
      pan.pan.value = mix.pan;
      this.nodes.push(pan);
      sum.connect(pan).connect(mixer.music);
      sum.connect(gain(mix.hall)).connect(mixer.musicWet);
      sums[id] = sum;
      sumGlides[id] = new Glide(sum.gain);
      levels[id] = 0;
    }
    this.sums = sums;
    this.sumGlides = sumGlides;
    this.levels = levels;

    const cross = {} as Record<PaletteLayer, number[]>;
    for (const layer of PALETTE_LAYERS) cross[layer] = new Array<number>(n).fill(0);
    this.cross = cross;
    for (let i = 0; i < n; i++) {
      const bus = {} as Record<PaletteLayer, GainNode>;
      const glide = {} as Record<PaletteLayer, Glide>;
      for (const layer of PALETTE_LAYERS) {
        const node = gain(0);
        node.connect(sums[layer]);
        bus[layer] = node;
        glide[layer] = new Glide(node.gain);
      }
      this.buses.push(bus);
      this.busGlides.push(glide);
    }
    this.stingerBus = gain(0.3);
    this.stingerBus.connect(mixer.music);
    this.stingerBus.connect(gain(0.5)).connect(mixer.musicWet);
  }

  /** Starts the clock at `time`, already in the right land and mood, so the first bar is not a morph. */
  start(time: number, input: MusicInput): void {
    for (let i = 0; i < this.weights.length; i++) this.weights[i] = input.weights[i] as number;
    this.baseBpm = blendTempo(this.tempos, this.weights);
    this.targetBpm = targetTempo(this.baseBpm, input.fight, input.night, input.danger, input.boss);
    this.conductor.bpm = this.targetBpm;
    this.conductor.tick = 0;
    this.conductor.time = time;
    this.lead = dominant(this.weights);
    this.started = true;
    this.control(time, input, true);
  }

  /** Moves the gains toward the weights and the intensity. This is continuous: it does not wait for a beat. */
  control(now: number, input: MusicInput, jump = false): void {
    for (const layer of PALETTE_LAYERS) {
      const out = this.cross[layer];
      crossoverGains(layer, input.weights, out);
      for (let i = 0; i < out.length; i++) {
        const value = (out[i] as number) * (this.palettes[i] as Palette).gain;
        const glide = (this.busGlides[i] as Record<PaletteLayer, Glide>)[layer];
        if (jump) glide.set(value);
        else glide.to(value, now, 0.12);
      }
    }
    this.setLevels(input);
    for (const id of LAYERS) {
      if (jump) this.sumGlides[id].set(this.levels[id]);
      else this.sumGlides[id].to(this.levels[id], now, MIX[id].fade);
    }
  }

  /** How loud each layer should be, from its switch and the intensity. */
  private setLevels(input: MusicInput): void {
    for (const id of LAYERS) {
      let level = layerLevel(id, this.switches[id], input.intensity, input.danger, input.boss) * MIX[id].level;
      if (this.solo && this.solo !== id) level = 0;
      if (!this.rich && (id === 'sparkle' || id === 'full')) level = 0;
      this.levels[id] = level;
    }
  }

  /** Schedules every beat that starts before `horizon`. */
  schedule(now: number, horizon: number, input: MusicInput): void {
    if (!this.started) return;
    const c = this.conductor;
    // After a stall the clock carries on from now. The bar count is never wound back.
    if (c.time < now - 0.02) resumeAt(c, now + 0.03);
    while (c.time < horizon) this.scheduleBeat(input);
  }

  private scheduleBeat(input: MusicInput): void {
    const c = this.conductor;
    const bar = barOf(c.tick);
    const beat = beatOf(c.tick);
    const n = this.palettes.length;

    // Fix the state of the world on the beat, so every change lands in time.
    for (let i = 0; i < n; i++) this.weights[i] = input.weights[i] as number;
    allowedMasks(this.masks, this.weights, this.allowed);
    const m = this.mode;
    const fighting = input.fight >= 0.5;
    if (this.wasFighting && !fighting) this.resolvePending = true;
    if (fighting) this.resolvePending = false;
    this.wasFighting = fighting;
    m.fight = fighting;
    m.night = m.night ? input.night > 0.45 : input.night > 0.55;
    m.town = m.town ? input.town > 0.4 : input.town > 0.55;
    m.rain = m.rain ? input.rain > 0.3 : input.rain > 0.45;
    if (beat === 0) {
      // Bigger changes wait for the bar line: which land leads, the bar that closes a fight, a stinger.
      this.lead = dominant(this.weights);
      if (this.resolvePending) {
        this.resolvePending = false;
        this.resolveBar = bar;
      }
      if (this.stingerPending) {
        this.stingerPending = false;
        const p = this.palettes[this.lead] as Palette;
        this.stinger = planStinger(p, chordFor(p, bar, false));
        this.stingerBar = bar;
      }
    }
    m.resolve = bar === this.resolveBar;
    gateLayers(this.switches, input.intensity, input.danger, input.boss);
    // The drums play out the bar the fight ended in, then land one last hit on the bar that resolves it.
    if (this.resolvePending || (m.resolve && beat === 0)) this.switches.drums = true;
    this.setLevels(input);

    this.baseBpm = blendTempo(this.tempos, this.weights);
    this.targetBpm = targetTempo(this.baseBpm, input.fight, input.night, input.danger, input.boss);
    const times = this.tickTimes;
    for (let k = 0; k < TICKS_PER_BEAT; k++) {
      times[k] = c.time;
      stepTick(c, this.targetBpm);
    }
    times[TICKS_PER_BEAT] = c.time;

    const from = beat * TICKS_PER_BEAT;
    for (let i = 0; i < n; i++) {
      if ((this.weights[i] as number) < SILENT) continue;
      const p = this.palettes[i] as Palette;
      const plan = this.composer.plan(p, bar, m);
      const bus = this.buses[i] as Record<PaletteLayer, GainNode>;
      const mask = this.allowed[i] as number;
      for (const note of plan.notes) {
        if (note.tick < from || note.tick >= from + TICKS_PER_BEAT) continue;
        const layer = note.layer as PaletteLayer;
        if (!this.audible(layer, i)) continue;
        if (this.play(note, note.tick - from, bus[layer], mask, p.swing)) this.notesByPalette[i] = (this.notesByPalette[i] as number) + 1;
      }
      for (const hit of plan.drums) {
        if (hit.tick < from || hit.tick >= from + TICKS_PER_BEAT || !this.audible('perc', i)) continue;
        this.hit(hit, hit.tick - from, bus.perc, p.swing);
      }
    }

    const lead = this.palettes[this.lead] as Palette;
    if (this.switches.drums && this.levels.drums > 0) {
      for (const hit of planFightDrums(lead.grid, bar, m.resolve)) {
        if (hit.tick >= from && hit.tick < from + TICKS_PER_BEAT) this.hit(hit, hit.tick - from, this.sums.drums, 0);
      }
    }
    if (this.switches.tension) this.overlay(planTension(lead.root, bar), from, this.sums.tension);
    if (this.switches.boss) this.overlay(planBoss(lead.root, bar), from, this.sums.boss);
    if (bar === this.stingerBar) {
      for (const note of this.stinger) {
        if (note.tick >= from && note.tick < from + TICKS_PER_BEAT) this.play(note, note.tick - from, this.stingerBus, this.allowed[this.lead] as number, 0);
      }
    }
    if (this.machinePending > 0) {
      this.machineAt = times[0] as number;
      this.onMachine?.(this.machineAt, this.machinePending);
      this.machinePending = 0;
    }
    this.onHalfBeat?.(times[0] as number);
    this.onHalfBeat?.(times[6] as number);
  }

  /** Called with the time of each half beat as it is scheduled. The forge's far hammers use it. */
  onHalfBeat?: (time: number) => void;
  /** Called when queued machine ticks reach their beat. */
  onMachine?: (time: number, level: number) => void;

  private audible(layer: PaletteLayer, palette: number): boolean {
    if (!this.switches[layer] || this.levels[layer] <= 0) return false;
    return (this.cross[layer][palette] as number) > SILENT;
  }

  private overlay(plan: { notes: NoteEvent[]; drums: DrumEvent[] }, from: number, out: AudioNode): void {
    for (const note of plan.notes) if (note.tick >= from && note.tick < from + TICKS_PER_BEAT) this.play(note, note.tick - from, out, 0, 0);
    for (const hit of plan.drums) if (hit.tick >= from && hit.tick < from + TICKS_PER_BEAT) this.hit(hit, hit.tick - from, out, 0);
  }

  /** The clock time of a tick inside the beat scheduled last. Swing pushes the off sixteenths late. */
  private timeOf(tick: number, swing: number): number {
    let t = tick;
    if (swing > 0 && Math.round(t) % 6 === 3) t += swing * 3;
    t = Math.max(0, Math.min(TICKS_PER_BEAT, t));
    const k = Math.min(TICKS_PER_BEAT - 1, Math.floor(t));
    const a = this.tickTimes[k] as number;
    return a + ((this.tickTimes[k + 1] as number) - a) * (t - k);
  }

  private play(note: NoteEvent, tick: number, out: AudioNode, mask: number, swing: number): boolean {
    const perTick = ((this.tickTimes[TICKS_PER_BEAT] as number) - (this.tickTimes[0] as number)) / TICKS_PER_BEAT;
    // A few milliseconds of looseness, the way hands play. The drone and the bass stay exact.
    const loose = note.layer === 'drone' || note.layer === 'bass' ? 0 : (this.rig.rng() - 0.5) * 0.008;
    const time = this.timeOf(tick, swing) + loose;
    const midi = mask ? snapToMask(note.midi, mask) : note.midi;
    return playNote(this.rig, out, note.patch, time, midi, note.ticks * perTick, note.vel, { priority: PRIORITY[note.layer], bend: note.bend });
  }

  private hit(hit: DrumEvent, tick: number, out: AudioNode, swing: number): void {
    const vel = hit.vel * (0.92 + this.rig.rng() * 0.16);
    // The fight kit is as important as the lead: it must not be the part that gives way.
    const priority: Priority = hit.layer === 'drums' ? 2 : 1;
    playDrum(this.rig, out, hit.drum, this.timeOf(tick, swing) + (this.rig.rng() - 0.5) * 0.004, vel, hit.midi, { priority });
  }

  /** The chord under the beat scheduled last, and the land it belongs to. */
  chord(): { palette: Palette; chord: Chord; mask: number } {
    const palette = this.palettes[this.lead] as Palette;
    const bar = barOf(Math.max(0, this.conductor.tick - 1));
    return { palette, chord: chordFor(palette, bar, this.mode.resolve), mask: this.allowed[this.lead] as number };
  }

  /** Plays a quest stinger from the next bar line. */
  queueStinger(): void {
    this.stingerPending = true;
  }

  /**
   * A machine ticked. Returns the time of the next half beat to play it on, or -1 when that slot already
   * has a tick or lies in a beat that is not scheduled yet. In the second case the tick waits for that beat.
   */
  quantizeMachine(now: number): number {
    for (const k of [0, 6, TICKS_PER_BEAT]) {
      const t = this.tickTimes[k] as number;
      if (t < now + 0.004) continue;
      if (t === this.machineAt) return -1;
      this.machineAt = t;
      return t;
    }
    this.machinePending = Math.min(this.machinePending + 1, 3);
    return -1;
  }

  dispose(): void {
    for (const node of this.nodes) node.disconnect();
    this.started = false;
  }
}
