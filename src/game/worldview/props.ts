// The one file of the game that touches the props feature and src/content/props.ts, so when their API
// shifts, this is where it is mended.
//
// It makes one `Props` system for the whole game and hands every world view the same one, updates it once a
// frame, and keeps what it draws inside a budget of draw calls. A prop costs one draw call for each kind
// and variant in view, so the budget is kept by counting the kinds and variants that stand near the player:
// when one more would go over, the least important one standing gives up its place.
import type * as THREE from 'three';
import { PROPS, type PropKind } from '../../content/props.ts';
import { buildProp, createProps, jitterAt, scatter, type Jitter, type Props } from '../../features/props/index.ts';
import type { GameView } from '../shell/view.ts';

/** Draw calls the props may use, the two for their shadows included. */
export const PROP_DRAW_CALLS = 40;
/** The shadow balls and the shadow boxes are one call each. */
const SHADOW_CALLS = 2;

export interface ScatterSettings {
  /** 1 is the usual amount of everything. 0 leaves the land bare. */
  density: number;
  /** How much forest a place is, from 0 for open meadow to 1 for deep forest. Without it the scatter rules use slow noise of their own. */
  forest?: (x: number, z: number) => number;
  /** True where nothing may grow. */
  blocked?: (x: number, z: number) => boolean;
}

/** One thing the scatter rules put on the land. */
export interface Scattered {
  kind: string;
  variant: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  /** For a tree: the y of its top and how far its leaves reach from the trunk, as it is drawn. NaN and 0 for the rest. */
  top: number;
  reach: number;
}

export interface PropStats {
  /** Draw calls for the props in view, and for their shadows. */
  drawCalls: number;
  shadowCalls: number;
  triangles: number;
  /** Props standing in the world, and the ones in the cells in view. */
  placed: number;
  drawn: number;
  /** Kinds and variants that stand near the player now. Each one in view is a draw call. */
  models: number;
  /** Props taken away, left out or drawn as another variant to stay inside the budget. */
  trimmed: number;
}

export interface WorldProps {
  /** Everything the props draw hangs under this group. */
  readonly group: THREE.Group;
  /** True when the props feature has this kind. */
  has(kind: string): boolean;
  /**
   * Stands a prop and returns its handle, or 0 when it is not drawn: the kind is unknown, or the budget
   * is full of more important things. `must` is for what the game needs seen (a station, a berry bush, a
   * building's door): it is always drawn, and a scattered kind makes room for it.
   * `rotation` is radians around y, and at 0 the prop's front faces south (+z).
   */
  place(kind: string, variant: number, x: number, y: number, z: number, rotation?: number, scale?: number, must?: boolean): number;
  remove(handle: number): void;
  /** False once a prop was removed, or was taken away to make room in the budget. */
  alive(handle: number): boolean;
  /** How far a prop reaches along x and z at scale 1, whichever is longer. */
  span(kind: string, variant: number): number;
  /** Fills `out` with what the scatter rules put in this square of whole blocks. `x1` and `z1` are the first columns past it. */
  scatter(x0: number, z0: number, x1: number, z1: number, settings: ScatterSettings, out: Scattered[]): void;
  stats(): PropStats;
}

/**
 * Which variant a scattered prop is drawn as. The scatter rules use every variant of every kind, 36 draw
 * calls on their own. Folding the look-alikes together leaves 26 and room for the town.
 * A berry bush from the scatter rules becomes a plain bush: the only bushes with berries are the ones the
 * region lists, which can be picked.
 */
const WILD: Record<string, { kind: PropKind; variants: readonly number[] }> = {
  oak: { kind: 'oak', variants: [0, 1, 2] },
  birch: { kind: 'birch', variants: [0, 1, 0] },
  pine: { kind: 'pine', variants: [0, 1, 1] },
  grassTuft: { kind: 'grassTuft', variants: [0, 0, 2] },
  tallGrass: { kind: 'tallGrass', variants: [0] },
  flower: { kind: 'flower', variants: [0, 1, 2, 2, 4, 4] },
  reeds: { kind: 'reeds', variants: [0, 1] },
  lilyPad: { kind: 'lilyPad', variants: [1, 1] },
  mushroom: { kind: 'mushroom', variants: [0, 1, 1] },
  bush: { kind: 'bush', variants: [0, 1, 0] },
  berryBush: { kind: 'bush', variants: [0] },
  rock: { kind: 'rock', variants: [0, 1, 2, 1] },
  log: { kind: 'log', variants: [0] },
  stump: { kind: 'stump', variants: [0] },
};

/**
 * The scattered kinds and variants from the most important to the least. When the budget is full, the
 * last ones on this list that stand near the player go first. In the middle of the town, whose own props
 * are 29 kinds and variants, the first nine are what is left of the wild.
 */
const KEEP_ORDER = [
  'oak:0', 'grassTuft:0', 'reeds:0', 'flower:0', 'tallGrass:0', 'rock:1', 'birch:0', 'bush:0', 'pine:0',
  'flower:1', 'oak:1', 'grassTuft:2', 'flower:2', 'flower:4', 'rock:2', 'rock:0', 'lilyPad:1', 'reeds:1',
  'bush:1', 'mushroom:0', 'oak:2', 'birch:1', 'pine:1', 'log:0', 'stump:0', 'mushroom:1',
];
/** What the game needs seen comes before every scattered thing. */
const MUST = -1;

/** One kind and variant, and the props of it that stand near the player. */
interface Model {
  key: string;
  /** Its place in KEEP_ORDER. */
  rank: number;
  handles: Set<number>;
  /** The handles among them that were placed with `must`. */
  musts: Set<number>;
}

const known = (kind: string): kind is PropKind => Object.hasOwn(PROPS, kind);

function create(view: GameView): WorldProps {
  const props: Props = createProps(view.ctx);

  const live = new Map<string, Model>();
  const modelOf = new Map<number, Model>();
  const spans = new Map<string, number>();
  const at = { x: 0, y: 0, z: 0 };
  const jitter: Jitter = { turn: 0, size: 1, r: 1, g: 1, b: 1 };
  let trimmed = 0;
  const stats: PropStats = { drawCalls: 0, shadowCalls: 0, triangles: 0, placed: 0, drawn: 0, models: 0, trimmed: 0 };
  // The numbers ride on the group, so a test or the console reads them from the scene: scene.getObjectByName('props').userData.stats
  props.group.userData.stats = stats;

  const importance = (model: Model): number => (model.musts.size > 0 ? MUST : model.rank);
  const rankOf = (key: string): number => {
    const at = KEEP_ORDER.indexOf(key);
    return at < 0 ? KEEP_ORDER.length : at;
  };

  /** Takes every prop of a kind and variant away, so its draw call is free. Whoever placed them finds them gone through `alive`. */
  function evict(model: Model): void {
    for (const handle of model.handles) {
      props.remove(handle);
      modelOf.delete(handle);
    }
    trimmed += model.handles.size;
    live.delete(model.key);
  }

  const api: WorldProps = {
    group: props.group,
    has: known,

    place(kind, variant, x, y, z, rotation = 0, scale = 1, must = false) {
      if (!known(kind)) return 0;
      const def = PROPS[kind];
      let v = Number.isInteger(variant) && variant >= 0 && variant < def.variants.length ? variant : 0;
      let key = `${kind}:${v}`;
      let model = live.get(key);
      if (!model && live.size >= PROP_DRAW_CALLS - SHADOW_CALLS) {
        // The budget is full. The least important kind standing makes room, when it matters less than this one.
        const mine = must ? MUST : rankOf(key);
        let least: Model | null = null;
        for (const other of live.values()) if (importance(other) > mine && (!least || importance(other) > importance(least))) least = other;
        if (least) evict(least);
        else if (!must) {
          // Nothing matters less. Draw it as a variant of its kind that is standing, or not at all.
          let other = -1;
          for (let i = 0; i < def.variants.length && other < 0; i++) if (live.has(`${kind}:${i}`)) other = i;
          trimmed++;
          if (other < 0) return 0;
          v = other;
          key = `${kind}:${v}`;
          model = live.get(key);
        }
      }
      if (!model) live.set(key, (model = { key, rank: rankOf(key), handles: new Set(), musts: new Set() }));
      at.x = x; at.y = y; at.z = z;
      const handle = props.place(kind, v, at, rotation, scale);
      model.handles.add(handle);
      if (must) model.musts.add(handle);
      modelOf.set(handle, model);
      return handle;
    },

    remove(handle) {
      const model = modelOf.get(handle);
      if (!model) return;
      modelOf.delete(handle);
      props.remove(handle);
      model.handles.delete(handle);
      model.musts.delete(handle);
      if (model.handles.size === 0) live.delete(model.key);
    },

    alive: (handle) => modelOf.has(handle),

    span(kind, variant) {
      const key = `${kind}:${variant}`;
      let span = spans.get(key);
      if (span === undefined) {
        span = 1;
        if (known(kind)) {
          const geometry = buildProp(kind, variant);
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          if (box) span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
          geometry.dispose();
        }
        spans.set(key, span);
      }
      return span;
    },

    scatter(x0, z0, x1, z1, settings, out) {
      out.length = 0;
      const found = scatter(view.world.sim.seed, view.world.query, {
        area: { x0, z0, x1, z1 },
        density: settings.density,
        forest: settings.forest,
        blocked: settings.blocked,
        waterLevel: (x, z) => waterTop(view, x, z),
      });
      for (const p of found.props) {
        const wild = WILD[p.kind];
        if (!wild) continue;
        const variant = wild.variants[p.variant] ?? wild.variants[0] as number;
        const crown = (PROPS[wild.kind] as { crown?: readonly { top: number; reach: number }[] }).crown?.[variant];
        // The size a tree is drawn at includes the small change every placed prop gets.
        const size = crown ? p.scale * jitterAt(PROPS[wild.kind].vary, p.x, p.y, p.z, jitter).size : 0;
        out.push({
          kind: wild.kind, variant, x: p.x, y: p.y, z: p.z, rotation: p.rotation, scale: p.scale,
          top: crown ? p.y + crown.top * size : NaN, reach: crown ? crown.reach * size : 0,
        });
      }
    },

    stats() {
      const s = props.stats();
      stats.drawCalls = s.drawCalls;
      stats.shadowCalls = s.shadowCalls;
      stats.triangles = s.triangles + s.shadowTriangles;
      stats.placed = s.placed;
      stats.drawn = s.drawn;
      stats.models = live.size;
      stats.trimmed = trimmed;
      return stats;
    },
  };

  view.onFrame((dt) => {
    props.update(dt, view.ctx);
    api.stats();
  });
  return api;
}

/** The world draws the top of its water this far below the top of the block. */
const WATER_DIP = 0.12;

/** The y of the water's surface as it is drawn in a water column, or undefined on land. */
export function waterTop(view: GameView, x: number, z: number): number | undefined {
  const sim = view.world.sim;
  if (sim.surfaceAt(x, z) !== 'water') return undefined;
  const fx = Math.floor(x), fz = Math.floor(z);
  let y = sim.heightAt(x, z);
  const water = sim.getBlock(fx, y, fz);
  while (y < 63 && sim.getBlock(fx, y + 1, fz) === water) y++;
  return y + 1 - WATER_DIP;
}

const made = new WeakMap<GameView, WorldProps>();

/** The game's props. Every view that asks gets the same ones. */
export function worldProps(view: GameView): WorldProps {
  let props = made.get(view);
  if (!props) made.set(view, (props = create(view)));
  return props;
}
