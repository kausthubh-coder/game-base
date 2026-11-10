// The sound engine's whole public surface. The music and most sounds are made here from code. The files are the
// voiced lines of dialogue, which `speak` plays on the voice bus, and the recorded beds, footsteps and tool
// sounds of src/content/sound-samples.ts, which the game hands over with `addSample` once they are decoded.
// Until a recording arrives, the sound made in code plays in its place. The game hands it numbers every frame (`setState`, or `followAmbient` for the weather) and
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
import { Effects, materialOf, type Element, type Gait, type PetMood, type Place, type StepMaterial, type VoiceSpec } from './effects.ts';
import { playNote } from './instruments.ts';
import { intensityTarget, LAYERS, smoothIntensity, type LayerId, type Mood } from './intensity.sim.ts';
import { Mixer, type BusName } from './mixer.ts';
import { LOOKAHEAD, Music, type MusicInput } from './music.ts';
import { ladderSemis, pickupNote, talkNote } from './patterns.sim.ts';
import { mulberry32 } from './rng.sim.ts';
import { Rig, VOICE_LIMIT } from './rig.ts';
import { SampleBank, type SampleInfo } from './samples.ts';

export type { BusName, Element, Gait, LayerId, PetMood, SampleInfo, StepMaterial, VoiceSpec };

/** The things a hand does that have a recording of their own. */
export type Foley = 'hoe' | 'pour' | 'harvest' | 'plant' | 'bag' | 'page';

const FOLEY: Record<Foley, { id: string; gain: number; semis?: number }> = {
  hoe: { id: 'hit.hoe', gain: 0.7 },
  pour: { id: 'shot.pour', gain: 0.55 },
  harvest: { id: 'shot.harvest', gain: 0.7 },
  plant: { id: 'hit.dig', gain: 0.4, semis: 3 },
  bag: { id: 'shot.bag', gain: 0.5 },
  page: { id: 'shot.page', gain: 0.55 },
};

/** The recording a block makes when it breaks, and when it is set down, by surface. */
const BREAK: Partial<Record<Surface, { id: string; gain: number; semis?: number }>> = {
  stone: { id: 'hit.pick', gain: 0.75 },
  dirt: { id: 'hit.dig', gain: 0.75 },
  grass: { id: 'hit.dig', gain: 0.7, semis: 1 },
  sand: { id: 'hit.dig', gain: 0.6, semis: 3 },
  wood: { id: 'hit.chop', gain: 0.65, semis: 2 },
  snow: { id: 'hit.dig', gain: 0.5, semis: 4 },
};
const PLACE: Partial<Record<Surface, { id: string; gain: number; semis?: number }>> = {
  wood: { id: 'hit.plank', gain: 0.7 },
  stone: { id: 'hit.stone', gain: 0.7 },
  metal: { id: 'hit.stone', gain: 0.5, semis: 4 },
  dirt: { id: 'hit.dig', gain: 0.5, semis: 2 },
  grass: { id: 'hit.dig', gain: 0.5, semis: 2 },
  sand: { id: 'hit.dig', gain: 0.45, semis: 4 },
};
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
  /** Between stone walls on cobbles: sounds in the world get quick bright echoes. */
  stone: number;
}

/** One-shot sounds. `at` places a sound in the world. Without it the sound is at the listener. */
export type AudioEvent =
  /**
   * A foot comes down. `material` is finer than the surface (a path, a floor, cobbles); without it the surface
   * decides. `gait` sets weight and brightness. `quiet` below 1 is someone else's foot, `muffle` (0 to 1) is
   * how much a wall stands between, `litter` lays dry leaves under it, and `cloth` is the chance of a rustle.
   */
  | { type: 'footstep'; surface: Surface; at?: Vec3; material?: StepMaterial; gait?: Gait; quiet?: number; muffle?: number; litter?: number; cloth?: number }
  | { type: 'treeChop'; at?: Vec3 }
  | { type: 'treeFell'; logs: number; at?: Vec3 }
  | { type: 'jump'; at?: Vec3 }
  | { type: 'land'; surface: Surface; at?: Vec3; material?: StepMaterial }
  /** One recorded sound placed in the world: a dog, a door, a bucket in the well. `muffle` is 0 to 1. */
  | { type: 'sample'; id: string; at?: Vec3; gain?: number; semis?: number; muffle?: number; bus?: 'effects' | 'ambience' }
  /** Something done by hand that has its own recording: the hoe, the watering can, the bag, a page. */
  | { type: 'foley'; sound: Foley; at?: Vec3 }
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
  /** Current world inputs, shared and reused for inspection. */
  ambience: Readonly<AudioState>;
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

/** A spoken clip playing on the voice bus. */
export interface Speech {
  /** Its length in seconds. */
  readonly duration: number;
  /** Seconds since its first sample on the engine's clock: below 0 before it starts, and it runs on past the end. */
  elapsed(): number;
  /** True once it played to its end or was stopped. */
  readonly ended: boolean;
  /** Fades it out over a few milliseconds and lets the music back up. Safe to call twice. */
  stop(): void;
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
  /**
   * Where the listener stands, and the camera's yaw (0 looks north, growing counter-clockwise), so a sound
   * to the right of the picture is in the right ear. Sounds with an `at` are panned and faded against it.
   */
  setListener(at: Vec3, yaw?: number): void;
  /** Hands over one decoded recording. A bed starts silent until `setBed`; the rest play at once when asked for. */
  addSample(id: string, buffer: AudioBuffer, info: SampleInfo): void;
  /** True once a recording with this id was handed over. */
  hasSample(id: string): boolean;
  /** Sets a recorded bed's level, 0 to 1. With `at` it leans toward that point. */
  setBed(id: string, level: number, at?: Vec3 | null): void;
  setVolume(bus: BusName, value: number): void;
  getVolume(bus: BusName): number;
  /** True while the browser lets the engine's clock run. A clip played while it does not would never start. */
  readonly live: boolean;
  /** The engine's clock, in seconds. Things paced by sound (the town's spot sounds) count on it. */
  readonly now: number;
  /** Decodes a compressed clip (an mp3 of a voiced line) for `speak`. */
  decode(data: ArrayBuffer): Promise<AudioBuffer>;
  /**
   * Plays a decoded clip on the voice bus, so the Voice volume sets it, and ducks the music and ambience
   * under it. Null when the engine is not running. Stop the last one before the next, or they overlap.
   */
  speak(clip: AudioBuffer): Speech | null;
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
  const bank = new SampleBank(rig.rng);
  const effects = new Effects(rig, mixer, bank);
  const spaces = { open: 1, forest: 0, stone: 0, room: 0 };

  const state: AudioState = { regions: { [ids[0] as string]: 1 }, town: 0, indoors: 0, danger: 0, fight: 0, boss: 0, timeOfDay: 0.5, rain: 0, wind: 0.2, nearWater: 0, trees: 0, stone: 0 };
  const sky = { fog: 0, cloud: 0.2, windDir: 0, wetness: 0 };
  const target: number[] = ids.map((_, i) => (i === 0 ? 1 : 0));
  const weights = target.slice();
  const input: MusicInput = { weights, intensity: 0.5, fight: 0, night: 0, town: 0, rain: 0, danger: 0, boss: 0 };
  const air: Air = { wind: 0.2, windDir: 0, rain: 0, trees: 0, nearWater: 0, day: 1, indoors: 0, cloud: 0.2, town: 0, weights };
  const mood: Mood = { town: 0, danger: 0, fight: 0, boss: 0, night: 0, rain: 0 };
  const listener: Vec3 = { x: 0, y: 0, z: 0 };
  /** The camera's right, along the ground, so panning turns with the picture. */
  const right = { x: 1, z: 0 };
  const place: Place = { pan: 0, gain: 1, tone: 20000 };
  let running = false;
  let lastControl = -1;
  let combo = 0;
  let lastPickup = -10;

  const report: AudioDebug = {
    running: false, ambience: state, time: 0, bpm: 0, baseBpm: 0, targetBpm: 0, bar: 0, beat: 0, key: '', scale: '', chord: '', notes: '', lead: '',
    weights: {}, intensity: 0, layers: {} as AudioDebug['layers'], fight: false, resolving: false, voices: 0, voicePeak: 0, dropped: 0, refused: rig.refused,
    nodes: 0, fixedNodes: 0, notesByPalette: {}, ducking: 1,
  };
  for (const id of LAYERS) report.layers[id] = { on: false, level: 0 };

  /**
   * Where a sound sits for the listener: panned by how far it is to the right of the picture, softer with
   * distance, and darker too, the way air takes the top off far sounds. `muffle` (0 to 1) is a wall between.
   */
  function locate(at: Vec3 | undefined, muffle = 0): Place {
    if (!at) {
      place.pan = 0;
      place.gain = 1;
      place.tone = 20000;
      return place;
    }
    const dx = at.x - listener.x;
    const dy = at.y - listener.y;
    const dz = at.z - listener.z;
    const far = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const side = dx * right.x + dz * right.z;
    // Close by, a sound is in both ears. A few blocks off it leans fully to its side.
    place.pan = Math.max(-0.9, Math.min(0.9, side / Math.sqrt(side * side + (far - Math.abs(side)) ** 2 + 6)));
    place.gain = (1 / (1 + (far / 18) * (far / 18))) * (1 - 0.45 * muffle);
    place.tone = Math.min(20000, 22000 / (1 + far / 14)) * (1 - 0.8 * muffle) + 300;
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
    air.town = state.town;
    air.nearWater = state.nearWater;
    air.day = day;
    air.indoors = state.indoors;
    air.cloud = sky.cloud;
    spaces.forest = state.trees * (1 - state.stone);
    spaces.stone = state.stone;
    spaces.open = Math.max(0, 1 - spaces.forest - spaces.stone);
    mixer.control(now, state.indoors, state.rain, sky.fog, spaces, first);
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
        case 'footstep': {
          const where = locate(event.at, event.muffle);
          const quiet = event.quiet ?? 1;
          where.gain *= quiet;
          const material = event.material ?? materialOf(event.surface);
          const sampled = material !== null && effects.stepSample(t, material, event.gait ?? 'walk', where, {
            wet: sky.wetness, litter: event.litter, cloth: event.cloth ?? 0,
          });
          if (!sampled) effects.footstep(t, event.surface, where, sky.wetness);
          // Tall grass parts around the leg as well: the made swish rides over the recorded step.
          else if (event.surface === 'tallGrass' && quiet > 0.7) effects.footstep(t, 'tallGrass', where, 0);
          break;
        }
        case 'jump': {
          const where = locate(event.at);
          if (!effects.sample('move.cloth', t, where, { gain: 0.8, seconds: 0.3, priority: 1 })) effects.jump(t, where);
          break;
        }
        case 'land': {
          const where = locate(event.at);
          const material = event.material ?? materialOf(event.surface);
          if (material !== null && effects.stepSample(t, material, 'walk', where, { weight: 1.5, wet: sky.wetness, cloth: 1 })) {
            // Both feet, the second a moment after, and the body's weight under them.
            effects.stepSample(t + 0.05, material, 'walk', where, { weight: 0.8 });
            effects.land(t, 'snow', { pan: where.pan, gain: where.gain * 0.25, tone: 600 }, 0);
          } else effects.land(t, event.surface, where, sky.wetness);
          break;
        }
        case 'sample': {
          const where = locate(event.at, event.muffle);
          effects.sample(event.id, t, where, { gain: event.gain, semis: event.semis, bus: event.bus ?? 'ambience', priority: 0 });
          break;
        }
        case 'foley': {
          const f = FOLEY[event.sound];
          const where = locate(event.at);
          if (!effects.sample(f.id, t, where, { gain: f.gain, semis: f.semis, priority: 1 })) {
            if (event.sound === 'bag' || event.sound === 'page') effects.ui(t, 'open');
            else effects.block(t, event.sound === 'harvest' ? 'tallGrass' : 'dirt', event.sound !== 'plant', where);
          }
          break;
        }
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
        case 'treeChop': {
          const where = locate(event.at);
          // The recorded axe bites; a little of the made knock keeps the trunk's body under it.
          if (effects.sample('hit.chop', t, where, { gain: 0.8, priority: 1 })) effects.tree(t, 'chop', 1, where, 0.35);
          else effects.tree(t, 'chop', 1, where);
          break;
        }
        case 'treeFell': {
          const where = locate(event.at);
          if (effects.sample('shot.treefall', t, where, { gain: 0.6 + 0.08 * Math.min(4, event.logs), semis: -0.5 * Math.min(4, event.logs - 1), jitter: 0.5, priority: 2 })) effects.tree(t, 'fall', event.logs, where, 0.4);
          else effects.tree(t, 'fall', event.logs, where);
          break;
        }
        case 'blockPlaced': {
          const where = locate(event.at);
          const rec = PLACE[event.surface];
          if (rec && effects.sample(rec.id, t, where, { gain: rec.gain, semis: rec.semis, priority: 1 })) effects.block(t, event.surface, false, where, 0.3);
          else effects.block(t, event.surface, false, where);
          break;
        }
        case 'blockBroken': {
          const where = locate(event.at);
          const rec = BREAK[event.surface];
          // The tool's bite is recorded. The pieces that fall after it stay made, so each break crumbles anew.
          if (rec && effects.sample(rec.id, t, where, { gain: rec.gain, semis: rec.semis, priority: 1 })) effects.block(t + 0.03, event.surface, true, where, 0.45);
          else effects.block(t, event.surface, true, where);
          break;
        }
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

    setListener(at, yaw) {
      listener.x = at.x;
      listener.y = at.y;
      listener.z = at.z;
      if (yaw !== undefined) {
        right.x = Math.cos(yaw);
        right.z = -Math.sin(yaw);
      }
    },

    addSample(id, buffer, info) {
      if (info.kind === 'bed') ambience.addBed(id, buffer);
      else bank.add(id, buffer, info);
    },

    hasSample(id) {
      return bank.has(id) || ambience.hasBed(id);
    },

    setBed(id, level, at) {
      if (!running) return;
      ambience.setRecorded(id, level, at ? locate(at).pan : 0, ctx.currentTime, state.indoors);
    },

    setVolume(bus, value) {
      mixer.setVolume(bus, value);
    },

    getVolume(bus) {
      return mixer.volume(bus);
    },

    get live() {
      return running && ctx.state === 'running';
    },

    get now() {
      return ctx.currentTime;
    },

    decode(data) {
      return ctx.decodeAudioData(data);
    },

    speak(clip) {
      if (!running) return null;
      const start = ctx.currentTime + 0.03;
      const source = ctx.createBufferSource();
      source.buffer = clip;
      const level = ctx.createGain();
      source.connect(level).connect(mixer.voice);
      let ended = false;
      const end = (): void => {
        if (ended) return;
        ended = true;
        mixer.hush(ctx.currentTime + 0.35);
      };
      source.onended = () => {
        end();
        source.disconnect();
        level.disconnect();
      };
      source.start(start);
      mixer.speak(start + clip.duration + 0.35);
      return {
        duration: clip.duration,
        elapsed: () => ctx.currentTime - start,
        get ended() { return ended; },
        stop() {
          if (ended) return;
          const now = ctx.currentTime;
          // A short fade, so the cut does not click.
          level.gain.setValueAtTime(1, now);
          level.gain.linearRampToValueAtTime(0, now + 0.04);
          source.stop(now + 0.05);
          end();
        },
      };
    },

    setQuality(quality: Quality) {
      music.rich = quality !== 'low';
      mixer.rich = quality !== 'low';
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
