// The painted world in the game: the land drawn smooth with grass on it, leafy trees, far hills and painted
// clouds, all lit by one painted light. It is on unless the address says `?look=blocks`, which draws the
// ground as blocks and the trees as models again.
//
// This view feeds the painted feature from the game: the block world gives the near land its shape and the
// terrain's own functions give the far land and its woods theirs, the trees system says where trees stand, the sky gives the sun's direction and how much of it is shadow, and the
// clock gives the colour of the light.
import * as THREE from 'three';
import { EMERALD, FAR_TREES, GREAT_OAK, HAZE, PAINTED_WATER, SKY, MOODS, PAINTED_TREES, TREE_NEAR, TREE_REACH, type Mood } from '../../content/painted.ts';
import { STANDING_STONE, buildTree, createBackdrop, createBoulders, createBushes, createFarLand, createGrass, createImpostors, createLand, createStand, foliageMaterials, loadTextures, shared, type Placement, type Sitter, type SkyWeather, type Stand, type TreeSpec } from '../../features/painted/index.ts';
import { WATER_LEVEL, forestAt, groundHeight, landHeight, surfaceAt, treesInArea } from '../../features/world/index.ts';
import { REGION } from '../content/region.ts';
import type { ModelTree } from '../trees/index.sim.ts';
import type { Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The sprays of leaflets sit at every depth in the crown and under it too, so the crown is leaves all the way through. */
const leafy = (spec: TreeSpec): TreeSpec => ({ ...spec, card: Math.max(0.62, Math.min(1.0, spec.card * 0.76)), cover: 1.9, inset: [0.6, 1.08], core: 0.55, coreColor: '#1d8c58', under: -0.8 });
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
  const textures = await loadTextures('./assets/painted/');
  shared.uBrush.value = textures.brush;

  // ---------------------------------------------------------------- the land and what grows on it
  const land = createLand({
    getBlock: (x, y, z) => sim.getBlock(x, y, z),
    heightAt: (x, z) => sim.heightAt(x, z),
    groundAt: (x, z) => groundHeight(sim.seed, x, z),
    glowAt: (x, y, z) => sim.blockLightAt(x, y, z) / 15,
    revision: (cx, cz) => sim.chunkAt(cx, cz)?.rev ?? -1,
  }, textures, view.look === 'steps');
  const grass = createGrass(land, textures, view.ctx.quality);
  const backdrop = createBackdrop(textures);
  // Past the land the game holds in memory, the same hills and rivers drawn from the land's shape alone.
  const farLand = createFarLand({
    heightAt: (x, z) => landHeight(sim.seed, x, z),
    topAt: (x, z) => surfaceAt(sim.seed, x, z),
    forestAt: (x, z) => forestAt(sim.seed, x, z),
    waterLevel: WATER_LEVEL,
    water: PAINTED_WATER.far,
  }, textures);
  view.scene.add(land.group, grass.group, backdrop.group, farLand.group);
  view.setGround((x, z) => land.heightAt(x, z));

  // ---------------------------------------------------------------- the trees
  // Each kind and variant is one shape, drawn leaf by leaf near the hero and in fewer, larger cards far off.
  interface Kind { near: Stand; far: Stand; top: number; nearPlaces: Placement[]; farPlaces: Placement[]; index: number }
  const kinds = new Map<string, Kind>();
  const sitters: Sitter[] = [];
  const trees = new THREE.Group();
  trees.name = 'painted-trees';
  const foliage = [0, 1, 2].map((spray) => foliageMaterials(textures, { mask: textures.rosettes[spray] as THREE.Texture, tones: [...EMERALD], vary: 0.3, top: 0.25 }));
  for (const [kind, variants] of Object.entries(PAINTED_TREES)) {
    variants.forEach(({ spec, spray }, variant) => {
      const materials = foliage[spray] as (typeof foliage)[number];
      const farShape = buildTree(far(leafy(spec)));
      const near = createStand(buildTree(leafy(spec)), materials, 64, true), distant = createStand(farShape, materials, 192, false);
      trees.add(near.group, distant.group);
      kinds.set(`${kind}:${variant}`, { near, far: distant, top: topOf(spec), nearPlaces: [], farPlaces: [], index: sitters.length });
      sitters.push({ shape: farShape, stand: distant });
    });
  }
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
  // The trees of the far land, by squares of 64 blocks: five numbers a tree (x, y, z, scale, kind). They come
  // from the terrain's own rule for where a tree grows, so they are the trees the hero will find there.
  const SQUARE = 64;
  const squares = new Map<number, Float32Array>();
  const squareKey = (sx: number, sz: number): number => (sx + 32768) * 65536 + (sz + 32768);
  function square(sx: number, sz: number): Float32Array {
    const list = treesInArea(sim.seed, sx * SQUARE, sz * SQUARE, (sx + 1) * SQUARE, (sz + 1) * SQUARE), out = new Float32Array(list.length * 5);
    list.forEach((t, i) => {
      const kind = kinds.get(`${t.kind}:${t.variant}`) ?? (kinds.get('oak:0') as Kind);
      out.set([t.x + 0.5, t.y - 0.12, t.z + 0.5, ((6.6 * t.size) / kind.top) * 1.2, kind.index], i * 5);
    });
    return out;
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
    const inside = TREE_REACH - 12 - 8;
    for (let ring = 0; ring <= reach; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const list = squares.get(squareKey(cx + dx, cz + dz));
          if (!list) continue;
          for (let i = 0; i < list.length; i += 5) {
            const x = list[i] as number, z = list[i + 2] as number, away = Math.hypot(x - p.x, z - p.z);
            if (away < inside || away > FAR_TREES || sys.trees?.felled(Math.floor(x), Math.floor(z))) continue;
            if (!farTrees.add(x, list[i + 1] as number, z, list[i + 3] as number, list[i + 4] as number)) break;
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
  /** How far off a tree is still drawn leaf by leaf. Past it the far trees take over. */
  const treeReach = TREE_REACH + 2;
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
    for (const kind of kinds.values()) { kind.nearPlaces.length = 0; kind.farPlaces.length = 0; }
    used = 0;
    for (const t of list) {
      let fall: (typeof falling)[number] | undefined;
      if (!t.standing) {
        for (const f of falling) if (f.tree === t) fall = f;
        if (!fall) continue;
      }
      const kind = kinds.get(`${t.kind}:${t.variant}`) ?? kinds.get('oak:0');
      if (!kind) continue;
      const x = t.x + 0.5, z = t.z + 0.5, ground = land.heightAt(x, z);
      const place = pool[used] ?? (pool[used] = { x: 0, y: 0, z: 0, scale: 1, turn: 0, tint: new THREE.Color() });
      used++;
      // The rules give a tree a box to fell it by. The painted tree is as tall as that box, and a little more for its leaves.
      const warm = (own(t.x, t.z, 3) - 0.5) * 0.16;
      place.x = x; place.y = (ground === ground ? ground : t.y) - 0.12; place.z = z;
      place.scale = ((t.box.y1 - t.y) / kind.top) * 1.2;
      place.fall = 0; place.toward = 0;
      if (fall) {
        // It tips faster as it goes, and shrinks away once it lies on the ground.
        const k = Math.min(1, fall.time / (FALL * 0.75));
        place.fall = k * k * 1.5; place.toward = fall.toward;
        place.scale *= Math.min(1, (FALL - fall.time) / 0.28);
      }
      place.turn = own(t.x, t.z, 1) * Math.PI * 2;
      place.tint.setRGB(1 + warm, 1 + warm * 0.3, 1 - warm);
      const away = Math.hypot(x - p.x, z - p.z);
      // Past this a tree is drawn as a far tree. `used` keeps its place in the pool.
      if (!fall && away > treeReach) continue;
      (fall || away < TREE_NEAR ? kind.nearPlaces : kind.farPlaces).push(place);
    }
    for (const kind of kinds.values()) { kind.near.plant(kind.nearPlaces); kind.far.plant(kind.farPlaces); }
  }

  // ---------------------------------------------------------------- boulders and bushes
  // The props feature scatters rocks and bushes as boxes and blobs. Here a rock is a painted boulder and a bush
  // is a mound of the trees' leaves, and a ripe berry bush carries berries.
  const boulders = createBoulders(textures), bushes = createBushes(foliage[0] as (typeof foliage)[number]);
  view.scene.add(boulders.group, bushes.group);
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
    shared.uSunTint.value.copy(sunTint).lerp(grey, overcast * 0.85);
    shared.uShadeTint.value.copy(shadeTint).lerp(grey, overcast * 0.35);
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
    mix3(m0.glow, m1.glow, k, shared.uHazeSun.value);
    shared.uHazeGlow.value = (m0.glowing + (m1.glowing - m0.glowing) * k) * (1 - overcast);
    shared.uSunDir.value.copy(view.sky.look.sunDirection);
    // Fog and rain bring the haze in close and make it thick.
    shared.uHazeStart.value = HAZE.start * (1 - 0.8 * Math.max(a.fog, a.rain * 0.4));
    shared.uHazeDensity.value = HAZE.density * (1 + 5 * a.fog + 1.6 * a.rain);
    shared.uHazeMax.value = HAZE.most + (1 - HAZE.most) * a.fog;
    shared.uHazeLow.value.set(HAZE.low, HAZE.clears * (1 - a.fog));
    shared.uCloudShade.value = 0.55 * (1 - overcast);
    // More cloud in the sky shades more of the land.
    shared.uCloudCover.value = 0.22 + 0.5 * ramp(0.1, 0.8, a.cloud);
    shared.uWind.value.set(Math.cos(a.windDir), Math.sin(a.windDir), 0.35 + 1.3 * a.wind);
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
  }

  const look = new THREE.Vector3(), seen = new THREE.Frustum(), projection = new THREE.Matrix4();
  let hillY = view.playerPosition.y;
  view.onFrame((dt) => {
    const p = view.playerPosition, sun = view.sky.sun, reach = view.world.stats.radius;
    shared.uTime.value = view.settings.graphics.reduceMotion ? 0 : view.ctx.time;
    shared.uSunRaw.value = sun.color.r * sun.intensity;
    shared.uFocus.value.set(p.x, p.y, p.z);
    // The near world thins out over its last few meters, and the far land shows through it there.
    const edge = reach * 16 - 8;
    shared.uEdge.value.set(edge - 14, edge);
    view.world.setEdge(edge - 14, edge);
    shared.uEdgeTree.value.set(TREE_REACH - 12, TREE_REACH);
    // The camera must see as far as the far land and the ridges behind it.
    const camera = view.ctx.camera as THREE.PerspectiveCamera;
    if (camera.far < FAR_PLANE) { camera.far = FAR_PLANE; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    seen.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    land.update(p.x, p.z, reach, seen);
    farLand.update(p.x, p.z, edge - 15);
    plantFar();
    grass.update(p.x, p.z);
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i] as (typeof falling)[number];
      f.time += dt;
      if (f.time >= FALL) { falling.splice(i, 1); lastStanding = -1; }
    }
    plant();
    boulders.update();
    bushes.update();
    light();
    // The far hills stand round the hero at the level of the land there, and sink into haze when the camera looks down on them.
    const ground = land.heightAt(p.x, p.z);
    hillY += ((ground === ground ? ground : p.y) - hillY) * Math.min(1, dt * 1.5);
    backdrop.update(p.x, hillY, p.z, dt, -view.ctx.camera.getWorldDirection(look).y);
  });
}
