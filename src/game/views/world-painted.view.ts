// The painted world in the game: the land drawn smooth with grass on it, leafy trees, far hills and painted
// clouds, all lit by one painted light. It is on unless the address says `?look=blocks`, which draws the
// ground as blocks and the trees as models again.
//
// This view feeds the painted feature from the game: the block world gives the land its shape, the trees
// system says where trees stand, the sky gives the sun's direction and how much of it is shadow, and the
// clock gives the colour of the light.
import * as THREE from 'three';
import { EMERALD, HAZE, MOODS, PAINTED_TREES, TREE_NEAR, type Mood } from '../../content/painted.ts';
import { buildTree, createBackdrop, createBoulders, createBushes, createGrass, createLand, createStand, foliageMaterials, loadTextures, shared, type Placement, type Stand, type TreeSpec } from '../../features/painted/index.ts';
import { groundHeight } from '../../features/world/index.ts';
import type { ModelTree } from '../trees/index.sim.ts';
import type { Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The sprays of leaflets sit at every depth in the crown and under it too, so the crown is leaves all the way through. */
const leafy = (spec: TreeSpec): TreeSpec => ({ ...spec, card: Math.max(0.62, Math.min(1.0, spec.card * 0.76)), cover: 1.9, inset: [0.6, 1.08], core: 0.55, coreColor: '#1d8c58', under: -0.8 });
/** Trees far off: the same shapes in fewer, larger cards. */
const far = (spec: TreeSpec): TreeSpec => ({ ...spec, card: spec.card * 1.9, cover: 1.3 });
/** The top of a tree's crown, in meters at a scale of 1. */
const topOf = (spec: TreeSpec): number => Math.max(spec.crown * spec.squash * 0.75, spec.height - spec.crown * spec.squash * 0.5) + spec.crown * spec.squash;

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
  view.scene.add(land.group, grass.group, backdrop.group);
  view.setGround((x, z) => land.heightAt(x, z));

  // ---------------------------------------------------------------- the trees
  // Each kind and variant is one shape, drawn leaf by leaf near the hero and in fewer, larger cards far off.
  interface Kind { near: Stand; far: Stand; top: number; nearPlaces: Placement[]; farPlaces: Placement[] }
  const kinds = new Map<string, Kind>();
  const trees = new THREE.Group();
  trees.name = 'painted-trees';
  const foliage = [0, 1, 2].map((spray) => foliageMaterials(textures, { mask: textures.rosettes[spray] as THREE.Texture, tones: [...EMERALD], vary: 0.3, top: 0.25 }));
  for (const [kind, variants] of Object.entries(PAINTED_TREES)) {
    variants.forEach(({ spec, spray }, variant) => {
      const materials = foliage[spray] as (typeof foliage)[number];
      const near = createStand(buildTree(leafy(spec)), materials, 64, true), distant = createStand(buildTree(far(leafy(spec))), materials, 192, false);
      trees.add(near.group, distant.group);
      kinds.set(`${kind}:${variant}`, { near, far: distant, top: topOf(spec), nearPlaces: [], farPlaces: [] });
    });
  }
  view.scene.add(trees);
  // A felled tree tips over the way the hero pushed it and is gone a moment later.
  const FALL = 1.1;
  const falling: { tree: ModelTree; time: number; toward: number }[] = [];
  game.events.on('tree.felled', (e) => {
    const tree = sys.trees?.all().find((t) => t.x === e.x && t.z === e.z);
    if (tree) falling.push({ tree, time: 0, toward: Math.atan2(tree.x - view.playerPosition.x, tree.z - view.playerPosition.z) });
  });
  const pool: Placement[] = [];
  /** How far off a tree is still drawn: the land's edge, and a little more for the hero's next few steps. */
  let treeReach = 96;
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
      // Past the land's edge a tree is lost in the haze, so it is not drawn. `used` keeps its place in the pool.
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
  view.standIns.set('rock', { place: (x, y, z, turn, scale, variant) => boulders.place(x, y, z, turn, scale * 0.95, variant), remove: (id) => boulders.remove(id) });
  view.standIns.set('bush', { place: (x, y, z, turn, scale, variant) => bushes.place(x, y, z, turn, scale * 0.85, variant), remove: (id) => bushes.remove(id) });
  view.standIns.set('berryBush', { place: (x, y, z, turn, scale, variant) => bushes.place(x, y, z, turn, scale * 0.85, variant, true), remove: (id) => bushes.remove(id) });

  // ---------------------------------------------------------------- the light
  const sunTint = new THREE.Color(), shadeTint = new THREE.Color(), skyAdd = new THREE.Color(), cloud = new THREE.Color(), grey = new THREE.Color();
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
    mix3(m0.cloud, m1.cloud, k, cloud);
    // The haze is the colour the game's own sky has at the horizon, so the land, the hills and the sky meet in it.
    shared.uHaze.value.copy(view.sky.look.fog);
    shared.uHazeStart.value = HAZE.start;
    shared.uHazeDensity.value = HAZE.density * (1 + 3 * a.fog + 1.2 * a.rain);
    shared.uCloudShade.value = 0.55 * (1 - overcast);
    shared.uWind.value.set(Math.cos(a.windDir), Math.sin(a.windDir), 0.35 + 1.3 * a.wind);
    backdrop.setColors(cloud, shared.uHaze.value, 1 - overcast * 0.9);
  }

  const look = new THREE.Vector3();
  let hillY = view.playerPosition.y;
  view.onFrame((dt) => {
    const p = view.playerPosition, sun = view.sky.sun, reach = view.world.stats.radius;
    shared.uTime.value = view.settings.graphics.reduceMotion ? 0 : view.ctx.time;
    shared.uSunRaw.value = sun.color.r * sun.intensity;
    shared.uFocus.value.set(p.x, p.y, p.z);
    const edge = reach * 16 - 8;
    shared.uEdge.value.set(edge * 0.6, edge);
    treeReach = edge + 8;
    land.update(p.x, p.z, reach);
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
