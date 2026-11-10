// Bakes a rig's clips into rows of bone matrices, so the GPU can pose a whole crowd from one texture and the CPU
// keeps nothing but a clip and a phase per character.
//
// A row is one moment of one clip: for each bone, the matrix that carries a vertex from the bind pose to that
// moment, as three rows of four numbers (the fourth row is always 0 0 0 1). A clip of N frames takes N + 1 rows,
// the last a copy of the first for a loop, so filtering between two rows never reaches into the next clip.
import * as THREE from 'three';

/** Rows a second. The texture is filtered between rows, so motion stays smooth at any frame rate. */
export const BAKE_RATE = 30;

export interface BakedClip {
  name: string;
  /** The first row. */
  row: number;
  /** Frames: the clip spans rows `row` to `row + frames`. */
  frames: number;
  seconds: number;
  loop: boolean;
  /**
   * For a walk or a run, blocks a second the feet move back along the ground at scale 1 while planted. Played at
   * that speed the feet do not slide. 0 for a clip that goes nowhere.
   */
  stride: number;
}

export interface Baked {
  bones: number;
  rows: number;
  /** Bones x 12 numbers per row: three rows of each bone's matrix. */
  data: Float32Array;
  clips: Map<string, BakedClip>;
}

export interface BakeOptions {
  /** Clips that play once and hold. The rest loop. */
  once?: readonly string[];
  /** Bones that touch the ground, to find how fast the walk and run move. */
  feet?: readonly string[];
  /** Clips that move the body along, for their stride. */
  gaits?: readonly string[];
}

/**
 * Poses `root` at every frame of every clip. `bones` and `inverses` are the skin's, in its order. The root's own
 * transform is left out: a matrix maps the bind pose to the posed one in the root's space.
 */
export function bake(root: THREE.Object3D, bones: readonly THREE.Bone[], inverses: readonly THREE.Matrix4[], clips: readonly THREE.AnimationClip[], options: BakeOptions = {}): Baked {
  const once = new Set(options.once ?? []);
  const gaits = new Set(options.gaits ?? []);
  const feet = (options.feet ?? []).map((name) => bones.find((b) => b.name === name)).filter((b): b is THREE.Bone => b !== undefined);
  const layout: BakedClip[] = [];
  let rows = 0;
  for (const clip of clips) {
    const frames = Math.max(1, Math.round(clip.duration * BAKE_RATE));
    layout.push({ name: clip.name, row: rows, frames, seconds: clip.duration, loop: !once.has(clip.name), stride: 0 });
    rows += frames + 1;
  }
  const width = bones.length * 12;
  const data = new Float32Array(rows * width);
  const mixer = new THREE.AnimationMixer(root);
  const rootInverse = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const foot = new THREE.Vector3();

  clips.forEach((clip, c) => {
    const baked = layout[c];
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    // Once and clamped, so the last frame of a clip that plays once is its end and not its start again.
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();
    const heights: number[][] = feet.map(() => []), along: number[][] = feet.map(() => []);
    for (let f = 0; f <= baked.frames; f++) {
      // The last row of a loop is its first again.
      const t = baked.loop && f === baked.frames ? 0 : (f / baked.frames) * clip.duration;
      mixer.setTime(t);
      root.updateMatrixWorld(true);
      rootInverse.copy(root.matrixWorld).invert();
      const o = (baked.row + f) * width;
      for (let b = 0; b < bones.length; b++) {
        m.multiplyMatrices(rootInverse, bones[b].matrixWorld).multiply(inverses[b]);
        const e = m.elements;
        // Row-major: x row, y row, z row.
        data.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], o + b * 12);
      }
      feet.forEach((bone, k) => {
        foot.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(rootInverse);
        heights[k].push(foot.y);
        along[k].push(foot.z);
      });
    }
    if (gaits.has(clip.name)) baked.stride = strideOf(heights, along, clip.duration / baked.frames);
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return { bones: bones.length, rows, data, clips: new Map(layout.map((b) => [b.name, b])) };
}

/**
 * How fast a planted foot moves back: over the frames where each foot is lowest (within a fifth of its lift), the
 * mean speed along z. That is the speed the body must move for the foot to stay put.
 */
export function strideOf(heights: readonly (readonly number[])[], along: readonly (readonly number[])[], step: number): number {
  let sum = 0, count = 0;
  heights.forEach((ys, k) => {
    const low = Math.min(...ys), high = Math.max(...ys);
    const planted = low + (high - low) * 0.2;
    const zs = along[k];
    for (let f = 0; f + 1 < ys.length; f++) {
      if (ys[f] > planted || ys[f + 1] > planted) continue;
      sum += Math.abs(zs[f + 1] - zs[f]) / step;
      count++;
    }
  });
  return count > 0 ? sum / count : 0;
}

/** The baked rows as a half-float texture, filtered between rows. */
export function bakedTexture(baked: Baked): THREE.DataTexture {
  const width = baked.bones * 3;
  const half = new Uint16Array(baked.data.length);
  for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(baked.data[i]);
  const texture = new THREE.DataTexture(half, width, baked.rows, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
