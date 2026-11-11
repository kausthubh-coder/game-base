// Puts the test scene together: the land, the pond, the great tree on its knoll, groves, bushes, the
// cottage and its yard, the meadow's grass and flowers, the sky. It also holds the two moods, noon and
// late afternoon, as plain numbers.
import * as THREE from 'three';
import { createFlowers, createGrass, createTufts } from './grass.ts';
import { GREAT_TREE, HOUSE, POND, bare, createLand, heightAt } from './land.ts';
import { shared } from './paint.ts';
import { createProps } from './props.ts';
import { createSky } from './sky.ts';
import type { Textures } from './textures.ts';
import { buildTree, foliageMaterials, plantTrees, type Placement, type TreeSpec, type Tones } from './trees.ts';
import { createWater } from './water.ts';

export type Quality = 'low' | 'medium' | 'high';
export type MoodName = 'noon' | 'evening';

interface Mood {
  /** Points at the sun. */
  sun: [number, number, number];
  /** What the sun and the shade multiply a surface's colour by, in linear light. */
  sunTint: [number, number, number];
  shadeTint: [number, number, number];
  /** Sky light added to everything in shade. */
  skyAdd: [number, number, number];
  /** What the sun and the shade do to the leaves' painted tones. */
  leafSun: [number, number, number]; leafShade: [number, number, number];
  haze: string; hazeDensity: number;
  zenith: string; mid: string; horizon: string; glow: string; cloud: [number, number, number];
  shallow: string; deep: string; foam: string;
}

const MOODS: Record<MoodName, Mood> = {
  noon: {
    sun: [-0.55, 0.78, 0.36], sunTint: [1.06, 1.0, 0.84], shadeTint: [0.21, 0.37, 0.58], skyAdd: [0.008, 0.022, 0.05],
    leafSun: [1, 1, 1], leafShade: [1, 1, 1],
    haze: '#bfdcee', hazeDensity: 0.003,
    zenith: '#2165cb', mid: '#5c9fe6', horizon: '#c8e3ef', glow: '#fff3d6', cloud: [1, 1, 1],
    shallow: '#8fd6c4', deep: '#3c88b4', foam: '#f6fbf8',
  },
  evening: {
    sun: [-0.78, 0.27, -0.2], sunTint: [1.3, 0.9, 0.55], shadeTint: [0.3, 0.33, 0.6], skyAdd: [0.03, 0.022, 0.07],
    leafSun: [1.28, 0.93, 0.6], leafShade: [0.86, 0.74, 1.0],
    haze: '#f0c9aa', hazeDensity: 0.0034,
    zenith: '#3f62b4', mid: '#c9a9c9', horizon: '#ffd8a2', glow: '#ffc27a', cloud: [1.12, 0.84, 0.74],
    shallow: '#d8b89c', deep: '#5d6fa6', foam: '#fff0d8',
  },
};

const GREAT: TreeSpec = { seed: 7, height: 20, trunk: 1.5, crown: 11.5, blobs: 13, card: 1.75, cover: 1.5, squash: 0.72, lean: 1.2 };
const OAK: TreeSpec = { seed: 21, height: 9.5, trunk: 0.42, crown: 4.6, blobs: 8, card: 1.1, cover: 1.45, squash: 0.8, lean: 0.5 };
const ELM: TreeSpec = { seed: 34, height: 12.5, trunk: 0.5, crown: 5.0, blobs: 9, card: 1.15, cover: 1.45, squash: 0.92, lean: -0.6 };
const CEDAR: TreeSpec = { seed: 55, height: 13, trunk: 0.38, crown: 2.3, blobs: 6, card: 0.9, cover: 1.5, squash: 2.3, lean: 0 };
const BUSH: TreeSpec = { seed: 89, height: 0, trunk: 0, crown: 1.35, blobs: 4, card: 0.55, cover: 1.5, squash: 0.7, lean: 0 };
/** Trees on the far hills: the same shapes in fewer, larger dabs. */
const far = (spec: TreeSpec): TreeSpec => ({ ...spec, card: spec.card * 1.75, cover: 1.3 });

// Deep shade, shade, light, the sunlit top.
const TONES: Record<'great' | 'oak' | 'elm' | 'cedar' | 'bush', Tones> = {
  great: ['#1a4936', '#2e6f3e', '#67a33e', '#b3d15f'],
  oak: ['#1f4f36', '#3a7c3f', '#79b043', '#c0d868'],
  elm: ['#1c4a3a', '#337545', '#65a244', '#a9cc5c'],
  cedar: ['#153f35', '#265c40', '#468443', '#84b052'],
  bush: ['#2c6040', '#4e9247', '#84b84a', '#bcd66a'],
};

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const r = random(1988);
const place = (x: number, z: number, scale: number): Placement => {
  const warm = (r() - 0.5) * 0.16;
  return { x, y: heightAt(x, z) - 0.12, z, scale, turn: r() * Math.PI * 2, tint: new THREE.Color(1 + warm, 1 + warm * 0.3, 1 - warm) };
};

/** Trees stand in groups with open ground between: a painter masses them, then leaves room to breathe. */
function ring(count: number, from: number, to: number, scale: [number, number]): Placement[] {
  const out: Placement[] = [];
  while (out.length < count) {
    const a = r() * Math.PI * 2, d = from + r() * (to - from), x = Math.cos(a) * d, z = Math.sin(a) * d - 8;
    out.push(place(x, z, scale[0] + r() * (scale[1] - scale[0])));
    // One or two companions close by make a clump out of a single tree.
    for (let k = Math.floor(r() * 3); k > 0 && out.length < count; k--) out.push(place(x + (r() - 0.5) * 14, z + (r() - 0.5) * 14, scale[0] + r() * (scale[1] - scale[0])));
  }
  return out;
}

function bushes(): Placement[] {
  const out: Placement[] = [];
  const near = (x: number, z: number, count: number, spread: number): void => {
    for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
      const px = x + (r() - 0.5) * spread, pz = z + (r() - 0.5) * spread;
      if (bare(px, pz) > 0.25 || Math.hypot(px - HOUSE.x, pz - HOUSE.z) < 6.5) continue;
      out.push(place(px, pz, 0.6 + r() * 0.9));
      i++;
    }
  };
  near(GREAT_TREE.x - 6, GREAT_TREE.z - 4, 6, 14); near(POND.x - 4, POND.z + 16, 5, 9); near(POND.x + 17, POND.z - 2, 6, 10);
  near(HOUSE.x + 8, HOUSE.z - 6, 7, 12); near(HOUSE.x - 12, HOUSE.z + 2, 5, 9); near(-58, -22, 10, 34); near(46, -62, 8, 26);
  near(17, -29, 4, 7); near(-12, 32, 5, 12); near(14, 34, 4, 10); near(48, 10, 6, 18); near(0, 20, 14, 110);
  return out;
}

export interface World {
  scene: THREE.Scene;
  light: THREE.DirectionalLight;
  setMood(name: MoodName): void;
  update(camera: THREE.Camera, dt: number): void;
}

export async function createWorld(textures: Textures, quality: Quality): Promise<World> {
  const scene = new THREE.Scene();
  shared.uBrush.value = textures.brush;

  // The one light: white, so its colour in the shader is only the shadow. The sun's colour is a tint.
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.castShadow = true;
  const mapSize = quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024;
  light.shadow.mapSize.set(mapSize, mapSize);
  Object.assign(light.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 20, far: 520 });
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.07;
  scene.add(light, light.target);

  const sky = createSky(textures), water = createWater();
  scene.add(sky.group, createLand(textures), water.mesh, createGrass(quality), createFlowers(textures, quality === 'low' ? 1200 : 4200),
    createTufts(textures, quality === 'low' ? 1200 : 3600), await createProps(textures));

  const [leavesA, leavesB, leavesC] = textures.leaves as [THREE.Texture, THREE.Texture, THREE.Texture];
  const kinds: Array<[TreeSpec, THREE.Texture, Tones, Placement[]]> = [
    [GREAT, leavesA, TONES.great, [{ ...place(GREAT_TREE.x, GREAT_TREE.z, 1), turn: 0.4, tint: new THREE.Color(1, 1, 1) }]],
    [OAK, leavesA, TONES.oak, [
      place(-15, 42, 1.3), place(-58, -8, 1.1), place(-64, -21, 0.95), place(-52, -25, 1.2), place(-70, -3, 1.0), place(-47, -37, 0.9), place(-61, -41, 1.15),
      place(45, -62, 1.1), place(53, -54, 0.95), place(38, -71, 1.2), place(19, -67, 1.0), place(47, 2, 1.05), place(53, 11, 0.9), place(41, 23, 1.1),
    ]],
    [far(OAK), leavesA, TONES.oak, ring(26, 84, 128, [1.0, 1.7])],
    [ELM, leavesC, TONES.elm, [place(-55, -15, 1.0), place(49, -67, 1.1), place(57, -3, 1.0), place(-33, 44, 1.05), place(-74, -30, 1.2)]],
    [far(ELM), leavesC, TONES.elm, ring(16, 80, 126, [0.9, 1.5])],
    [CEDAR, leavesB, TONES.cedar, [place(39.5, -45, 1.0), place(42, -48.5, 0.84), place(21.5, -60, 1.1), place(37, -58, 0.92), place(-66, -12, 1.0), ...ring(8, 90, 124, [0.9, 1.3])]],
    [BUSH, leavesB, TONES.bush, bushes()],
  ];
  for (const [spec, mask, tones, places] of kinds) scene.add(plantTrees(buildTree(spec), foliageMaterials(textures, mask, tones), places));

  const sun = new THREE.Vector3(), skyColors = { zenith: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color(), cloud: new THREE.Color(), haze: new THREE.Color() };
  return {
    scene, light,
    setMood(name) {
      const m = MOODS[name];
      sun.set(...m.sun).normalize();
      light.target.position.set(0, 4, -8);
      light.position.copy(light.target.position).addScaledVector(sun, 260);
      shared.uSunTint.value.setRGB(...m.sunTint); shared.uShadeTint.value.setRGB(...m.shadeTint); shared.uSkyAdd.value.setRGB(...m.skyAdd);
      shared.uLeafSun.value.setRGB(...m.leafSun); shared.uLeafShade.value.setRGB(...m.leafShade);
      shared.uHaze.value.set(m.haze); shared.uHazeDensity.value = m.hazeDensity;
      skyColors.zenith.set(m.zenith); skyColors.mid.set(m.mid); skyColors.horizon.set(m.horizon); skyColors.glow.set(m.glow);
      skyColors.cloud.setRGB(...m.cloud); skyColors.haze.set(m.haze);
      sky.setColors(skyColors, sun);
      water.setColors(m.shallow, m.deep, m.foam, skyColors.horizon, skyColors.mid);
    },
    update(camera, dt) { sky.update(camera, dt); },
  };
}
