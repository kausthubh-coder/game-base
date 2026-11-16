// The painted world in the game: the land drawn smooth with grass on it, leafy trees, far hills and painted
// clouds, all lit by one painted light. It is on unless the address says `?look=blocks`, which draws the
// ground as blocks and the trees as models again.
//
// This view feeds the painted feature from the game: the block world gives the near land its shape and the
// terrain's own functions give the far land and its woods theirs, the trees system says where trees stand, the sky gives the sun's direction and how much of it is shadow, and the
// clock gives the colour of the light.
//
// The plan of Greenhollow says which kind of land every column is and how grey (src/game/region/greenhollow.sim.ts).
// The land, the grass, the far land and the trees are painted by it, the small things of each kind grow on it,
// and the air round the hero takes the kind it stands in: green shade and shafts of sun in the old forest,
// ash in the grey, mist and lanternflies in the marsh. `?grey=a` or `?grey=b` picks the grey forest's look, and
// `?wildtrees=1` previews the old oaks and willows on today's trees until the land grows its own.
//
// The grey follows the story (src/game/region/story.sim.ts): the land under the relit road, a ring round each of
// the Order's pumps while it stands, and the grey forest until the Stag is freed. Your plot is pale, tired grass
// when you arrive, and greens outward from whatever you tend: tilled ground and water, `land.green` blocks round
// them. When the story changes the land, its tiles are made again, a few a frame.
import * as THREE from 'three';
import { groundCameraRise } from '../../features/painted/ground-camera.ts';
import { EMERALD, FAR_TREES, FOREST_SHAFTS, GREAT_OAK, GREY_LOOKS, HAZE, KIND_AIR, KIND_LEAVES, PAINTED_WATER, SKY, MOODS, PAINTED_TREES, TREE_NEAR, TREE_REACH, WILDS, type GreyLook, type Mood, type PaintedVariant } from '../../content/painted.ts';
import type { EffectId } from '../../content/effects.ts';
import { QUALITY } from '../../content/quality.ts';
import { PROPS } from '../../content/props.ts';
import { STANDING_STONE, buildTree, createBackdrop, createBoulders, createBushes, createFarLand, createGrass, createImpostors, createLand, createShafts, createStand, createWater, createWilds, foliageMaterials, loadTextures, shared, type LandBlocks, type Nature, type Placement, type Sitter, type SkyWeather, type Stand, type TreeSpec } from '../../features/painted/index.ts';
import { buildProp } from '../../features/props/index.ts';
import { BIOMES } from '../content/greenhollow.ts';
import { biomeMix, blightAt } from '../region/greenhollow.sim.ts';
import { readLandState, type LandState } from '../region/story.sim.ts';
import { blockId } from '../../content/blocks.ts';
import { WATER_LEVEL, forestAt, groundHeight, landHeight, surfaceAt, treesInArea } from '../../features/world/index.ts';
import { REGION } from '../content/region.ts';
import type { ModelTree } from '../trees/index.sim.ts';
import type { Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The sprays of leaflets sit at every depth in the crown and under it too, so the crown is leaves all the way through. */
const leafy = (spec: TreeSpec & { scale?: number }, twigs = false): TreeSpec => ({ ...spec, twigs, card: Math.max(0.62 * (spec.scale ?? 1), Math.min(1.0 * (spec.scale ?? 1), spec.card * 0.76)), cover: 1.9, inset: [0.6, 1.08], core: 0.55, coreColor: '#1d8c58', under: -0.8 });
/** Trees far off: the same shapes in fewer, larger cards. */
const far = (spec: TreeSpec): TreeSpec => ({ ...spec, card: spec.card * 1.9, cover: 1.3 });
/** The top of a tree's crown, in meters at a scale of 1. */
const topOf = (spec: TreeSpec): number => Math.max(spec.crown * spec.squash * 0.75, spec.height - spec.crown * spec.squash * 0.5) + spec.crown * spec.squash;

/** How far the camera sees: past the far land to the last ridge. */
const FAR_PLANE = 760;

/** A number from 0 to 1 that depends only on the column, so a tree keeps its turn and tint. */
function own(x: number, z: number, salt: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mix3 = (a: readonly number[], b: readonly number[], t: number, out: THREE.Color): THREE.Color =>
  out.setRGB((a[0] as number) + ((b[0] as number) - (a[0] as number)) * t, (a[1] as number) + ((b[1] as number) - (a[1] as number)) * t, (a[2] as number) + ((b[2] as number) - (a[2] as number)) * t);

export async function install(view: GameView): Promise<void> {
  if (!view.painted) return;
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const sim = view.world.sim;
  // The paintings the manifest lists. The kinds of land's own are asked for only once they are listed there.
  const listed = await fetch('./assets/manifest.json').then((r) => r.json() as Promise<{ painted?: { textures?: Record<string, string> } }>).then((m) => Object.keys(m.painted?.textures ?? {}), () => [] as string[]);
  const textures = await loadTextures('./assets/painted/', listed);
  shared.uBrush.value = textures.brush;
  const params = new URLSearchParams(location.search);
  // The grey forest's two looks: Kausthubh picks. `a` unless the address asks for `b`.
  const greyLook: GreyLook = params.get('grey') === 'b' ? 'b' : 'a';
  const greyness = GREY_LOOKS[greyLook];
  shared.uGreyLeaf.value.set(greyness.leaf); shared.uGreyBark.value.set(greyness.bark);
  shared.uGreyDrain.value = greyness.drain; shared.uGreyThin.value = greyness.thin;
  // ---------------------------------------------------------------- the story on the land
  let story: LandState = readLandState(game.flags);
  /** Bumped when the story changes the land: every tile's revision moves with it, so each is made again. */
  let epoch = 0;
  // Your plot's tired grass, and how far each column of it is from tended ground (tilled soil, water), worked out
  // over the plot and a margin round it whenever a chunk there changes or the green reaches further.
  const g = REGION.grant, TIRED = 0.5, MARGIN = 14;
  const plot = { x0: g.x - MARGIN, z0: g.z - MARGIN, w: g.width + MARGIN * 2, h: g.depth + MARGIN * 2 };
  const tendedFrom = new Float32Array(plot.w * plot.h);
  const TILLED = blockId('tilled_soil'), WATER = blockId('water');
  let plotStamp = '';
  function measureTended(): void {
    const big = 1e6;
    for (let j = 0; j < plot.h; j++) for (let i = 0; i < plot.w; i++) {
      const x = plot.x0 + i, z = plot.z0 + j, top = sim.heightAt(x, z);
      const b = sim.getBlock(x, top - 1, z), above = sim.getBlock(x, top, z);
      tendedFrom[j * plot.w + i] = b === TILLED || b === WATER || above === WATER ? 0 : big;
    }
    // Two passes of a chamfer: the distance in blocks to the nearest tended column.
    const at = (i: number, j: number): number => (i < 0 || j < 0 || i >= plot.w || j >= plot.h ? big : tendedFrom[j * plot.w + i] as number);
    for (let j = 0; j < plot.h; j++) for (let i = 0; i < plot.w; i++) {
      const k = j * plot.w + i;
      tendedFrom[k] = Math.min(tendedFrom[k] as number, at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + Math.SQRT2, at(i + 1, j - 1) + Math.SQRT2);
    }
    for (let j = plot.h - 1; j >= 0; j--) for (let i = plot.w - 1; i >= 0; i--) {
      const k = j * plot.w + i;
      tendedFrom[k] = Math.min(tendedFrom[k] as number, at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + Math.SQRT2, at(i - 1, j + 1) + Math.SQRT2);
    }
  }
  /** How tired the grass is at a column: pale on your plot and round it, green again near what you tend. */
  function tiredAt(x: number, z: number): number {
    const i = Math.floor(x) - plot.x0, j = Math.floor(z) - plot.z0;
    if (i < 0 || j < 0 || i >= plot.w || j >= plot.h) return 0;
    // Full on the plot, easing off over the margin.
    const ox = Math.max(0, g.x - x, x - (g.x + g.width)), oz = Math.max(0, g.z - z, z - (g.z + g.depth));
    const edge = Math.max(0, 1 - Math.hypot(ox, oz) / MARGIN);
    const tended = tendedFrom[j * plot.w + i] as number;
    const green = Math.min(1, Math.max(0, (tended - story.green + 2) / 4));
    return TIRED * edge * edge * (3 - 2 * edge) * green;
  }
  const greyAt = (x: number, z: number): number => Math.max(blightAt(x, z, story.relit, story.healed, story.pumps), tiredAt(x, z));
  /** Looks at the story and the plot's chunks; when either changed, the land is painted again. */
  function watchStory(): void {
    const next = readLandState(game.flags);
    let stamp = `${next.green}`;
    for (let cx = plot.x0 >> 4; cx <= (plot.x0 + plot.w) >> 4; cx++) for (let cz = plot.z0 >> 4; cz <= (plot.z0 + plot.h) >> 4; cz++) stamp += `,${sim.chunkAt(cx, cz)?.rev ?? -1}`;
    const changed = next.relit !== story.relit || next.healed !== story.healed || next.pumps !== story.pumps || next.green !== story.green;
    story = next;
    if (stamp !== plotStamp) { plotStamp = stamp; measureTended(); epoch++; } else if (changed) epoch++;
    if (changed) squares.clear();
  }
  watchStory();
  const nature: Nature = { kinds: BIOMES, mix: (x, z, out) => biomeMix(x, z, out), grey: greyAt };
  const mixOut = new Float32Array(BIOMES.length);
  const share = (kind: string, x: number, z: number): number => biomeMix(x, z, mixOut)[BIOMES.indexOf(kind as (typeof BIOMES)[number])] ?? 0;

  // ---------------------------------------------------------------- the land and what grows on it
  const blocks: LandBlocks = {
    getBlock: (x, y, z) => sim.getBlock(x, y, z),
    heightAt: (x, z) => sim.heightAt(x, z),
    groundAt: (x, z) => groundHeight(sim.seed, x, z),
    glowAt: (x, y, z) => sim.blockLightAt(x, y, z) / 15,
    // A chunk's own revision, moved on each time the story repaints the land.
    revision: (cx, cz) => { const rev = sim.chunkAt(cx, cz)?.rev ?? -1; return rev < 0 ? -1 : rev + epoch * 1_000_003; },
  };
  const land = createLand(blocks, textures, view.look === 'steps', nature);
  // The water is a sheet at its own level that the land rises through. The block world's square water is left
  // out, and the rings the game starts on it (a foot, a thrown stone) spread on this water instead.
  const waterRings = view.water.material.uniforms as { uRipples?: { value: THREE.Vector4[] }; uTime?: { value: number } };
  const water = createWater(blocks, land, PAINTED_WATER, waterRings.uRipples && waterRings.uTime ? { rings: waterRings.uRipples, time: waterRings.uTime } : undefined);
  view.water.material.visible = false;
  let grassLevel = view.ctx.quality;
  const grass = createGrass(land, textures, grassLevel);
  const backdrop = createBackdrop(textures);
  // Past the land the game holds in memory, the same hills and rivers drawn from the land's shape alone.
  const farLand = createFarLand({
    heightAt: (x, z) => landHeight(sim.seed, x, z),
    topAt: (x, z) => surfaceAt(sim.seed, x, z),
    forestAt: (x, z) => forestAt(sim.seed, x, z),
    waterLevel: WATER_LEVEL,
    water: PAINTED_WATER.far,
    nature,
  }, textures, QUALITY[view.ctx.quality].farLandCell);
  view.scene.add(land.group, grass.group, backdrop.group, farLand.group, water.group);
  view.setGround((x, z) => land.heightAt(x, z));

  // ---------------------------------------------------------------- the trees
  // Each kind and variant is one shape, drawn leaf by leaf near the hero and in fewer, larger cards far off.
  interface Kind { near: Stand; far: Stand; top: number; nearPlaces: Placement[]; farPlaces: Placement[]; index: number; spec: TreeSpec; materials: ReturnType<typeof foliageMaterials>; own: boolean }
  const kinds = new Map<string, Kind>();
  const sitters: Sitter[] = [];
  const trees = new THREE.Group();
  trees.name = 'painted-trees';
  const foliage = [0, 1, 2].map((spray) => foliageMaterials(textures, { mask: textures.rosettes[spray] as THREE.Texture, tones: [...EMERALD], vary: 0.3, top: 0.25 }));
  // The old oaks and the willows wear their own painted leaves and bark, one set of materials a kind.
  const ownFoliage = new Map<string, (typeof foliage)[number]>();
  const materialsOf = (kind: string, v: PaintedVariant): (typeof foliage)[number] => {
    if (!v.tones) return foliage[v.spray] as (typeof foliage)[number];
    let made = ownFoliage.get(kind);
    if (!made) {
      const painted = kind === 'willow' ? textures.paintings['leaves-willow'] : textures.paintings['leaves-old'];
      made = foliageMaterials(textures, {
        mask: painted, painted: true, hang: v.hang, tones: [...v.tones], vary: 0.3, top: 0.25,
        bark: kind === 'oldOak' ? textures.paintings['bark-old'] : undefined, barkMean: kind === 'oldOak' ? textures.means['bark-old'] : undefined,
      });
      ownFoliage.set(kind, made);
    }
    return made;
  };
  /** Kinds drawn at their own size, whatever box the rules give them, and how large that is. */
  const ownSize = new Set<string>();
  // Two variants with the same shape in the same leaves (an elm is an oak's and a birch's) share one stand, so
  // they cost one set of draw calls. `unique` holds each stand's kind once.
  const unique: Kind[] = [];
  const treeVariants = PAINTED_TREES as Record<string, readonly PaintedVariant[]>;
  for (const [kind, variants] of Object.entries(PAINTED_TREES)) {
    variants.forEach((v, variant) => {
      const materials = materialsOf(kind, v), spec = v.spec;
      const twin = unique.find((k) => k.spec === spec && k.materials === materials && k.own === !!v.own);
      if (twin) {
        kinds.set(`${kind}:${variant}`, twin);
        if (v.own) ownSize.add(`${kind}:${variant}`);
        return;
      }
      // How many variants share this one: its stands hold room for all of them.
      let share = 0;
      for (const [other, list] of Object.entries(treeVariants)) for (const w of list) if (w.spec === spec && materialsOf(other, w) === materials && !!w.own === !!v.own) share++;
      // A dying crown (`?grey=b`) shows the twigs inside it; a full one hides them, so they are built only then.
      const farShape = buildTree(far(leafy(spec, greyLook === 'b')));
      // An old oak's crown is large and few stand near at once.
      const near = createStand(buildTree(leafy(spec, greyLook === 'b')), materials, (v.own ? 24 : 64) * share, true), distant = createStand(farShape, materials, (v.own ? 64 : 192) * share, false);
      trees.add(near.group, distant.group);
      const made: Kind = { near, far: distant, top: topOf(spec), nearPlaces: [], farPlaces: [], index: sitters.length, spec, materials, own: !!v.own };
      kinds.set(`${kind}:${variant}`, made);
      unique.push(made);
      if (v.own) ownSize.add(`${kind}:${variant}`);
      sitters.push({ shape: farShape, stand: distant });
    });
  }
  // `?wildtrees=1`: until the land grows old oaks and willows, today's trees in the old forest and the marsh are
  // drawn as them, to judge how they look. Only the drawing changes; the rules' trees stay where they are.
  const preview = params.get('wildtrees') === '1';
  // In the old forest one tree in four becomes an old oak and the rest are not drawn, so the old oaks stand as
  // a grove with room under their crowns. An empty key is a tree not drawn.
  function kindKey(kind: string, variant: number, x: number, z: number): string {
    if (!preview || (kind !== 'oak' && kind !== 'birch' && kind !== 'pine')) return `${kind}:${variant}`;
    if (share('oldForest', x, z) > 0.5) return own(Math.floor(x), Math.floor(z), 9) < 0.25 ? `oldOak:${variant}` : '';
    if (share('marsh', x, z) > 0.5) return `willow:${variant}`;
    return `${kind}:${variant}`;
  }
  /** The tint of a tree's leaves in the kind of land it stands in. */
  const kindTint = (x: number, z: number, out: THREE.Color): THREE.Color => {
    biomeMix(x, z, mixOut);
    let r = 0, g = 0, b = 0;
    BIOMES.forEach((name, i) => {
      const w = mixOut[i] as number, t = KIND_LEAVES[name] ?? [1, 1, 1];
      r += w * t[0]; g += w * t[1]; b += w * t[2];
    });
    return out.multiply(tintScratch.setRGB(r, g, b));
  };
  const tintScratch = new THREE.Color();
  view.scene.add(trees);
  // The Hollow Oak stands where the region plan has its prop, and is drawn leaf by leaf from any distance.
  const oaks = (sys.region?.props?.() ?? []).filter((prop) => prop.kind === GREAT_OAK.prop);
  if (oaks.length > 0) {
    const always = foliageMaterials(textures, { mask: textures.rosettes[0] as THREE.Texture, tones: [...EMERALD], vary: 0.3, top: 0.3, always: true });
    const great = createStand(buildTree(leafy(GREAT_OAK.spec)), always, oaks.length, true);
    great.plant(oaks.map((prop) => ({ x: prop.x, y: prop.y - 0.15, z: prop.z, scale: GREAT_OAK.scale, turn: prop.rotation, tint: new THREE.Color(1.03, 1, 0.96) })));
    great.group.name = 'great-oak';
    view.scene.add(great.group);
    // The props feature does not draw its own oak there.
    view.standIns.set(GREAT_OAK.prop, { place: () => 1, remove: () => {} });
  }
  // Far trees are pictures of these same trees, taken now.
  const farTrees = createImpostors(view.renderer, sitters);
  view.scene.add(farTrees.group);
  // The trees of the far land, by squares of 64 blocks: six numbers a tree (x, y, z, scale, kind, grey). They come
  // from the terrain's own rule for where a tree grows, so they are the trees the hero will find there.
  const SQUARE = 64;
  const squares = new Map<number, Float32Array>();
  const squareKey = (sx: number, sz: number): number => (sx + 32768) * 65536 + (sz + 32768);
  function square(sx: number, sz: number): Float32Array {
    const list = treesInArea(sim.seed, sx * SQUARE, sz * SQUARE, (sx + 1) * SQUARE, (sz + 1) * SQUARE), out = new Float32Array(list.length * 6);
    let n = 0;
    for (const t of list) {
      const key = kindKey(t.kind, t.variant, t.x, t.z), kind = kinds.get(key) ?? (kinds.get('oak:0') as Kind);
      if (key === '') continue;
      out.set([t.x + 0.5, t.y - 0.12, t.z + 0.5, ownSize.has(key) ? t.size : ((6.6 * t.size) / kind.top) * 1.2, kind.index, greyAt(t.x, t.z)], n++ * 6);
    }
    return out.subarray(0, n * 6);
  }
  let farX = NaN, farZ = NaN, farStale = true;
  /** Lists the far trees again when the hero has walked a few steps, when a square of them arrives or when a tree falls. */
  function plantFar(): void {
    const p = view.playerPosition, cx = Math.floor(p.x / SQUARE), cz = Math.floor(p.z / SQUARE), reach = Math.ceil(FAR_TREES / SQUARE);
    // At most one new square a frame, nearest first.
    let made = false;
    for (let ring = 0; ring <= reach && !made; ring++) {
      for (let dx = -ring; dx <= ring && !made; dx++) {
        for (let dz = -ring; dz <= ring && !made; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring || squares.has(squareKey(cx + dx, cz + dz))) continue;
          squares.set(squareKey(cx + dx, cz + dz), square(cx + dx, cz + dz));
          made = farStale = true;
        }
      }
    }
    if (squares.size > 400) for (const k of squares.keys()) { if (squares.size <= 300) break; squares.delete(k); farStale = true; }
    if (!farStale && Math.hypot(p.x - farX, p.z - farZ) < 6) return;
    farX = p.x; farZ = p.z; farStale = false;
    farTrees.clear();
    // A tree nearer than this is always drawn leaf by leaf, wherever the hero walks before the next listing.
    const inside = treeEdge - 12 - 8;
    for (let ring = 0; ring <= reach; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const list = squares.get(squareKey(cx + dx, cz + dz));
          if (!list) continue;
          for (let i = 0; i < list.length; i += 6) {
            const x = list[i] as number, z = list[i + 2] as number, away = Math.hypot(x - p.x, z - p.z);
            if (away < inside || away > FAR_TREES || sys.trees?.felled(Math.floor(x), Math.floor(z))) continue;
            if (!farTrees.add(x, list[i + 1] as number, z, list[i + 3] as number, list[i + 4] as number, list[i + 5] as number)) break;
          }
        }
      }
    }
    farTrees.commit();
  }
  // A felled tree tips over the way the hero pushed it and is gone a moment later.
  const FALL = 1.1;
  const falling: { tree: ModelTree; time: number; toward: number }[] = [];
  game.events.on('tree.felled', (e) => {
    const tree = sys.trees?.all().find((t) => t.x === e.x && t.z === e.z);
    if (tree) falling.push({ tree, time: 0, toward: Math.atan2(tree.x - view.playerPosition.x, tree.z - view.playerPosition.z) });
    farStale = true;
  });
  const pool: Placement[] = [];
  /**
   * How far off a tree is still drawn leaf by leaf, and drawn with its shadow. Past it the far trees take over.
   * Both come in closer in a thick wood, so the trees stay inside the quality level's `treeTriangles`.
   */
  let treeEdge = TREE_REACH, nearEdge = TREE_NEAR;
  /** The triangles of the trees at each meter from the hero: leaf by leaf with a shadow, and in fewer cards. */
  const nearCost = new Float32Array(TREE_REACH + 3), midCost = new Float32Array(TREE_REACH + 3);
  /** Works out `treeEdge` and `nearEdge` from the trees in reach. */
  function edges(list: readonly ModelTree[], x: number, z: number): void {
    nearCost.fill(0); midCost.fill(0);
    for (const t of list) {
      if (!t.standing) continue;
      const away = Math.floor(Math.hypot(t.x + 0.5 - x, t.z + 0.5 - z));
      if (away > TREE_REACH + 2) continue;
      const key = kindKey(t.kind, t.variant, t.x, t.z), kind = kinds.get(key) ?? kinds.get('oak:0');
      if (!kind || key === '') continue;
      nearCost[away] = (nearCost[away] as number) + kind.near.each * 2;
      midCost[away] = (midCost[away] as number) + kind.far.each;
    }
    const budget = QUALITY[view.ctx.quality].treeTriangles;
    // The costs out to each meter, added up: leaf by leaf with a shadow, and in fewer cards.
    const last = TREE_REACH + 2;
    for (let d = 1; d <= last; d++) { nearCost[d] = (nearCost[d] as number) + (nearCost[d - 1] as number); midCost[d] = (midCost[d] as number) + (midCost[d - 1] as number); }
    const cost = (near: number, reach: number): number => (nearCost[Math.min(near, reach)] as number) + (midCost[reach] as number) - (midCost[Math.min(near, reach)] as number);
    // First the nearest trees lose their shadows and fine leaves from the outside in. Only when every tree is
    // in fewer cards and it is still too much do the far trees' pictures come closer.
    const most = Math.min(TREE_REACH, QUALITY[view.ctx.quality].treeReach);
    let near = Math.min(TREE_NEAR, most), reach = most === TREE_REACH ? last : most;
    while (near > 0 && cost(near, reach) > budget) near -= 2;
    while (near <= 0 && reach > 16 && cost(0, reach) > budget) reach--;
    const was = treeEdge;
    treeEdge = Math.min(most, reach);
    nearEdge = Math.max(0, near);
    if (Math.abs(was - treeEdge) >= 1) farStale = true;
  }
  let used = 0, lastList: unknown = null, lastStanding = -1, plantedX = NaN, plantedZ = NaN, plantedLand = -1;

  function plant(): void {
    const list = sys.trees?.all() ?? [];
    const p = view.playerPosition;
    let standing = 0;
    for (const t of list) if (t.standing) standing++;
    // Trees are stood again when one falls, when new land brings new ones, when the hero has walked far enough
    // for a near tree to become a far one, and when the land under them has been drawn.
    if (falling.length === 0 && list === lastList && standing === lastStanding && Math.hypot(p.x - plantedX, p.z - plantedZ) < 6 && land.tiles === plantedLand) return;
    lastList = list; lastStanding = standing; plantedX = p.x; plantedZ = p.z; plantedLand = land.tiles;
    edges(list, p.x, p.z);
    for (const kind of unique) { kind.nearPlaces.length = 0; kind.farPlaces.length = 0; }
    used = 0;
    for (const t of list) {
      let fall: (typeof falling)[number] | undefined;
      if (!t.standing) {
        for (const f of falling) if (f.tree === t) fall = f;
        if (!fall) continue;
      }
      const key = kindKey(t.kind, t.variant, t.x, t.z), kind = kinds.get(key) ?? kinds.get('oak:0');
      if (!kind || key === '') continue;
      const x = t.x + 0.5, z = t.z + 0.5, ground = land.heightAt(x, z);
      const place = pool[used] ?? (pool[used] = { x: 0, y: 0, z: 0, scale: 1, turn: 0, tint: new THREE.Color() });
      used++;
      // The rules give a tree a box to fell it by. The painted tree is as tall as that box, and a little more for its leaves.
      const warm = (own(t.x, t.z, 3) - 0.5) * 0.16;
      place.x = x; place.y = (ground === ground ? ground : t.y) - 0.12; place.z = z;
      place.scale = ownSize.has(key) ? t.size : ((t.box.y1 - t.y) / kind.top) * 1.2;
      place.grey = greyAt(t.x, t.z);
      place.fall = 0; place.toward = 0;
      if (fall) {
        // It tips faster as it goes, and shrinks away once it lies on the ground.
        const k = Math.min(1, fall.time / (FALL * 0.75));
        place.fall = k * k * 1.5; place.toward = fall.toward;
        place.scale *= Math.min(1, (FALL - fall.time) / 0.28);
      }
      place.turn = own(t.x, t.z, 1) * Math.PI * 2;
      kindTint(t.x, t.z, place.tint.setRGB(1 + warm, 1 + warm * 0.3, 1 - warm));
      const away = Math.hypot(x - p.x, z - p.z);
      // Past this a tree is drawn as a far tree. `used` keeps its place in the pool.
      if (!fall && away > treeEdge + 2) continue;
      (fall || away < nearEdge ? kind.nearPlaces : kind.farPlaces).push(place);
    }
    for (const kind of unique) { kind.near.plant(kind.nearPlaces); kind.far.plant(kind.farPlaces); }
  }

  // ---------------------------------------------------------------- boulders and bushes
  // The props feature scatters rocks and bushes as boxes and blobs. Here a rock is a painted boulder and a bush
  // is a mound of the trees' leaves, and a ripe berry bush carries berries.
  const boulders = createBoulders(textures), bushes = createBushes(foliage[0] as (typeof foliage)[number], 256, (x, z) => greyAt(Math.floor(x), Math.floor(z)));
  view.scene.add(boulders.group, bushes.group);

  // ---------------------------------------------------------------- each kind of land's small things, and its air
  // Ferns, roots, logs, grey grass, bulrushes, lily pads, stepping stones and scree: the props feature's shapes,
  // grown by the painted feature where each kind of land is.
  const shapes = new Map<string, THREE.BufferGeometry[]>();
  for (const wild of WILDS) {
    const def = (PROPS as Record<string, { variants: readonly string[] }>)[wild.prop];
    if (def) shapes.set(wild.prop, def.variants.slice(0, wild.variants).map((_, v) => buildProp(wild.prop as keyof typeof PROPS, v)));
  }
  let wildLevel = view.ctx.quality;
  const wilds = createWilds(land, shapes, wildLevel);
  const shafts = createShafts(FOREST_SHAFTS, shared.uTime);
  view.scene.add(wilds.group, shafts.group);
  /** The air round the hero, mixed from the kinds of land there. */
  const air = { sun: new THREE.Color(1, 1, 1), shade: new THREE.Color(1, 1, 1), tint: new THREE.Color(), tintShare: 0, haze: 1, still: 0 };
  const airColor = new THREE.Color();
  /** Parts of a fleck still owed from earlier frames, by effect. */
  const owed = new Map<string, number>();
  const at = { x: 0, y: 0, z: 0 };
  function breathe(dt: number, t: number, sunUp: number): void {
    const p = view.playerPosition;
    biomeMix(p.x, p.z, mixOut);
    air.sun.setRGB(0, 0, 0); air.shade.setRGB(0, 0, 0); air.tint.setRGB(0, 0, 0);
    air.tintShare = 0; air.haze = 0; air.still = 0;
    const night = t < 0.21 || t > 0.79, dawn = t > 0.2 && t < 0.34;
    BIOMES.forEach((name, i) => {
      const w = mixOut[i] as number;
      if (w <= 0) return;
      const kind = KIND_AIR[name];
      if (!kind) { air.sun.r += w; air.sun.g += w; air.sun.b += w; air.shade.r += w; air.shade.g += w; air.shade.b += w; air.haze += w; return; }
      air.sun.r += w * kind.sun[0]; air.sun.g += w * kind.sun[1]; air.sun.b += w * kind.sun[2];
      air.shade.r += w * kind.shade[0]; air.shade.g += w * kind.shade[1]; air.shade.b += w * kind.shade[2];
      airColor.set(kind.air);
      air.tint.r += airColor.r * w * kind.airShare; air.tint.g += airColor.g * w * kind.airShare; air.tint.b += airColor.b * w * kind.airShare;
      air.tintShare += w * kind.airShare; air.haze += w * kind.haze; air.still += w * kind.still;
      for (const fleck of kind.flecks ?? []) {
        const now = fleck.when === 'always' || (fleck.when === 'day' && sunUp > 0.5) || (fleck.when === 'night' && night) || (fleck.when === 'dawn' && dawn);
        if (!now) continue;
        let due = (owed.get(fleck.effect) ?? 0) + fleck.rate * w * QUALITY[view.ctx.quality].particles * Math.min(dt, 0.1);
        for (; due >= 1; due--) { at.x = p.x; at.y = land.heightAt(p.x, p.z) || p.y; at.z = p.z; view.effects.play(fleck.effect as EffectId, at); }
        owed.set(fleck.effect, due);
      }
    });
    if (air.tintShare > 0) air.tint.multiplyScalar(1 / air.tintShare);
  }
  view.standIns.set('rock', { place: (x, y, z, turn, scale, variant) => boulders.place(x, y, z, turn, scale * 0.78, variant), remove: (id) => boulders.remove(id) });
  view.standIns.set('bush', { place: (x, y, z, turn, scale, variant) => bushes.place(x, y, z, turn, scale * 0.85, variant), remove: (id) => bushes.remove(id) });
  view.standIns.set('berryBush', { place: (x, y, z, turn, scale, variant) => bushes.place(x, y, z, turn, scale * 0.85, variant, true), remove: (id) => bushes.remove(id) });

  // The plan stands a stone on the land as a column of blocks: the grant's standing stone. Out in the wild it is
  // drawn as a painted stone large enough to hold its blocks, which the rules still see. In town a column of
  // stone is a pillar and stays as it is.
  const columns = new Map<string, { x: number; z: number; top: number }>();
  for (const f of REGION.fills) {
    if ((f.block !== 'stone' && f.block !== 'mossy_stone') || f.x0 !== f.x1 || f.z0 !== f.z1) continue;
    if (f.x0 >= REGION.town.x0 && f.x0 <= REGION.town.x1 && f.z0 >= REGION.town.z0 && f.z0 <= REGION.town.z1) continue;
    const column = columns.get(`${f.x0},${f.z0}`) ?? { x: f.x0, z: f.z0, top: 0 };
    column.top = Math.max(column.top, f.y1 + 1);
    columns.set(`${f.x0},${f.z0}`, column);
  }
  for (const { x, z, top } of columns.values()) {
    const ground = groundHeight(sim.seed, x, z), tall = top - ground;
    if (tall <= 0) continue;
    if (tall >= 3) boulders.place(x + 0.5, ground - 0.1, z + 0.5, own(x, z, 5) * 0.6, tall / 3, STANDING_STONE);
  }

  // ---------------------------------------------------------------- the light
  const sunTint = new THREE.Color(), shadeTint = new THREE.Color(), skyAdd = new THREE.Color(), grey = new THREE.Color();
  /** What the sky is doing, handed to the clouds every frame. */
  const weather: SkyWeather = {
    show: 0.5, deck: 0, wisp: 0.5, storm: 0, flash: 0, windX: 1, windZ: 0, drift: 0.001,
    light: new THREE.Color(), shade: new THREE.Color(), rim: new THREE.Color(), haze: new THREE.Color(), sun: new THREE.Vector3(0, 1, 0),
  };
  const ramp = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function light(): void {
    const t = ((game.clock.timeOfDay % 1) + 1) % 1, a = game.ambient;
    let i = 1;
    while (i < MOODS.length - 1 && (MOODS[i] as readonly [number, Mood])[0] < t) i++;
    const [t0, m0] = MOODS[i - 1] as readonly [number, Mood], [t1, m1] = MOODS[i] as readonly [number, Mood];
    const k = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    mix3(m0.sunTint, m1.sunTint, k, sunTint);
    mix3(m0.shadeTint, m1.shadeTint, k, shadeTint);
    mix3(m0.skyAdd, m1.skyAdd, k, skyAdd);
    // Under a grey sky the sun is as dim and as cool as the shade, and nothing casts a clear shadow.
    const overcast = Math.min(1, Math.max(a.rain * 1.4, (a.cloud - 0.55) * 2.2, a.fog));
    grey.copy(shadeTint).multiplyScalar(1.9);
    shared.uSunTint.value.copy(sunTint).lerp(grey, overcast * 0.85).multiply(air.sun);
    shared.uShadeTint.value.copy(shadeTint).lerp(grey, overcast * 0.35).multiply(air.shade);
    shared.uSkyAdd.value.copy(skyAdd);
    // Lamp light shows at night and hardly at all at noon.
    const day = Math.min(1, Math.max(0, (t - 0.2) / 0.1)) * Math.min(1, Math.max(0, (0.8 - t) / 0.1));
    shared.uLamp.value.setRGB(1.0, 0.72, 0.4).multiplyScalar(0.95 - 0.8 * day);
    mix3(m0.leafSun, m1.leafSun, k, shared.uLeafSun.value);
    mix3(m0.leafShade, m1.leafShade, k, shared.uLeafShade.value);
    // Far things turn the colour of the air first and the colour the game's own sky has at the horizon last,
    // so the land, the hills and the sky meet there. Toward the sun the air glows.
    shared.uHaze.value.copy(view.sky.look.fog);
    mix3(m0.air, m1.air, k, shared.uHazeNear.value).lerp(shared.uHaze.value, Math.max(overcast * 0.8, a.fog));
    // The kind of land the hero stands in tints the near air: green under the old oaks, pale in the grey.
    if (air.tintShare > 0) shared.uHazeNear.value.lerp(tintScratch.copy(air.tint).multiplyScalar((shared.uHazeNear.value.r + shared.uHazeNear.value.g + shared.uHazeNear.value.b) / Math.max(0.01, air.tint.r + air.tint.g + air.tint.b)), air.tintShare);
    mix3(m0.glow, m1.glow, k, shared.uHazeSun.value);
    shared.uHazeGlow.value = (m0.glowing + (m1.glowing - m0.glowing) * k) * (1 - overcast);
    shared.uSunDir.value.copy(view.sky.look.sunDirection);
    // Fog and rain bring the haze in close and make it thick.
    shared.uHazeStart.value = HAZE.start * (1 - 0.8 * Math.max(a.fog, a.rain * 0.4));
    shared.uHazeDensity.value = HAZE.density * (1 + 5 * a.fog + 1.6 * a.rain) * air.haze;
    shared.uHazeMax.value = HAZE.most + (1 - HAZE.most) * a.fog;
    shared.uHazeLow.value.set(HAZE.low, HAZE.clears * (1 - a.fog));
    shared.uCloudShade.value = 0.55 * (1 - overcast);
    // More cloud in the sky shades more of the land.
    shared.uCloudCover.value = 0.22 + 0.5 * ramp(0.1, 0.8, a.cloud);
    // The grey is still: the wind dies in it.
    shared.uWind.value.set(Math.cos(a.windDir), Math.sin(a.windDir), (0.35 + 1.3 * a.wind) * (1 - air.still));
    // ---- the sky: how many painted clouds stand in it, how far the high layer has closed, and their colours
    const storm = Math.min(1, Math.max(a.rain * 1.6, (a.cloud - 0.8) * 3));
    weather.show = SKY.few + (SKY.all - SKY.few) * ramp(0.08, 0.72, a.cloud);
    weather.deck = Math.min(0.97, Math.max(ramp(SKY.deckFrom, 1, a.cloud) * 0.7, storm * 0.97, a.fog * 0.9));
    weather.wisp = ramp(0.04, 0.4, a.cloud) * (1 - storm);
    weather.storm = storm;
    mix3(m0.cloudLight, m1.cloudLight, k, weather.light);
    mix3(m0.cloudShade, m1.cloudShade, k, weather.shade);
    mix3(m0.cloudRim, m1.cloudRim, k, weather.rim);
    // Under rain the clouds are greys: darker, and a little cold.
    const tint = SKY.storm.tint;
    grey.setRGB(tint[0], tint[1], tint[2]).multiplyScalar((weather.light.r + weather.light.g + weather.light.b) / 3);
    weather.light.lerp(grey, storm).multiplyScalar(1 - (1 - SKY.storm.light) * storm);
    weather.shade.multiplyScalar(1 - (1 - SKY.storm.shade) * storm);
    weather.haze.copy(shared.uHaze.value);
    weather.sun.copy(view.sky.look.sunDirection);
    weather.flash = a.flash;
    weather.windX = Math.cos(a.windDir); weather.windZ = Math.sin(a.windDir);
    weather.drift = SKY.drift[0] + (SKY.drift[1] - SKY.drift[0]) * Math.min(1, a.wind);
    backdrop.setSky(weather);
    water.setSky(view.sky.look.horizon, view.sky.look.zenith, a.rain);
  }

  const look = new THREE.Vector3(), seen = new THREE.Frustum(), projection = new THREE.Matrix4();
  const groundAim = new THREE.Vector3();
  view.onCamera(() => {
    const camera = view.ctx.camera as THREE.PerspectiveCamera, p = view.playerPosition;
    // Keep the body visible over an outdoor foreground bank without cutting the land open.
    // Scene framing and the free/first-person rigs retain control of their lenses.
    if (view.camera.mode === 'tilt' && !sys.talk?.active && !view.root.classList.contains('sf-on')) {
      const rise = groundCameraRise(camera.position, p, land.heightAt);
      if (rise > 0) {
        camera.getWorldDirection(groundAim);
        groundAim.multiplyScalar(Math.hypot(camera.position.x - p.x, camera.position.y - p.y, camera.position.z - p.z)).add(camera.position);
        camera.position.y += rise;
        camera.lookAt(groundAim);
      }
    }
    camera.updateMatrixWorld();
  });
  let hillY = view.playerPosition.y, storySince = 0;
  view.onFrame((dt) => {
    // Twice a second: has the story, or the plot, changed the land?
    storySince += dt;
    if (storySince > 0.5) { storySince = 0; watchStory(); }
    const p = view.playerPosition, sun = view.sky.sun, reach = view.world.stats.radius;
    shared.uTime.value = view.settings.graphics.reduceMotion ? 0 : view.ctx.time;
    shared.uSunRaw.value = sun.color.r * sun.intensity;
    shared.uFocus.value.set(p.x, p.y, p.z);
    // The near world thins out over its last few meters, and the far land shows through it there.
    const edge = reach * 16 - 8;
    shared.uEdge.value.set(edge - 14, edge);
    view.world.setEdge(edge - 14, edge);
    shared.uEdgeTree.value.set(treeEdge - 12, treeEdge);
    // The camera must see as far as the far land and the ridges behind it.
    const camera = view.ctx.camera as THREE.PerspectiveCamera;
    if (camera.far < FAR_PLANE) { camera.far = FAR_PLANE; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    seen.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    land.update(p.x, p.z, reach, seen);
    farLand.setCell(QUALITY[view.ctx.quality].farLandCell);
    farLand.update(p.x, p.z, edge - 15);
    water.update(p.x, p.z, reach, seen);
    plantFar();
    // The grass grows again, thinner or denser, when the quality level changes.
    if (view.ctx.quality !== grassLevel) grass.setQuality((grassLevel = view.ctx.quality));
    grass.update(p.x, p.z);
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i] as (typeof falling)[number];
      f.time += dt;
      if (f.time >= FALL) { falling.splice(i, 1); lastStanding = -1; }
    }
    plant();
    const level = QUALITY[view.ctx.quality];
    boulders.detail?.(level.propShadows, true);
    bushes.detail?.(false, level.fineBushReach > 0);
    boulders.range?.(p.x, p.z, level.scatterReach);
    bushes.range?.(p.x, p.z, level.scatterReach, level.fineBushReach);
    boulders.update();
    bushes.update();
    if (view.ctx.quality !== wildLevel) wilds.setQuality((wildLevel = view.ctx.quality));
    wilds.update(p.x, p.z);
    const t = ((game.clock.timeOfDay % 1) + 1) % 1, sunUp = Math.min(1, Math.max(0, (view.sky.look.sunDirection.y - 0.05) / 0.25));
    breathe(dt, t, sunUp);
    // Shafts of sun stand where the old forest is, by day and under a clear sky.
    const clear = 1 - Math.min(1, Math.max(game.ambient.rain * 1.4, (game.ambient.cloud - 0.55) * 2.2, game.ambient.fog));
    const forest = QUALITY[view.ctx.quality].forestShafts ? share('oldForest', p.x, p.z) : 0;
    shafts.update(p.x, p.z, forest * sunUp * clear, view.sky.look.sunDirection, (x, z) => share('oldForest', x, z), (x, z) => land.heightAt(x, z));
    light();
    // The far hills stand round the hero at the level of the land there, and sink into haze when the camera looks down on them.
    const ground = land.heightAt(p.x, p.z);
    hillY += ((ground === ground ? ground : p.y) - hillY) * Math.min(1, dt * 1.5);
    backdrop.update(p.x, hillY, p.z, dt, -view.ctx.camera.getWorldDirection(look).y);
  });
}
