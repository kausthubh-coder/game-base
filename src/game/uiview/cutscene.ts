// The film's clock and its frame: the whole picture of a film at a time in seconds, as numbers. No three.js and
// no page here, so `bun test` checks any moment and `?cut-at=` holds any moment. The films are
// src/game/content/cutscenes.ts, the director that draws a frame is src/game/views/story-cutscene.view.ts.
//
//   const cut = resolveFilm(SCENE_9, (name) => region.place(name).at);   // once, when it starts
//   const run = createFilm(cut);
//   each frame: run.advance(dt); run.frame(frame);                       // fills `frame`, makes no garbage
import type { Vec3 } from '../../engine/types.ts';
import type { Flags } from '../api.sim.ts';
import { LOW_FIRE, filmFlag, type Film, type FilmShot, type PuppetPose, type Spot, type Track } from '../content/cutscenes.ts';

/** Seconds of the first fade up from black. */
const FADE_IN = 1.4;
/** Seconds of the dip to black at each side of a cut that dips. */
const DIP = 0.45;
/** The words fade in this long after their shot starts, and out this long before it ends, each fade this long. */
const WORDS_IN = 0.7, WORDS_OUT = 0.6, WORDS_FADE = 0.6;
/** Skip: down to black, then up on the world as the film leaves it. */
export const SKIP_DOWN = 0.3, SKIP_UP = 0.6;
/** A walk speeds up over this share of its time and slows down over as much at its end. */
const WALK_RAMP = 0.25;
/** Seconds a turn takes when the beat does not say. */
const TURN = 0.5;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
/** Slow at both ends. */
export const easeInOut = (t: number): number => t * t * (3 - 2 * t);
/**
 * How far along a walk is, 0 to 1, at a share of its time: the speed climbs over the first `WALK_RAMP` of it,
 * holds, and falls over the last, so nothing starts or stops at full speed.
 */
export function walkAlong(u: number, ramp = WALK_RAMP): number {
  const t = clamp01(u), a = ramp, full = 1 - a;
  if (t < a) return (t * t) / (2 * a) / full;
  if (t > 1 - a) return (full - (1 - t) * (1 - t) / (2 * a)) / full;
  return (a / 2 + (t - a)) / full;
}
/** The way from one point to another as a facing: 0 is north (-z), a quarter turn is east (+x), as in the rules. */
export const facingTo = (fx: number, fz: number, tx: number, tz: number): number => Math.atan2(tx - fx, -(tz - fz));
/** The shortest turn from one facing to another, in radians, -PI to PI. */
function turnBetween(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The value of a track at a time: each key moves it from where it was to its value, eased, over its seconds. */
export function trackAt(track: Track, t: number): number {
  if (track.length === 0) return 0;
  let value = track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [at, to, over = 0] = track[i];
    if (t < at) break;
    value = over > 0 ? value + (to - value) * easeInOut(clamp01((t - at) / over)) : to;
  }
  return value;
}

// ---------------------------------------------------------------- a film with its places found

/** A point found in the region. */
interface Point { x: number; y: number; z: number }

interface ResolvedBeat {
  at: number;
  pose: PuppetPose | null;
  to: Point | null;
  move: number;
  face: Point | null;
  turn: number;
  visible: boolean | null;
}

interface ResolvedPuppet {
  actor: string;
  start: Point;
  facing: number;
  pose: PuppetPose;
  visible: boolean;
  beats: ResolvedBeat[];
}

/** A film with every place looked up once, so a frame is only arithmetic. */
export interface Cut {
  readonly film: Film;
  readonly length: number;
  /** When each shot starts, in film seconds. */
  readonly starts: readonly number[];
  /** The lens of each shot, from and to, and what it looks at, in the world. */
  readonly lenses: readonly { from: Point; to: Point; look: Point; lookTo: Point }[];
  readonly puppets: readonly ResolvedPuppet[];
  /** Where each actor stands and faces when play resumes. */
  readonly land: Readonly<Record<string, { x: number; y: number; z: number; facing: number }>>;
}

/** Looks up a place of the region by name. Null when the region has no such place. */
export type Places = (name: string) => Readonly<Vec3> | null;

/** Every place the film names, so a region without one of them plays nothing. */
export function placesOf(film: Film): string[] {
  const names = new Set<string>([film.place, film.trigger.near, film.setup.stand]);
  const spot = (s: Spot | undefined): void => void (s && names.add(s.place));
  for (const p of film.puppets) {
    spot(p.start);
    spot(p.face);
    for (const b of p.beats) { spot(b.to); spot(b.face); }
  }
  for (const end of Object.values(film.land)) { spot(end.at); spot(end.face); }
  return [...names];
}

/** The film with its places found, or null when the region lacks one of them. */
export function resolveFilm(film: Film, places: Places): Cut | null {
  for (const name of placesOf(film)) if (!places(name)) return null;
  const point = (spot: Spot): Point => {
    const base = places(spot.place)!;
    const o = spot.offset ?? [0, 0, 0];
    return { x: base.x + o[0], y: base.y + o[1], z: base.z + o[2] };
  };
  const home = places(film.place)!;
  const off = (o: readonly [number, number, number]): Point => ({ x: home.x + o[0], y: home.y + o[1], z: home.z + o[2] });
  const starts: number[] = [];
  let length = 0;
  for (const shot of film.shots) {
    starts.push(length);
    length += shot.seconds;
  }
  const lenses = film.shots.map((shot) => ({ from: off(shot.from), to: off(shot.to), look: off(shot.look), lookTo: off(shot.lookTo) }));
  const puppets = film.puppets.map((p): ResolvedPuppet => {
    const start = point(p.start), face = point(p.face);
    return {
      actor: p.actor, start, facing: facingTo(start.x, start.z, face.x, face.z), pose: p.pose, visible: p.visible,
      beats: p.beats.map((b) => ({
        at: b.at, pose: b.pose ?? null, to: b.to ? point(b.to) : null, move: b.move ?? 0,
        face: b.face ? point(b.face) : null, turn: b.turn ?? TURN, visible: b.visible ?? null,
      })),
    };
  });
  const land: Record<string, { x: number; y: number; z: number; facing: number }> = {};
  for (const [actor, end] of Object.entries(film.land)) {
    const p = point(end.at), f = point(end.face);
    land[actor] = { x: p.x, y: p.y, z: p.z, facing: facingTo(p.x, p.z, f.x, f.z) };
  }
  return { film, length, starts, lenses, puppets, land };
}

// ---------------------------------------------------------------- the frame

export interface PuppetFrame {
  /** The actor of the rules it stands for. */
  actor: string;
  visible: boolean;
  /** Where the feet are. */
  x: number;
  y: number;
  z: number;
  facing: number;
  /** The pose wanted, with what stands in for it. */
  pose: PuppetPose;
  /** Blocks walked since this walk began, so the steps follow the ground covered. -1 when it is not walking. */
  walked: number;
  /** Seconds since this pose began. */
  since: number;
}

export interface FilmFrame {
  /** The shot on screen, an index into the film's shots. */
  shot: number;
  /** How far through the shot the lens is, 0 to 1, eased. */
  move: number;
  /** Where the lens is and what it looks at, in the world, and its field of view. */
  lens: { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number; fov: number };
  /** 0 to 1: how far the lens has eased from the place above to the game's own camera. 1 is the game's camera. */
  land: number;
  /** Black over everything, the letterbox bars, the words: each 0 to 1. */
  black: number;
  bars: number;
  words: number;
  /** The words on screen in this shot, or empty. */
  text: string;
  puppets: PuppetFrame[];
  /** The fire's light, 1 burning well, and how it is drawn. */
  fire: number;
  fireLow: boolean;
  /** The hour, as `Ambient.timeOfDay`. */
  timeOfDay: number;
  /** The player's ambience and music, 0 to 1 of their volume, and the film's fire and held note. */
  world: number;
  music: number;
  fireSound: number;
  note: number;
  /** How many of the film's cues have started. */
  cues: number;
  /** True once play has resumed. */
  done: boolean;
}

export function newFrame(cut: Cut): FilmFrame {
  return {
    shot: 0, move: 0, lens: { x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: 0, fov: 20 }, land: 0,
    black: 1, bars: 1, words: 0, text: '',
    puppets: cut.puppets.map((p) => ({ actor: p.actor, visible: p.visible, x: p.start.x, y: p.start.y, z: p.start.z, facing: p.facing, pose: p.pose, walked: -1, since: 0 })),
    fire: 1, fireLow: false, timeOfDay: cut.film.sky[0], world: 1, music: 1, fireSound: 0, note: 0, cues: 0, done: false,
  };
}

export interface FrameOptions {
  /** Reduced motion: each shot holds one still, the lens at the middle of its move. */
  still?: boolean;
}

/** The shot playing at a time. */
function shotAt(cut: Cut, t: number): number {
  let shot = cut.starts.length - 1;
  while (shot > 0 && t < cut.starts[shot]) shot--;
  return shot;
}

/**
 * The whole frame of a film at `t` seconds: the lens, every puppet, the fire, the hour, the black, the bars,
 * the words and the sound. A pure function of the film and the time. `out` is filled and returned.
 */
export function filmFrame(cut: Cut, t: number, out: FilmFrame = newFrame(cut), options: FrameOptions = {}): FilmFrame {
  const film = cut.film, shots = film.shots;
  const time = t < 0 ? 0 : t > cut.length ? cut.length : t;
  const end = time >= cut.length;
  const shot = end ? shots.length - 1 : shotAt(cut, time);
  const def: FilmShot = shots[shot];
  const into = time - cut.starts[shot], left = def.seconds - into;
  const u = clamp01(into / def.seconds);
  const move = end ? 1 : options.still ? (def.land ? 1 : 0.5) : easeInOut(u);
  out.shot = shot;
  out.move = move;

  // The lens. The last shot is placed at its start here; the director eases it to the game's camera by `land`.
  const lens = cut.lenses[shot];
  const k = def.land ? 0 : move;
  out.lens.x = lens.from.x + (lens.to.x - lens.from.x) * k;
  out.lens.y = lens.from.y + (lens.to.y - lens.from.y) * k;
  out.lens.z = lens.from.z + (lens.to.z - lens.from.z) * k;
  out.lens.lookX = lens.look.x + (lens.lookTo.x - lens.look.x) * k;
  out.lens.lookY = lens.look.y + (lens.lookTo.y - lens.look.y) * k;
  out.lens.lookZ = lens.look.z + (lens.lookTo.z - lens.look.z) * k;
  out.lens.fov = def.fov + ((def.fovTo ?? def.fov) - def.fov) * k;
  out.land = def.land ? move : 0;

  // Black: up from black at the first shot, through black at a dip, nothing at a straight cut.
  let black = 0;
  if (def.enter === 'fade') black = Math.max(black, 1 - into / FADE_IN);
  if (def.enter === 'dip') black = Math.max(black, 1 - into / DIP);
  const next = shots[shot + 1];
  if (next && next.enter === 'dip') black = Math.max(black, 1 - left / DIP);
  out.black = end ? 0 : clamp01(black);
  out.bars = end ? 0 : def.land ? 1 - easeInOut(u) : 1;
  out.text = def.words ?? '';
  out.words = def.words && !end ? Math.min(clamp01((into - WORDS_IN) / WORDS_FADE), clamp01((left - WORDS_OUT) / WORDS_FADE)) : 0;

  // The puppets, beat by beat up to now.
  for (let i = 0; i < cut.puppets.length; i++) puppetAt(cut.puppets[i], time, out.puppets[i]);

  out.fire = trackAt(film.fire, time);
  out.fireLow = out.fire < LOW_FIRE;
  out.timeOfDay = film.sky[0] + (film.sky[1] - film.sky[0]) * (time / cut.length);
  out.world = trackAt(film.sound.world, time);
  out.music = trackAt(film.sound.music, time);
  out.fireSound = trackAt(film.sound.fire, time);
  out.note = trackAt(film.sound.note, time);
  let cues = 0;
  while (cues < film.sound.cues.length && film.sound.cues[cues].at <= time) cues++;
  out.cues = cues;
  out.done = end;
  return out;
}

function puppetAt(p: ResolvedPuppet, t: number, out: PuppetFrame): void {
  let x = p.start.x, y = p.start.y, z = p.start.z, facing = p.facing, pose = p.pose, visible = p.visible;
  let walked = -1, since = t;
  for (const beat of p.beats) {
    if (t < beat.at) break;
    const lt = t - beat.at;
    if (beat.visible !== null) visible = beat.visible;
    if (beat.pose) { pose = beat.pose; since = lt; }
    if (beat.to) {
      const dx = beat.to.x - x, dy = beat.to.y - y, dz = beat.to.z - z, length = Math.hypot(dx, dz);
      const along = beat.move > 0 ? walkAlong(lt / beat.move) : 1;
      if (length > 1e-6) facing = facingTo(x, z, beat.to.x, beat.to.z);
      x += dx * along;
      y += dy * along;
      z += dz * along;
      walked = along < 1 ? length * along : -1;
    }
    if (beat.face) {
      const goal = facingTo(x, z, beat.face.x, beat.face.z);
      facing += turnBetween(facing, goal) * easeInOut(clamp01(lt / beat.turn));
    }
  }
  out.visible = visible;
  out.x = x;
  out.y = y;
  out.z = z;
  out.facing = facing;
  out.pose = pose;
  out.walked = walked;
  out.since = since;
}

// ---------------------------------------------------------------- the clock

export interface FilmRun {
  readonly cut: Cut;
  /** Seconds since it began. */
  readonly time: number;
  readonly done: boolean;
  readonly skipped: boolean;
  /** Moves it on, in real seconds: the rules are paused while it plays. */
  advance(dt: number): void;
  /** Holds it at a moment, for `?cut-at=`. */
  seek(t: number): void;
  /** Ends it: a short dip to black, then the world as the film leaves it. Again does nothing. */
  skip(): void;
  /** The moment now. `out` is filled and returned. */
  frame(out: FilmFrame, options?: FrameOptions): FilmFrame;
}

export function createFilm(cut: Cut): FilmRun {
  let time = 0;
  let skippedAt = -1;
  const run: FilmRun = {
    cut,
    get time() { return time; },
    get done() { return skippedAt >= 0 ? time >= skippedAt + SKIP_DOWN + SKIP_UP : time >= cut.length; },
    get skipped() { return skippedAt >= 0; },
    advance(dt) { if (dt > 0 && !run.done) time += dt; },
    seek(t) { if (skippedAt < 0) time = Math.max(0, Math.min(cut.length, t)); },
    skip() { if (skippedAt < 0 && !run.done) skippedAt = time; },
    frame(out, options) {
      if (skippedAt < 0) return filmFrame(cut, time, out, options);
      const since = time - skippedAt;
      if (since < SKIP_DOWN) {
        // The moment holds while the screen goes dark, and no later sound starts.
        filmFrame(cut, skippedAt, out, options);
        out.black = Math.max(out.black, since / SKIP_DOWN);
        out.words *= 1 - since / SKIP_DOWN;
        return out;
      }
      // Under black the world is put as the film leaves it, and comes up with the bars going.
      const cues = filmFrame(cut, skippedAt, out, options).cues;
      filmFrame(cut, cut.length, out, options);
      out.cues = cues;
      if (run.done) return out;
      const up = clamp01((since - SKIP_DOWN) / SKIP_UP);
      out.black = 1 - up;
      out.bars = 1 - up;
      out.done = false;
      return out;
    },
  };
  return run;
}

/** Whether a flag that was just set in play starts this film. Never on a loaded save, and once per save. */
export function startsFilm(film: Film, flag: string, options: { flags: Flags; inPlay: boolean; near: number }): boolean {
  return options.inPlay && flag === film.trigger.flag && !options.flags.is(filmFlag(film)) && options.near <= film.trigger.within;
}

/** The film `?scene=<scene>` asks for, or null. */
export function filmForScene<F extends { scene: string }>(films: readonly F[], scene: string | null): F | null {
  return scene === null ? null : films.find((film) => film.scene === scene) ?? null;
}
