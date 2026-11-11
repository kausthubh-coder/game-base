// The active waypoint in the world: a beam of light where it stands, and on the screen its distance
// in blocks, with an arrow at the edge of the screen when the beam is out of view.
import * as THREE from 'three';
import './map.css';
import type { ViewContext } from '../../engine/system.ts';
import type { Quality } from '../../engine/types.ts';
import { QUALITY } from '../../content/quality.ts';
import { clampToScreen, emptyEdgeMark } from './geometry.sim.ts';
import { ARROW_PATH, hex, svgIcon } from './icons.ts';
import { WAYPOINT_COLORS, type Marks, type Waypoint } from './marks.sim.ts';

export interface Beacon {
  readonly element: HTMLElement;
  update(dt: number, ctx: ViewContext, playerX: number, playerZ: number): void;
  setQuality(quality: Quality): void;
  dispose(): void;
}

export interface BeaconOptions {
  parent: HTMLElement;
  /** How far inside the edge of the screen the arrow sits, in pixels. */
  margin?: number;
  /** The beam's height in blocks. */
  height?: number;
}

/** The glow's radius in blocks. The bright core inside it is a third as wide. */
const BEAM_RADIUS = 0.55;

/**
 * The beam as one mesh, so it is one draw call: a wide tube of colored glow, a thin bright core
 * inside it, and a flat ring of glow on the ground. Every corner carries how strong it is
 * (`alpha`), how white (`white`) and whether it thins toward its outline (`soft`).
 */
function beamGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], alphas: number[] = [], whites: number[] = [], softs: number[] = [], indices: number[] = [];
  // A tube of `sides` faces, stacked from rings of [height, strength]. It fades fast at first and slowly after.
  const tube = (sides: number, radius: number, strength: number, white: number, soft: number): void => {
    const rings = [[0, strength], [0.18, strength * 0.6], [0.5, strength * 0.25], [1, 0]];
    const base = positions.length / 3;
    rings.forEach(([y, alpha]) => {
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
        alphas.push(alpha); whites.push(white); softs.push(soft);
      }
    });
    for (let r = 0; r < rings.length - 1; r++) {
      for (let i = 0; i < sides; i++) {
        const a = base + r * sides + i, b = base + r * sides + ((i + 1) % sides);
        indices.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
  };
  tube(16, 1, 0.62, 0, 1);
  tube(8, 0.32, 1, 0.8, 0);

  // The glow on the ground: strongest at the foot of the beam, gone three blocks out. The tube is scaled tall,
  // so a hair above the ground in its own units is a few hundredths of a block.
  const RING = 24, base = positions.length / 3;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    positions.push(0, 0.002, 0, Math.cos(a) * 5.5, 0.002, Math.sin(a) * 5.5);
    alphas.push(0.8, 0); whites.push(0.15, 0); softs.push(0, 0);
    const j = base + ((i + 1) % RING) * 2;
    indices.push(base + i * 2, j, base + i * 2 + 1, j, j + 1, base + i * 2 + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute('white', new THREE.Float32BufferAttribute(whites, 1));
  geometry.setAttribute('soft', new THREE.Float32BufferAttribute(softs, 1));
  geometry.setIndex(indices);
  return geometry;
}

export function createBeacon(ctx: ViewContext, marks: Marks, options: BeaconOptions): Beacon {
  const margin = options.margin ?? 72;
  const tall = options.height ?? 40;

  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0xffffff) }, opacity: { value: 1 } },
    vertexShader: `
      attribute float alpha;
      attribute float white;
      attribute float soft;
      varying float vAlpha;
      varying float vWhite;
      void main() {
        vec4 seen = modelViewMatrix * vec4(position, 1.0);
        float strength = alpha;
        if (soft > 0.5) {
          // The glow is strongest where the tube faces the camera and thins toward its outline.
          vec3 outward = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
          float facing = abs(dot(outward, normalize(-seen.xyz)));
          strength *= facing * facing;
        }
        vAlpha = strength;
        vWhite = white;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying float vAlpha;
      varying float vWhite;
      void main() {
        gl_FragColor = vec4(mix(color, vec3(1.0), vWhite), vAlpha * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(beamGeometry(), material);
  mesh.name = 'waypoint-beam';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.visible = false;
  mesh.scale.set(BEAM_RADIUS, tall, BEAM_RADIUS);
  ctx.scene.add(mesh);

  const element = document.createElement('div');
  element.className = 'gb-beacon';
  element.hidden = true;
  element.innerHTML = `<div class="gb-beacon-arrow">${svgIcon(ARROW_PATH)}</div><div class="gb-beacon-chip"><b></b> blocks</div>`;
  options.parent.append(element);
  const arrow = element.firstElementChild as HTMLElement;
  const chip = element.lastElementChild as HTMLElement;
  const number = chip.firstElementChild as HTMLElement;

  const point = new THREE.Vector3();
  const mark = emptyEdgeMark();
  let quality: Quality = ctx.quality;
  let shown: Waypoint | null = null;
  let shownColor = '', baseY = 0, sinceGround = 99;
  let lastX = NaN, lastY = NaN, lastAngle = NaN, lastOff: boolean | null = null, lastBlocks = -1, lastBelow: boolean | null = null;

  return {
    element,

    update(dt, frame, playerX, playerZ) {
      const active = marks.active;
      if (!active) {
        if (shown) {
          shown = null;
          mesh.visible = false;
          element.hidden = true;
        }
        return;
      }

      // Stand the beam on the ground. The ground is asked for again now and then, since land loads late and blocks change.
      sinceGround += dt;
      if (active !== shown || sinceGround > 1) {
        baseY = frame.world.heightAt(Math.floor(active.x), Math.floor(active.z));
        sinceGround = 0;
      }
      if (active !== shown || active.color !== shownColor) {
        shownColor = active.color;
        const tint = hex(WAYPOINT_COLORS[active.color]);
        (material.uniforms.color.value as THREE.Color).set(tint);
        element.style.setProperty('--beacon', tint);
        lastOff = null;
      }
      shown = active;
      mesh.position.set(active.x, baseY, active.z);

      const blocks = Math.hypot(active.x - playerX, active.z - playerZ);
      // It thins out when the player stands in it, so it never hides them.
      const near = Math.min(1, Math.max(0.25, blocks / 6));
      const pulse = QUALITY[quality].beaconPulse ? 0.88 + 0.12 * Math.sin(frame.time * 3) : 1;
      material.uniforms.opacity.value = near * pulse;
      mesh.visible = true;

      // Where the foot of the beam is on the screen.
      const camera = frame.camera;
      const width = frame.renderer.domElement.clientWidth, height = frame.renderer.domElement.clientHeight;
      point.set(active.x, baseY, active.z).applyMatrix4(camera.matrixWorldInverse);
      const behind = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true && point.z > 0;
      point.applyMatrix4(camera.projectionMatrix);
      clampToScreen(point.x, point.y, behind, width, height, margin, mark);

      const x = Math.round(mark.x), y = Math.round(mark.y);
      if (x !== lastX || y !== lastY) {
        lastX = x; lastY = y;
        element.style.transform = `translate(${x}px, ${y}px)`;
      }
      if (mark.off !== lastOff) {
        lastOff = mark.off;
        element.classList.toggle('is-off', mark.off);
      }
      // The number sits under the arrow, or over it at the bottom of the screen.
      const below = y < height - margin - 30;
      if (below !== lastBelow) {
        lastBelow = below;
        element.classList.toggle('is-above', !below);
      }
      if (mark.off) {
        const angle = Math.round(mark.angle * 50) / 50;
        if (angle !== lastAngle) {
          lastAngle = angle;
          arrow.style.transform = `rotate(${angle}rad)`;
        }
      }
      const whole = Math.round(blocks);
      if (whole !== lastBlocks) {
        lastBlocks = whole;
        number.textContent = String(whole);
      }
      element.hidden = false;
    },

    setQuality(next) {
      quality = next;
    },

    dispose() {
      ctx.scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
      element.remove();
    },
  };
}
