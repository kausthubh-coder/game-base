// The sound engine's whole public surface. Every sound in the game is made here from code: there are no
// audio files. The game hands it numbers every frame (`setState`, or `followAmbient` for the weather) and
// one-shot events (`emit`, or `onEvent` for the base's own GameEvent). It needs only a BaseAudioContext, so
// the same code renders in an OfflineAudioContext for the checks.
//
//   const audio = createAudio(new AudioContext());   // after the first click
//   audio.start();
//   each frame: audio.setState({ regions: { meadow: 0.7, desert: 0.3 }, fight: 0 }); audio.update();
//
// How it is put together, and what to tune first, is in NOTES.md beside this file.
import { palettes as startingPalettes } from '../../content/palettes/index.ts';
import { pickupBell } from '../../content/palettes/instruments.ts';
import type { Palette } from '../../content/palettes/types.ts';
import type { GameEvent } from '../../engine/events.ts';
import type { ViewSystem } from '../../engine/system.ts';
import type { Ambient, Quality, Surface, Vec3 } from '../../engine/types.ts';
import { Ambience, type Air } from './ambience.ts';
import { dayAmount, dominant, maskNames, noteName, normalizeWeights, slewWeights, snapToMask } from './blend.sim.ts';
import { barOf, beatOf } from './conductor.sim.ts';
import { Effects, type Element, type PetMood, type Place, type VoiceSpec } from './effects.ts';
import { playNote } from './instruments.ts';
import { intensityTarget, LAYERS, smoothIntensity, type LayerId, type Mood } from './intensity.sim.ts';
import { Mixer, type BusName } from './mixer.ts';
import { LOOKAHEAD, Music, type MusicInput } from './music.ts';
import { ladderSemis, pickupNote, talkNote } from './patterns.sim.ts';
import { mulberry32 } from './rng.sim.ts';
import { Rig, VOICE_LIMIT } from './rig.ts';

export type { BusName, Element, LayerId, PetMood, VoiceSpec };
export { VOICE_LIMIT };

/** What the game tells the engine every frame. Every number is 0 to 1. */
export interface AudioState {
  /** A weight per palette id. They should sum to 1. In a border band two are above zero. */
  regions: Readonly<Record<string, number>>;
  town: number;
  indoors: number;
  danger: number;
  fight: number;
  boss: number;
  /** 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset: the same clock as `Ambient`. */
  timeOfDay: number;
  rain: number;
  wind: number;
  nearWater: number;
  trees: number;
}

/** One-shot sounds. `at` places a sound in the world. Without it the sound is at the listener. */
export type AudioEvent =
  | { type: 'footstep'; surface: Surface; at?: Vec3 }
  | { type: 'jump'; at?: Vec3 }
  | { type: 'land'; surface: Surface; at?: Vec3 }
  | { type: 'pickup'; at?: Vec3 }
  | { type: 'blockPlaced'; surface: Surface; at?: Vec3 }
  | { type: 'blockBroken'; surface: Surface; at?: Vec3 }
  | { type: 'hit'; at?: Vec3 }
  | { type: 'spell'; element: Element; at?: Vec3 }
  | { type: 'ui'; sound: 'click' | 'open' | 'close' }
  /** One typed character of dialogue. Call it as each character appears. */
  | { type: 'talk'; voice: VoiceSpec; char: string; at?: Vec3 }
  | { type: 'pet'; mood: PetMood; at?: Vec3 }
  /** A machine acted. The tick is moved to the next half beat, so machines play in time. */
  | { type: 'machine'; at?: Vec3 }
  /** A quest step completed. The phrase starts on the next bar line, in key. */
  | { type: 'stinger' }
  | { type: 'thunder'; at?: Vec3 };

/** The conductor's state, for a debug panel and for the checks. The same object is returned every call. */
export interface AudioDebug {
  running: boolean;
  time: number;
  bpm: number;
  /** The tempo of the land or blend of lands, before fights and night. */
  baseBpm: number;
  targetBpm: number;
  bar: number;
  beat: number;
  key: string;
  scale: string;
  chord: string;
  /** The notes the leading land may play right now. In a border band these are the shared notes. */
  notes: string;
  lead: string;
  weights: Record<string, number>;
  intensity: number;
  layers: Record<LayerId, { on: boolean; level: number }>;
  fight: boolean;
  resolving: boolean;
  voices: number;
  voicePeak: number;
  /** Sounds refused because the voice budget was full, in all and by bus. */
  dropped: number;
  refused: Record<'music' | 'ambience' | 'effects' | 'voice', number>;
  /** Live Web Audio nodes: the fixed graph plus every voice that has not ended. */
  nodes: number;
  fixedNodes: number;
  notesByPalette: Record<string, number>;
  ducking: number;
}

export interface AudioOptions {
  /** The palettes to play. The default is the seven in src/content/palettes. */
  palettes?: readonly Palette[];
  /** Where the sound goes. The default is the context's destination. */
  destination?: AudioNode;
  /** A fixed seed makes a render repeatable. */
  seed?: number;
}

export interface AudioSystem extends ViewSystem {
  /** Starts the music and the ambience. Call it once, after the context is allowed to run. */
  start(): void;
  /** Call every frame with what changed. Missing fields keep their value. */
  setState(state: Partial<AudioState>): void;
  /** Schedules what is due. Call every frame. As a ViewSystem it also follows `ctx.ambient`. */
  update(dt?: number, view?: { ambient: Ambient }): void;
  emit(event: AudioEvent): void;
  /** Takes the base's weather and time of day. */
  followAmbient(ambient: Ambient): void;
  /** Takes the base's own events: footsteps, jumps, blocks, pickups, thunder, interface sounds. */
  onEvent(event: GameEvent): void;
  /** Where the listener stands. Sounds with an `at` are panned and faded against it. */
  setListener(at: Vec3): void;
  setVolume(bus: BusName, value: number): void;
  getVolume(bus: BusName): number;
  debug(): AudioDebug;
  /** Plays one layer alone, or all of them again with null. For tuning. */
  soloLayer(layer: LayerId | null): void;
}

/** Seconds between updates of the gains and filters. The notes themselves are scheduled every call. */
const CONTROL_STEP = 0.03;

export function createAudio(ctx: BaseAudioContext, options: AudioOptions = {}): AudioSystem {
  const palettes = options.palettes ?? startingPalettes;
  const ids = palettes.map((p) => p.id);
  const rig = new Rig(ctx, mulberry32(options.seed ?? (Math.random() * 2 ** 32) >>> 0));
  const mixer = new Mixer(rig, options.destination ?? ctx.destination);
  const music = new Music(rig, mixer, palettes);
  const ambience = new Ambience(rig, mixer, palettes);
  const effects = new Effects(rig, mixer);

  const state: AudioState = { regions: { [ids[0] as string]: 1 }, town: 0, indoors: 0, danger: 0, fight: 0, boss: 0, timeOfDay: 0.5, rain: 0, wind: 0.2, nearWater: 0, trees: 0 };
  const sky = { fog: 0, cloud: 0.2, windDir: 0, wetness: 0 };
  const target: number[] = ids.map((_, i) => (i === 0 ? 1 : 0));
  const weights = target.slice();
  const input: MusicInput = { weights, intensity: 0.5, fight: 0, night: 0, town: 0, rain: 0, danger: 0, boss: 0 };
  const air: Air = { wind: 0.2, windDir: 0, rain: 0, trees: 0, nearWater: 0, day: 1, indoors: 0, cloud: 0.2, weights };
  const mood: Mood = { town: 0, danger: 0, fight: 0, boss: 0, night: 0, rain: 0 };
  const listener: Vec3 = { x: 0, y: 0, z: 0 };
  const place: Place = { pan: 0, gain: 1 };
  let running = false;
  let lastControl = -1;
  let combo = 0;
  let lastPickup = -10;

  const report: AudioDebug = {
    running: false, time: 0, bpm: 0, baseBpm: 0, targetBpm: 0, bar: 0, beat: 0, key: '', scale: '', chord: '', notes: '', lead: '',
    weights: {}, intensity: 0, layers: {} as AudioDebug['layers'], fight: false, resolving: false, voices: 0, voicePeak: 0, dropped: 0, refused: rig.refused,
    nodes: 0, fixedNodes: 0, notesByPalette: {}, ducking: 1,
  };
  for (const id of LAYERS) report.layers[id] = { on: false, level: 0 };

  /** Where a sound sits for the listener. East is to the right. Far sounds are softer. */
  function locate(at: Vec3 | undefined): Place {
    if (!at) {
      place.pan = 0;
      place.gain = 1;
      return place;
    }
    const dx = at.x - listener.x;
    const dy = at.y - listener.y;
    const dz = at.z - listener.z;
    const far = Math.sqrt(dx * dx + dy * dy + dz * dz);
    place.pan = Math.max(-0.85, Math.min(0.85, dx / 14));
    place.gain = 1 / (1 + (far / 18) * (far / 18));
    return place;
  }

  function follow(now: number, dt: number, first: boolean): void {
    normalizeWeights(state.regions, ids, target);
    if (first) for (let i = 0; i < weights.length; i++) weights[i] = target[i] as number;
    else slewWeights(weights, target, dt);
    const day = dayAmount(state.timeOfDay);
    mood.town = state.town;
    mood.danger = state.danger;
    mood.fight = state.fight;
    mood.boss = state.boss;
    mood.night = 1 - day;
    mood.rain = state.rain;
    const goal = intensityTarget(mood);
    input.intensity = first ? goal : smoothIntensity(input.intensity, goal, dt);
    input.fight = state.fight;
    input.night = 1 - day;
    input.town = state.town;
    input.rain = state.rain;
    input.danger = state.danger;
    input.boss = state.boss;
    air.wind = state.wind;
    air.windDir = sky.windDir;
    air.rain = state.rain;
    air.trees = state.trees;
    air.nearWater = state.nearWater;
    air.day = day;
    air.indoors = state.indoors;
    air.cloud = sky.cloud;
    mixer.control(now, state.indoors, state.rain, sky.fog, first);
    ambience.control(now, air);
  }

  music.onHalfBeat = (time) => ambience.hammer(time, air);
  music.onMachine = (time, level) => {
    const { palette, chord } = music.chord();
    effects.machine(time, Math.min(1.4, 0.8 + level * 0.2), palette.root + 12 + chord.root, locate(undefined));
  };

  const system: AudioSystem = {
    start() {
      if (running) return;
      running = true;
      const now = ctx.currentTime;
      follow(now, 0, true);
      lastControl = now;
      music.start(now + 0.06, input);
    },

    setState(next) {
      Object.assign(state, next);
    },

    update(_dt, view) {
      if (view) system.followAmbient(view.ambient);
      if (!running) return;
      const now = ctx.currentTime;
      rig.sweep(now);
      const dt = now - lastControl;
      if (dt >= CONTROL_STEP) {
        lastControl = now;
        follow(now, dt, false);
        music.control(now, input);
      }
      music.schedule(now, now + LOOKAHEAD, input);
      ambience.emit(now, now + LOOKAHEAD, air);
    },

    emit(event) {
      if (!running) return;
      const now = ctx.currentTime;
      const t = now + 0.004;
      switch (event.type) {
        case 'footstep':
          effects.footstep(t, event.surface, locate(event.at), sky.wetness);
          break;
        case 'jump':
          effects.jump(t, locate(event.at));
          break;
        case 'land':
          effects.land(t, event.surface, locate(event.at), sky.wetness);
          break;
        case 'pickup': {
          // A note of the chord that is playing. Quick pickups in a row climb.
          combo = now - lastPickup < 1.2 ? combo + 1 : 0;
          lastPickup = now;
          const { palette, chord, mask } = music.chord();
          const midi = snapToMask(pickupNote(palette, chord, combo), mask);
          const where = locate(event.at);
          playNote(rig, mixer.effects, pickupBell, t, midi, 0.2, 0.34 * where.gain, { bus: 'effects', priority: 2, pan: where.pan });
          break;
        }
        case 'blockPlaced':
          effects.block(t, event.surface, false, locate(event.at));
          break;
        case 'blockBroken':
          effects.block(t, event.surface, true, locate(event.at));
          break;
        case 'hit':
          effects.hit(t, locate(event.at));
          break;
        case 'spell': {
          const { palette, chord, mask } = music.chord();
          effects.spell(t, event.element, snapToMask(palette.root + 12 + chord.root, mask), locate(event.at));
          break;
        }
        case 'ui':
          effects.ui(t, event.sound);
          break;
        case 'talk': {
          const { palette, mask } = music.chord();
          const midi = snapToMask(talkNote(palette, event.voice.pitch, event.char), mask);
          if (effects.talk(t, event.voice, event.char, midi, locate(event.at))) mixer.speak(now + 0.55);
          break;
        }
        case 'pet': {
          const { palette, chord, mask } = music.chord();
          const midi = snapToMask(palette.root + 12 + chord.root + ladderSemis(chord.tones, Math.floor(rig.rng() * 3)), mask);
          effects.pet(t, event.mood, midi, locate(event.at));
          break;
        }
        case 'machine': {
          const when = music.quantizeMachine(now);
          if (when >= 0) {
            const { palette, chord } = music.chord();
            effects.machine(when, 1, palette.root + 12 + chord.root, locate(event.at));
          }
          break;
        }
        case 'stinger':
          music.queueStinger();
          break;
        case 'thunder':
          ambience.thunder(t, 0.9, locate(event.at).pan);
          break;
      }
    },

    followAmbient(ambient) {
      state.timeOfDay = ambient.timeOfDay;
      state.rain = ambient.rain;
      state.wind = ambient.wind;
      sky.fog = ambient.fog;
      sky.cloud = ambient.cloud;
      sky.windDir = ambient.windDir;
      sky.wetness = ambient.wetness;
    },

    onEvent(event) {
      system.emit(event);
    },

    setListener(at) {
      listener.x = at.x;
      listener.y = at.y;
      listener.z = at.z;
    },

    setVolume(bus, value) {
      mixer.setVolume(bus, value);
    },

    getVolume(bus) {
      return mixer.volume(bus);
    },

    setQuality(quality: Quality) {
      music.rich = quality !== 'low';
    },

    soloLayer(layer) {
      music.solo = layer;
    },

    debug() {
      const now = ctx.currentTime;
      const c = music.conductor;
      // The conductor runs a little ahead of the clock. Report the beat that is sounding.
      const tick = Math.max(0, c.tick - Math.ceil(Math.max(0, c.time - now) / (60 / c.bpm / 12)));
      const lead = palettes[running ? music.lead : dominant(weights)] as Palette;
      const { chord, mask } = music.chord();
      report.running = running;
      report.time = now;
      report.bpm = c.bpm;
      report.baseBpm = music.baseBpm;
      report.targetBpm = music.targetBpm;
      report.bar = barOf(tick);
      report.beat = beatOf(tick);
      report.key = noteName(lead.root);
      report.scale = lead.scaleName;
      report.chord = chord.name;
      report.notes = maskNames(mask);
      report.lead = lead.id;
      report.intensity = input.intensity;
      report.fight = music.mode.fight;
      report.resolving = music.mode.resolve;
      for (let i = 0; i < ids.length; i++) {
        report.weights[ids[i] as string] = weights[i] as number;
        report.notesByPalette[ids[i] as string] = music.notesByPalette[i] as number;
      }
      for (const id of LAYERS) {
        const layer = report.layers[id];
        layer.on = music.switches[id] && music.levels[id] > 0;
        layer.level = music.levels[id];
      }
      report.voices = rig.voicesAt(now);
      report.voicePeak = rig.peak;
      report.dropped = rig.dropped;
      report.nodes = rig.staticNodes + rig.voiceNodes;
      report.fixedNodes = rig.staticNodes;
      report.ducking = mixer.ducking;
      return report;
    },

    dispose() {
      running = false;
      rig.releaseAll();
      music.dispose();
      ambience.dispose();
      mixer.dispose();
    },
  };
  return system;
}
