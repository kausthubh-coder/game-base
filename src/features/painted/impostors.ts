// Trees far from the hero, each drawn as a picture of itself on one card. The pictures are taken once, when
// the game starts: every kind of tree is drawn from the side into one sheet. A far tree is then two triangles
// that turn to face the camera, so whole woods can stand on the far land.
//
// A tree changes from leaves to its picture at the edge the painted light calls `uEdgeTree`. Both are thinned
// out there by the same pattern of pixels, one where the other is not, so the change does not show as a line.
import * as THREE from 'three';
import { FRAGMENT_PARS, shared } from './paint.ts';
import type { Stand, TreeShape } from './trees.ts';

/** One kind of tree to take a picture of: its shape, and a stand of that shape with nothing planted in it. */
export interface Sitter { shape: TreeShape; stand: Stand }

export interface Impostors {
  readonly group: THREE.Group;
  /** Starts the list of far trees again. */
  clear(): void;
  /** Adds a tree: its foot, its scale, and which sitter it is. False when there is no room for it. */
  add(x: number, y: number, z: number, scale: number, kind: number): boolean;
  /** Shows the trees added since `clear`. */
  commit(): void;
  readonly count: number;
}

/** Pixels along one side of a tree's picture. */
const TILE = 192;

export function createImpostors(renderer: THREE.WebGLRenderer, sitters: readonly Sitter[], capacity = 4096): Impostors {
  const across = Math.ceil(Math.sqrt(sitters.length)), size = across * TILE;
  const target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  /** Per sitter: the width and height of its picture in meters. */
  const frames: Array<[number, number]> = [];

  // ---- the pictures: noon light from the upper left, no haze, no wind, and leaves in their own colours
  const keep = {
    sunTint: shared.uSunTint.value.clone(), shadeTint: shared.uShadeTint.value.clone(), skyAdd: shared.uSkyAdd.value.clone(), leafSun: shared.uLeafSun.value.clone(),
    leafShade: shared.uLeafShade.value.clone(), density: shared.uHazeDensity.value, raw: shared.uSunRaw.value, shade: shared.uCloudShade.value, time: shared.uTime.value,
    wind: shared.uWind.value.clone(), edge: shared.uEdge.value.clone(), edgeTree: shared.uEdgeTree.value.clone(),
  };
  shared.uSunTint.value.setRGB(1, 1, 1); shared.uShadeTint.value.setRGB(0.5, 0.56, 0.7); shared.uSkyAdd.value.setRGB(0, 0, 0);
  shared.uLeafSun.value.setRGB(1, 1, 1); shared.uLeafShade.value.setRGB(1, 1, 1);
  shared.uHazeDensity.value = 0; shared.uSunRaw.value = 1; shared.uCloudShade.value = 0; shared.uTime.value = 0;
  shared.uWind.value.set(1, 0, 0); shared.uEdge.value.set(1e6, 2e6); shared.uEdgeTree.value.set(1e6, 2e6);
  const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffffff, 1), camera = new THREE.OrthographicCamera();
  sun.position.set(-0.55, 0.75, 0.5);
  scene.add(sun);
  const before = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate };
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  renderer.setRenderTarget(target);
  // Clear to a leaf green that cannot be seen, so the rim of a crown is not blended toward black.
  renderer.setClearColor(0x1f8f52, 0);
  renderer.clear();
  const box = new THREE.Box3(), white = new THREE.Color(1, 1, 1);
  sitters.forEach(({ shape, stand }, i) => {
    box.makeEmpty();
    for (const g of [shape.leaves, shape.wood]) { if (!g.getAttribute('position')?.count) continue; g.computeBoundingBox(); box.union(g.boundingBox as THREE.Box3); }
    // A leaf card reaches past the point it hangs from.
    const half = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) + 1, top = box.max.y + 1;
    frames.push([half * 2, top]);
    const parent = stand.group.parent;
    scene.add(stand.group);
    stand.plant([{ x: 0, y: 0, z: 0, scale: 1, turn: 0, tint: white }]);
    camera.left = -half; camera.right = half; camera.bottom = 0; camera.top = top; camera.near = 1; camera.far = 200;
    camera.position.set(0, 0, 100); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    target.viewport.set((i % across) * TILE, Math.floor(i / across) * TILE, TILE, TILE);
    target.scissor.copy(target.viewport);
    target.scissorTest = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    stand.plant([]);
    if (parent) parent.add(stand.group); else scene.remove(stand.group);
  });
  target.scissorTest = false;
  target.viewport.set(0, 0, size, size);
  renderer.setRenderTarget(before.target);
  renderer.setClearColor(before.color, before.alpha);
  renderer.autoClear = before.auto;
  renderer.shadowMap.autoUpdate = before.shadows;
  shared.uSunTint.value.copy(keep.sunTint); shared.uShadeTint.value.copy(keep.shadeTint); shared.uSkyAdd.value.copy(keep.skyAdd);
  shared.uLeafSun.value.copy(keep.leafSun); shared.uLeafShade.value.copy(keep.leafShade);
  shared.uHazeDensity.value = keep.density; shared.uSunRaw.value = keep.raw; shared.uCloudShade.value = keep.shade; shared.uTime.value = keep.time;
  shared.uWind.value.copy(keep.wind); shared.uEdge.value.copy(keep.edge); shared.uEdgeTree.value.copy(keep.edgeTree);

  // ---- the cards
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const places = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4), tiles = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  places.setUsage(THREE.DynamicDrawUsage); tiles.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aPlace', places);
  geometry.setAttribute('aTile', tiles);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uSheet: { value: target.texture }, uTileSize: { value: 1 / across }, uBrushAmt: { value: 0 }, uBands: { value: 0 }, uWrap: { value: 0 }, uBrushScale: { value: 0.05 }, uDapple: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aPlace, aTile;
      uniform float uTileSize;
      varying vec2 vUv;
      varying vec3 vPaintWorld;
      void main() {
        // The card stands upright on the tree's foot and turns round it to face the camera.
        vec2 to = cameraPosition.xz - aPlace.xz;
        vec2 side = normalize(vec2(to.y, -to.x));
        vec3 world = aPlace.xyz + vec3(side.x, 0.0, side.y) * (position.x * aTile.z * aPlace.w) + vec3(0.0, position.y * aTile.w * aPlace.w, 0.0);
        vUv = aTile.xy + vec2(position.x + 0.5, position.y) * uTileSize;
        vPaintWorld = world;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${FRAGMENT_PARS}
      uniform sampler2D uSheet;
      uniform vec3 uLeafSun, uLeafShade;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uSheet, vUv);
        if (t.a < 0.5) discard;
        // Only where the tree itself is not drawn.
        if (paintTreeEdge() <= paintDither()) discard;
        gl_FragColor = vec4(paintAir(t.rgb * mix(uLeafShade, uLeafSun, 0.62) * paintClouds()), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'far-trees';
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);
  let n = 0;
  return {
    group,
    clear() { n = 0; },
    add(x, y, z, scale, kind) {
      if (n >= capacity) return false;
      const frame = frames[kind] ?? (frames[0] as [number, number]);
      places.setXYZW(n, x, y, z, scale);
      tiles.setXYZW(n, (kind % across) / across, Math.floor(kind / across) / across, frame[0], frame[1]);
      n++;
      return true;
    },
    commit() {
      geometry.instanceCount = n;
      mesh.visible = n > 0;
      places.needsUpdate = tiles.needsUpdate = true;
    },
    get count() { return geometry.instanceCount; },
  };
}
