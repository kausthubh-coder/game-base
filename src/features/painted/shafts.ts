// Shafts of sun through the gaps in a forest's crowns: long soft beams that slant down the way the sunlight
// falls, standing at fixed places in the forest round the hero and breathing a little as the leaves move. They
// add light, so they cost nothing to sort, and they are one draw call however many stand.
import * as THREE from 'three';

export interface Shafts {
  readonly group: THREE.Group;
  /**
   * Stands the shafts round the hero. `strength` is 0 to 1: how much sun gets through now (the hour, the
   * clouds, how deep in the forest the hero is). `where` says how much forest a column is, 0 to 1, and
   * `ground` the height of the ground there.
   */
  update(x: number, z: number, strength: number, sun: THREE.Vector3, where: (x: number, z: number) => number, ground: (x: number, z: number) => number): void;
  readonly count: number;
}

export interface ShaftLook { count: number; reach: number; height: number; width: readonly [number, number]; strength: number; color: string }

/** A shaft may stand in each square of this many blocks. */
const SPACING = 7;

const hash = (x: number, z: number, salt: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function createShafts(look: ShaftLook, time: { value: number }): Shafts {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  // Per shaft: its foot, its width, and a number of its own.
  const feet = new THREE.InstancedBufferAttribute(new Float32Array(look.count * 4), 4), own = new THREE.InstancedBufferAttribute(new Float32Array(look.count), 1);
  feet.setUsage(THREE.DynamicDrawUsage); own.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFoot', feet);
  geometry.setAttribute('aOwn', own);
  geometry.instanceCount = 0;
  const uniforms = {
    uTime: time, uStrength: { value: 0 }, uColor: { value: new THREE.Color(look.color) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uLength: { value: look.height },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aFoot;
      attribute float aOwn;
      uniform vec3 uSun;
      uniform float uLength;
      varying vec2 vAt;
      varying float vOwn, vNear;
      void main() {
        // The beam runs from its foot up toward the sun, and turns round that line to face the camera.
        vec3 axis = normalize(uSun);
        vec3 foot = aFoot.xyz;
        vec3 toCamera = normalize(cameraPosition - foot);
        vec3 side = normalize(cross(axis, toCamera));
        vec3 world = foot + axis * position.y * uLength / max(axis.y, 0.35) + side * position.x * aFoot.w * (1.0 + position.y * 0.6);
        vAt = vec2(position.x * 2.0, position.y);
        vOwn = aOwn;
        // A shaft the camera stands in would fill the screen: it fades as the camera comes close.
        vNear = smoothstep(2.0, 7.0, distance(cameraPosition, foot + axis * 3.0));
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uStrength;
      uniform vec3 uColor;
      varying vec2 vAt;
      varying float vOwn, vNear;
      void main() {
        float across = 1.0 - abs(vAt.x);
        float a = across * across * smoothstep(0.0, 0.12, vAt.y) * pow(1.0 - vAt.y, 0.7);
        // The leaves move, and the gap opens and closes a little.
        a *= 0.75 + 0.25 * sin(uTime * (0.35 + vOwn * 0.4) + vOwn * 40.0);
        gl_FragColor = vec4(uColor * a * uStrength * vNear, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'forest-shafts';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const group = new THREE.Group();
  group.name = 'forest-shafts';
  group.add(mesh);
  let lastX = NaN, lastZ = NaN, n = 0, missed = 0, waited = 0;
  return {
    group,
    update(x, z, strength, sun, where, ground) {
      uniforms.uStrength.value = strength * look.strength;
      uniforms.uSun.value.copy(sun);
      mesh.visible = strength > 0.01 && n > 0;
      if (strength <= 0.01) return;
      const cx = Math.floor(x / SPACING), cz = Math.floor(z / SPACING);
      // Listed again when the hero walks into another square, and now and then while some shafts found no
      // ground under them: the land may not be drawn yet where the hero has just arrived.
      if (cx === lastX && cz === lastZ && (missed === 0 || ++waited < 30)) { mesh.visible = n > 0; return; }
      lastX = cx; lastZ = cz; waited = 0; missed = 0;
      n = 0;
      const reach = Math.ceil(look.reach / SPACING);
      for (let ring = 0; ring <= reach && n < look.count; ring++) {
        for (let dx = -ring; dx <= ring && n < look.count; dx++) {
          for (let dz = -ring; dz <= ring && n < look.count; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const gx = cx + dx, gz = cz + dz, px = (gx + hash(gx, gz, 1)) * SPACING, pz = (gz + hash(gx, gz, 2)) * SPACING;
            // Shafts stand in the forest only, and not in every gap.
            if (hash(gx, gz, 3) > 0.5 * where(px, pz)) continue;
            const y = ground(px, pz);
            if (!(y === y)) { missed++; continue; }
            feet.setXYZW(n, px, y, pz, look.width[0] + hash(gx, gz, 4) * (look.width[1] - look.width[0]));
            own.setX(n, hash(gx, gz, 5));
            n++;
          }
        }
      }
      geometry.instanceCount = n;
      feet.needsUpdate = own.needsUpdate = true;
      mesh.visible = n > 0;
    },
    get count() { return n; },
  };
}
