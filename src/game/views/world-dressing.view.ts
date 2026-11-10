import { loadEnvironmentModels } from '../../features/props/models.view.ts';
// Dresses the land with props: the region's building props and berry bushes, and trees, grass, flowers,
// rocks and reeds from the props feature's scatter rules.
//
// The land is dressed chunk by chunk around the player, as the world loads its chunks, and undressed
// behind them. A chunk's props stay true to its blocks: when a block in the chunk changes (tilled soil,
// a placed block, a station), every prop whose ground is no longer what it grew on is taken away.
// Nothing is scattered where the region says not to.
import type { Vec3 } from '../../engine/types.ts';
import type { RegionProp } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { worldProps, type Scattered } from '../worldview/props.ts';
import { berryBushes, buildingProps, scatterSettings } from '../worldview/region.ts';

const CHUNK = 16;
/** Chunks dressed around the player's chunk, each way. The farthest zoom shows about 30 blocks each way. */
const REACH = 3;
/** A chunk farther than this from the player's chunk is undressed. */
const KEEP = REACH + 1;
/** Milliseconds a frame may spend dressing chunks, after the first one. */
const BUDGET_MS = 3;
/** A bush that can be picked is drawn a little larger than a scattered one, so its berries show from the usual zoom. */
const BUSH_SIZE = 1.2;
/** Leaves that fall each second around the player in still air and in a full wind. */
const LEAVES_CALM = 0.35, LEAVES_WINDY = 2.4;

/** The offsets of the chunks to dress, nearest first, as pairs. */
const RING = (() => {
  const pairs: [number, number][] = [];
  for (let dx = -REACH; dx <= REACH; dx++) for (let dz = -REACH; dz <= REACH; dz++) pairs.push([dx, dz]);
  pairs.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
  return Int8Array.from(pairs.flat());
})();

const chunkKey = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);

/** One dressed chunk. */
interface Patch {
  cx: number;
  cz: number;
  /** The world's chunk it was dressed from, and that chunk's revision then. A reload or an edit shows as a difference. */
  chunk: object;
  rev: number;
  /** The scattered props, and for each the ground it grew on. */
  handles: number[];
  xs: number[];
  zs: number[];
  ground: number[];
  surface: string[];
  /** The region's props in this chunk. They stay whatever the ground does. */
  fixed: number[];
  /** The tops of its trees, for leaves to fall from. */
  tops: { x: number; y: number; z: number; reach: number; handle: number }[];
}

interface ShownBush {
  x: number;
  y: number;
  z: number;
  ripe: boolean;
  /** True while it is close enough to the player to be drawn. */
  near: boolean;
  handle: number;
}

export async function install(view: GameView): Promise<void> {
  await loadEnvironmentModels();
  const { game } = view;
  const sim = view.world.sim;
  const props = worldProps(view);
  const patches = new Map<number, Patch>();
  const patchList: Patch[] = [];
  const found: Scattered[] = [];
  let lastCx = NaN, lastCz = NaN;

  // ---------------------------------------------------------------- the region's props, by chunk
  let fixedCount = -1, fixedFirst: RegionProp | undefined, fixedLast: RegionProp | undefined;
  const fixedBy = new Map<number, RegionProp[]>();

  /** Sorts the region's props into chunks again when the list has changed. True when it has. */
  function sortFixed(): boolean {
    const list = buildingProps(game);
    // A region may hand out a new array on every call, so the list is known by its length and its ends.
    if (list.length === fixedCount && list[0] === fixedFirst && list[list.length - 1] === fixedLast) return false;
    fixedCount = list.length;
    fixedFirst = list[0];
    fixedLast = list[list.length - 1];
    fixedBy.clear();
    for (const p of list) {
      if (typeof p?.kind !== 'string' || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) continue;
      const key = chunkKey(Math.floor(p.x) >> 4, Math.floor(p.z) >> 4);
      const bucket = fixedBy.get(key);
      if (bucket) bucket.push(p);
      else fixedBy.set(key, [p]);
    }
    return true;
  }

  // ---------------------------------------------------------------- dressing one chunk
  function undress(patch: Patch): void {
    for (const handle of patch.handles) props.remove(handle);
    for (const handle of patch.fixed) props.remove(handle);
    patches.delete(chunkKey(patch.cx, patch.cz));
    patchList.splice(patchList.indexOf(patch), 1);
  }

  function dress(cx: number, cz: number, chunk: { rev: number }): void {
    const patch: Patch = { cx, cz, chunk, rev: chunk.rev, handles: [], xs: [], zs: [], ground: [], surface: [], fixed: [], tops: [] };
    try {
      props.scatter(cx * CHUNK, cz * CHUNK, (cx + 1) * CHUNK, (cz + 1) * CHUNK, scatterSettings(game), found);
    } catch (error) {
      console.warn('[dressing] the scatter rules threw for a chunk, so it stays bare:', error);
      found.length = 0;
    }
    for (const p of found) {
      const handle = props.place(p.kind, p.variant, p.x, p.y, p.z, p.rotation, p.scale);
      if (handle === 0) continue;
      patch.handles.push(handle);
      patch.xs.push(p.x);
      patch.zs.push(p.z);
      patch.ground.push(sim.heightAt(p.x, p.z));
      patch.surface.push(sim.surfaceAt(p.x, p.z));
      if (p.reach > 0) patch.tops.push({ x: p.x, y: p.top, z: p.z, reach: p.reach, handle });
    }
    for (const p of fixedBy.get(chunkKey(cx, cz)) ?? []) {
      const handle = props.place(p.kind, p.variant ?? 0, p.x, p.y, p.z, p.rotation ?? 0, p.scale ?? 1, true);
      if (handle !== 0) patch.fixed.push(handle);
    }
    patches.set(chunkKey(cx, cz), patch);
    patchList.push(patch);
  }

  /** Takes away the props whose ground changed since they were scattered. */
  function check(patch: Patch, rev: number): void {
    patch.rev = rev;
    for (let i = patch.handles.length - 1; i >= 0; i--) {
      const x = patch.xs[i], z = patch.zs[i];
      if (sim.heightAt(x, z) === patch.ground[i] && sim.surfaceAt(x, z) === patch.surface[i]) continue;
      const handle = patch.handles[i];
      props.remove(handle);
      const last = patch.handles.length - 1;
      patch.handles[i] = patch.handles[last]; patch.xs[i] = patch.xs[last]; patch.zs[i] = patch.zs[last];
      patch.ground[i] = patch.ground[last]; patch.surface[i] = patch.surface[last];
      patch.handles.length = patch.xs.length = patch.zs.length = patch.ground.length = patch.surface.length = last;
      const at = patch.tops.findIndex((t) => t.handle === handle);
      if (at >= 0) patch.tops.splice(at, 1);
    }
  }

  // ---------------------------------------------------------------- berry bushes
  // The region keeps one object for each bush and changes `ripe` in place, with no event. So each frame the
  // list is compared with what is drawn. There are a dozen bushes. One far from the player is not drawn,
  // so its two kinds of prop do not count against the budget in the town.
  const shownBushes: ShownBush[] = [];

  function syncBushes(pcx: number, pcz: number): void {
    const list = berryBushes(game);
    for (let i = 0; i < list.length; i++) {
      const bush = list[i];
      let s = shownBushes[i];
      if (!s) shownBushes[i] = s = { x: NaN, y: NaN, z: NaN, ripe: false, near: false, handle: 0 };
      const near = Math.abs((Math.floor(bush.x) >> 4) - pcx) <= KEEP && Math.abs((Math.floor(bush.z) >> 4) - pcz) <= KEEP;
      if (s.x === bush.x && s.y === bush.y && s.z === bush.z && s.ripe === bush.ripe && s.near === near) continue;
      props.remove(s.handle);
      s.x = bush.x; s.y = bush.y; s.z = bush.z; s.ripe = bush.ripe; s.near = near;
      // The plain bush has the berry bush's shape, and both get the same turn and size from where they stand,
      // so the bush does not jump when its berries go.
      s.handle = near ? props.place(bush.ripe ? 'berryBush' : 'bush', 0, bush.x, bush.y, bush.z, 0, BUSH_SIZE, true) : 0;
    }
    while (shownBushes.length > list.length) props.remove(shownBushes.pop()!.handle);
  }

  // ---------------------------------------------------------------- falling leaves
  // The effects feature drops its own leaves from the air around the hero. These come from the tree tops,
  // one at a time, so a leaf is seen to leave a tree. `view` has no way to hand the tops to the weather.
  let owed = 0, pick = 0x2545f491;
  const from: Vec3 = { x: 0, y: 0, z: 0 };
  const random = (): number => {
    pick ^= pick << 13; pick ^= pick >>> 17; pick ^= pick << 5;
    return (pick >>> 0) / 4294967296;
  };

  function dropLeaves(dt: number): void {
    const a = view.ctx.ambient;
    owed += dt * (LEAVES_CALM + (LEAVES_WINDY - LEAVES_CALM) * a.wind) * (1 - a.rain);
    while (owed >= 1) {
      owed -= 1;
      // A chunk near the player, then a tree in it. A chunk with no tree drops nothing this time.
      const patch = patches.get(chunkKey(lastCx + Math.floor(random() * 3) - 1, lastCz + Math.floor(random() * 3) - 1));
      if (!patch || patch.tops.length === 0) continue;
      const at = Math.floor(random() * patch.tops.length), top = patch.tops[at];
      // The tree was taken away to keep the props inside their budget: no leaf falls from it again.
      if (!props.alive(top.handle)) {
        patch.tops.splice(at, 1);
        continue;
      }
      const turn = random() * Math.PI * 2, out = top.reach * Math.sqrt(random());
      from.x = top.x + Math.cos(turn) * out;
      from.y = top.y - 0.6 - random() * 1.2;
      from.z = top.z + Math.sin(turn) * out;
      view.effects.play('leaf', from, { scale: 0.2 });
    }
  }

  // ---------------------------------------------------------------- one frame
  view.onFrame((dt) => {
    const p = view.playerPosition;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    // A new list of the region's props dresses every chunk again.
    if (sortFixed()) while (patchList.length > 0) undress(patchList[0]);

    const start = performance.now();
    let made = 0;
    for (let i = 0; i < RING.length; i += 2) {
      const cx = pcx + RING[i], cz = pcz + RING[i + 1];
      const chunk = sim.chunkAt(cx, cz);
      if (!chunk) continue;
      const patch = patches.get(chunkKey(cx, cz));
      if (patch && patch.chunk === chunk) {
        if (patch.rev !== chunk.rev) check(patch, chunk.rev);
        continue;
      }
      // The scatter rules look one column past the chunk's edge, so the chunks beside it must be there too.
      if (!sim.chunkAt(cx - 1, cz) || !sim.chunkAt(cx + 1, cz) || !sim.chunkAt(cx, cz - 1) || !sim.chunkAt(cx, cz + 1)) continue;
      if (made > 0 && performance.now() - start > BUDGET_MS) continue;
      if (patch) undress(patch);
      dress(cx, cz, chunk);
      made++;
    }

    if (pcx !== lastCx || pcz !== lastCz) {
      lastCx = pcx;
      lastCz = pcz;
      for (let i = patchList.length - 1; i >= 0; i--) {
        const patch = patchList[i];
        if (Math.abs(patch.cx - pcx) > KEEP || Math.abs(patch.cz - pcz) > KEEP) undress(patch);
      }
    }

    syncBushes(pcx, pcz);
    if (view.started && !view.paused) dropLeaves(dt);

  });
}
