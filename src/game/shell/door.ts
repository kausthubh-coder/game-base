// The debug door: `window.__game`. This Mac draws a frame a second, so a test cannot play through the
// picture. It plays through here instead: it steps the rules without drawing, moves the player, presses
// keys and reads the state back as plain data. The table in docs/play/act1.md lists the calls.
import type { Vec3 } from '../../engine/types.ts';
import type { CostReport } from '../../features/perf/index.ts';
import { LANDMARKS, spawnPoint } from '../../features/world/index.ts';
import { BLOCKS } from '../../content/blocks.ts';
import type { Systems } from '../api.sim.ts';
import { STEP } from '../kernel.sim.ts';
import type { Shell } from './game.ts';
import type { CameraMode, CharacterLook } from './view.ts';

export interface DebugDoor {
  /** Plain data: player, clock, quests, bag, flags, counts of actors, and what the shell knows. */
  state(): Record<string, unknown>;
  /** Steps the simulation that many seconds without drawing. Returns the kernel steps it ran. */
  advance(seconds: number): number;
  /** Moves the player to a named place of the region, to `spawn`, or to x, y, z. Without y it stands on the ground. */
  teleport(place: string | number, y?: number, z?: number): Vec3 | null;
  /** Adds to the bag. Returns how many did not fit. */
  give(item: string, count?: number): number;
  /**
   * Presses a game key once: `e`, `q`, `r`, `1` to `9`, `space`, `f3`. With `down` it holds (`true`) or
   * lets go of (`false`) a key instead: `w`, `a`, `s`, `d`, `shift`, `space`.
   */
  key(name: string, down?: boolean): void;
  /**
   * Uses the held item on a block: `primary` breaks or gathers, holding until it breaks, `secondary` places or uses.
   * `face` is the side that was clicked as a step out of the block. The top by default.
   */
  click(button: 'primary' | 'secondary', x: number, y: number, z: number, face?: [number, number, number]): { used: boolean; broke: boolean };
  /** Runs the nearest prompt. False when there is none. */
  interact(): boolean;
  /** Clicks through the open conversation, taking the first choice. Returns the lines it passed. */
  talkThrough(): number;
  /** Puts the game at the start of a quest. */
  skipTo(quest: string): void;
  /** Draw calls, triangles, frame and simulation milliseconds, from the performance meter. */
  counters(): Record<string, number | string | boolean>;
  /**
   * The last frame's draw calls and triangles by feature (land, grass, trees, town and so on), the most triangles
   * first, with the part of each spent on shadows. `sum` adds the rows up, `total` is the renderer's own count, and
   * `addsUp` says they are equal.
   */
  costs(): CostReport;

  // ---- beyond the table: what a test needs around the calls above
  /** True when a game is running. */
  readonly started: boolean;
  newGame(): void;
  continueGame(): boolean;
  hasSave(): boolean;
  save(): boolean;
  /** Sets the time of day through the time system: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
  setTime(timeOfDay: number): void;
  /** Turns the 2.5D camera to the next quarter: 1 to the right, -1 to the left. */
  turn(direction: 1 | -1): void;
  /** The camera mode, as the View setting picks it: `tilt` (2.5D), `free` or `first`. Stored like the setting. */
  setCamera(mode: CameraMode): void;
  /** How characters are drawn, as the View setting picks it: `sprites` or `models`. Stored like the setting. */
  setCharacters(look: CharacterLook): void;
  /**
   * Free and first person: sets the view, in degrees. The 2.5D camera ignores it; drag it with the right button. `yaw` 0 looks north and 90 west; `pitch` is how far it looks
   * down, negative up. `distance` is the free camera's, in meters. Returns the camera as `state().camera` has it.
   */
  look(yaw: number, pitch: number, distance?: number): Record<string, unknown>;
  /** Free and first person: turns the view so the crosshair falls on this point. Returns the camera. */
  aimAt(x: number, y: number, z: number): Record<string, unknown>;
  /**
   * With `true` the frames stop stepping the rules, so only `advance` moves time and a test reads exact numbers.
   * The picture is still drawn. `false` hands time back to the frames.
   */
  manual(on?: boolean): void;
  /** Resolves after this many frames were drawn. */
  frames(count: number): Promise<void>;
  /** Resolves when the land in view is loaded and drawn. */
  settle(): Promise<void>;
  /** The block id and key at a cell. */
  block(x: number, y: number, z: number): { id: number; key: string };
  /** The whole view, for poking from the console. */
  readonly view: Shell['view'];
}

export function createDoor(shell: Shell): DebugDoor {
  const { view } = shell;
  const { game, kernel } = view;
  const sys = game.systems as Partial<Systems>;
  const sim = view.world.sim;
  /** Keys pressed with `key(name)` that have no press of their own: held for one step, then let go. */
  const tapped: string[] = [];

  function advance(seconds: number): number {
    if (!view.started) return 0;
    const steps = Math.max(0, Math.round(seconds / STEP));
    for (let i = 0; i < steps; i++) {
      shell.advance(1);
      for (const name of tapped.splice(0)) view.keys.hold(name, false);
    }
    return steps;
  }

  function named(place: string): Vec3 | null {
    if (place === 'spawn') return sys.region?.spawn() ?? spawnPoint();
    try {
      const found = sys.region?.place(place);
      if (found) return found.at;
    } catch {
      // The region does not know the name. A landmark of the bare world may.
    }
    return (LANDMARKS as Record<string, Vec3>)[place] ?? null;
  }

  const DEG = 180 / Math.PI;
  const round = (n: number): number => Math.round(n * 1000) / 1000;
  function cameraState(): Record<string, unknown> {
    const c = view.camera, at = view.ctx.camera.position;
    return {
      mode: view.settings.camera, quarter: c.quarter, zoom: c.zoom,
      yaw: round(c.yaw * DEG), pitch: round(c.pitch * DEG), distance: round(c.distance), reach: round(c.reach),
      at: { x: round(at.x), y: round(at.y), z: round(at.z) },
      mouse: view.keys.mouse, locked: view.keys.locked, dragging: view.keys.dragging, tiltTurn: view.settings.tiltTurn,
    };
  }

  const solid = (x: number, y: number, z: number): boolean => BLOCKS[sim.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))]?.solid === true;

  return {
    state() {
      const p = game.player;
      const byKind: Record<string, number> = {};
      for (const id of game.actors.keys()) {
        const kind = id.split(':')[0] as string;
        byKind[kind] = (byKind[kind] ?? 0) + 1;
      }
      let flags: Record<string, unknown> = {};
      try {
        flags = Object.fromEntries(kernel.save().flags);
      } catch {
        // A system that cannot save yet does not hide the rest of the state.
      }
      const line = sys.talk?.active ? sys.talk.current() : null;
      return {
        started: view.started,
        paused: view.paused,
        player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, facing: p.facing, onGround: p.onGround, inWater: p.inWater, busy: p.busy },
        clock: { ...game.clock },
        ambient: { ...game.ambient },
        quests: (sys.quests?.all() ?? []).map((q) => ({
          id: q.id, state: q.state,
          steps: q.steps.map((s) => ({ id: s.id, done: s.done, have: s.have, need: s.need })),
        })),
        tracked: sys.quests?.tracked()?.id ?? null,
        bag: (sys.inventory?.slots ?? []).filter((slot) => slot !== null).map((slot) => ({ id: slot.id, count: slot.count })),
        selected: sys.inventory?.selected ?? 0,
        held: sys.inventory?.held()?.id ?? null,
        flags,
        actors: { total: game.actors.size, ...byKind },
        talk: line ? { npc: line.npc, name: line.name, text: line.text, choices: line.choices } : null,
        prompt: sys.interact?.nearest()?.prompt() ?? null,
        breaking: sys.actions?.breaking() ?? null,
        aim: view.aim ? { x: view.aim.x, y: view.aim.y, z: view.aim.z, id: view.aim.id } : null,
        stats: view.stats(),
        camera: cameraState(),
        characters: view.settings.characters,
        sound: view.audio ? view.audio.debug().running : false,
        sprites: { count: view.sprites.count, missing: [...view.sprites.missing] },
        quality: view.ctx.quality,
        systems: shell.systems.installed,
        leftOut: shell.systems.leftOut,
        failed: Object.fromEntries(shell.systems.failed),
        viewErrors: shell.errors,
      };
    },

    advance,

    teleport(place, y, z) {
      let at: Vec3 | null;
      if (typeof place === 'string') {
        at = named(place);
        if (!at) return null;
        at = { ...at };
      } else {
        at = { x: place, y: y ?? NaN, z: z ?? 0 };
        if (z === undefined && y !== undefined) {
          // Two numbers are x and z.
          at.z = y;
          at.y = NaN;
        }
      }
      // A whole number is a block: stand in the middle of it.
      if (Number.isInteger(at.x)) at.x += 0.5;
      if (Number.isInteger(at.z)) at.z += 0.5;
      shell.place(at.x, Number.isFinite(at.y) ? at.y : 0, at.z);
      if (!Number.isFinite(at.y)) at.y = sim.heightAt(at.x, at.z);
      // Never inside a block: a named place may be the block to stand on, or the air above it.
      for (let lift = 0; lift < 6 && (solid(at.x, at.y, at.z) || solid(at.x, at.y + 1, at.z)); lift++) at.y = Math.floor(at.y) + 1;
      shell.place(at.x, at.y, at.z);
      return at;
    },

    give(item, count = 1) {
      return sys.inventory ? sys.inventory.add(item, count) : count;
    },

    key(name, down) {
      if (down !== undefined) {
        view.keys.hold(name, down);
      } else if (!view.keys.tap(name)) {
        view.keys.hold(name, true);
        tapped.push(name);
      }
    },

    click(button, x, y, z, face = [0, 1, 0]) {
      const actions = sys.actions;
      if (!actions) return { used: false, broke: false };
      const context = {
        hit: { x, y, z, nx: face[0], ny: face[1], nz: face[2], id: sim.getBlock(x, y, z), distance: 0 },
        held: sys.inventory?.held() ?? null,
        button,
      };
      const used = actions.use(context);
      let broke = false;
      // Breaking takes time: hold the button, a step at a time, until the block gives or five seconds pass.
      for (let i = 0; button === 'primary' && !broke && i < 100 && actions.breaking(); i++) {
        advance(STEP);
        broke = actions.hold(context, STEP);
      }
      return { used, broke };
    },

    interact: () => sys.interact?.act() ?? false,

    talkThrough() {
      const talk = sys.talk;
      let lines = 0;
      while (talk?.active && lines < 200) {
        const line = talk.current();
        if (line && line.choices.length > 0) talk.choose(0);
        else talk.advance();
        lines++;
      }
      return lines;
    },

    skipTo(quest) {
      sys.quests?.skipTo(quest);
    },

    counters() {
      const s = view.perf.snapshot;
      return {
        drawCalls: s.drawCalls, triangles: s.triangles, frameMs: s.frameMs, scriptMs: s.scriptMs, simMs: s.simMs,
        chunkMs: s.meshMs, chunks: s.chunks, quality: s.quality, renderScale: s.renderScale, auto: s.auto,
        sprites: view.sprites.count, particles: view.effects.live, programs: s.programs,
      };
    },

    costs: () => view.perf.costs.read(),

    get started() { return view.started; },
    newGame: () => view.newGame(),
    continueGame: () => view.continueGame(),
    hasSave: () => view.hasSave(),
    save: () => view.save(),
    setTime(timeOfDay) {
      if (sys.time) sys.time.setTimeOfDay(timeOfDay);
      else game.clock.timeOfDay = game.ambient.timeOfDay = timeOfDay;
    },
    turn: (direction) => view.camera.turn(direction),
    setCamera: (mode) => view.settings.setCamera(mode),
    setCharacters: (look) => view.settings.setCharacters(look),
    look(yaw, pitch, distance) {
      view.camera.setLook(yaw / DEG, pitch / DEG, distance);
      return cameraState();
    },
    aimAt(x, y, z) {
      view.camera.aimAt(x, y, z);
      return cameraState();
    },
    manual: (on = true) => view.setPaused('door', on),
    frames: (count) => shell.frames(count),
    settle: () => shell.settled(),
    block(x, y, z) {
      const id = sim.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      return { id, key: BLOCKS[id]?.key ?? '' };
    },
    view,
  };
}
