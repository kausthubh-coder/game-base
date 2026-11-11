// What the fight lab draws flat on the ground: the shape of an attack before it lands, the soft shadow under
// every fighter, the arc of a cut, the ring of the Mark and the cell a rig would stand on. Shapes on the
// ground shrink with distance exactly as the ground does, so they say where a thing is in depth, which a
// tilted camera does not.
//
// Every mark is one instance of one quad, so all of them cost one draw call. The caller draws the marks it
// wants each frame, between `begin` and `end`. Nothing is kept from one frame to the next.
import * as THREE from 'three';
import type { GameView } from '../shell/view.ts';

/** How a mark is filled in. */
export const MARK = {
  /** A disc of radius `reach`. `fill` grows a brighter disc from its middle. */
  circle: 0,
  /** A strip `reach` long and `width` wide, starting at the point and running the way it faces. `fill` runs along it. */
  line: 1,
  /** A wedge of `reach` that opens `width` radians to each side of its facing. `fill` grows from its point. */
  cone: 2,
  /** A soft dark blob: a shadow. */
  shadow: 3,
  /** A thin ring at `reach`. `fill` is how much of the ring is drawn, clockwise from the facing. */
  ring: 4,
  /** The outline of a square, `reach` from its middle to a side. */
  cell: 5,
} as const;

export interface Ground {
  begin(): void;
  /**
   * One mark, at the feet height `y`. `fill` is 0 to 1. `alpha` scales the whole mark. `hot` (0 to 1) brightens
   * it toward white: the moment an attack lands.
   */
  draw(kind: number, x: number, y: number, z: number, facing: number, reach: number, width: number, fill: number, color: THREE.Color, alpha: number, hot?: number): void;
  end(): void;
  readonly count: number;
}

const CAPACITY = 48;

const VERTEX = /* glsl */ `
attribute vec4 aPlace;
attribute vec4 aShape;
attribute vec4 aColor;
attribute vec4 aMore;
varying vec2 vAt;
varying vec4 vShape;
varying vec4 vColor;
varying vec4 vMore;
#include <fog_pars_vertex>

void main() {
  // The quad covers the mark's reach and a little more, turned so its own up is the way the mark faces.
  float size = aMore.z;
  vAt = position.xy * size;
  float c = cos(aMore.x), s = sin(aMore.x);
  // Facing 0 is north (-z) and grows toward the east (+x).
  vec3 world = vec3(aPlace.x + vAt.x * c + vAt.y * s, aPlace.y, aPlace.z + vAt.x * s - vAt.y * c);
  vShape = aShape;
  vColor = aColor;
  vMore = aMore;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
varying vec2 vAt;
varying vec4 vShape;
varying vec4 vColor;
varying vec4 vMore;
#include <fog_pars_fragment>

void main() {
  float kind = vShape.x, reach = vShape.y, width = vShape.z, fill = vShape.w;
  float d = length(vAt);
  // A pixel is about this many blocks wide here: edges are a pixel or two soft, whatever the zoom.
  float px = max(fwidth(vAt.x), fwidth(vAt.y)) + 0.0001;
  float inside = 0.0, edge = 0.0, filled = 0.0;
  if (kind < 0.5) {
    inside = 1.0 - smoothstep(reach - px, reach + px, d);
    edge = 1.0 - smoothstep(0.03, 0.03 + px * 2.0, abs(d - reach + 0.05));
    filled = 1.0 - smoothstep(reach * fill - px, reach * fill + px, d);
  } else if (kind < 1.5) {
    float across = abs(vAt.x), halfWide = width * 0.5;
    inside = (1.0 - smoothstep(halfWide - px, halfWide + px, across)) * step(0.0, vAt.y) * (1.0 - smoothstep(reach - px, reach + px, vAt.y));
    float side = 1.0 - smoothstep(0.03, 0.03 + px * 2.0, abs(across - halfWide + 0.05));
    float cap = 1.0 - smoothstep(0.03, 0.03 + px * 2.0, min(abs(vAt.y - reach + 0.05), abs(vAt.y - 0.05)));
    edge = max(side, cap) * step(across, halfWide + 0.02) * step(-0.02, vAt.y) * step(vAt.y, reach + 0.02);
    filled = 1.0 - smoothstep(reach * fill - px, reach * fill + px, vAt.y);
  } else if (kind < 2.5) {
    float turn = abs(atan(vAt.x, vAt.y));
    float soft = px / max(d, 0.2);
    inside = (1.0 - smoothstep(width - soft, width + soft, turn)) * (1.0 - smoothstep(reach - px, reach + px, d));
    float arc = 1.0 - smoothstep(0.03, 0.03 + px * 2.0, abs(d - reach + 0.05));
    float flank = 1.0 - smoothstep(0.03, 0.03 + px * 2.0, abs(turn - width) * d);
    edge = max(arc * step(turn, width), flank * step(d, reach));
    filled = 1.0 - smoothstep(reach * fill - px, reach * fill + px, d);
  } else if (kind < 3.5) {
    float soft = 1.0 - smoothstep(reach * 0.35, reach, d);
    gl_FragColor = vec4(vColor.rgb, vColor.a * soft * soft);
    #include <fog_fragment>
    return;
  } else if (kind < 4.5) {
    // 0 at the facing, growing clockwise to 1.
    float around = fract(atan(vAt.x, vAt.y) / 6.2831853 + 1.0);
    edge = (1.0 - smoothstep(width, width + px * 2.0, abs(d - reach))) * step(around, fill);
  } else {
    float box = max(abs(vAt.x), abs(vAt.y));
    inside = (1.0 - smoothstep(reach - px, reach + px, box)) * 0.5;
    edge = 1.0 - smoothstep(0.03, 0.03 + px * 2.0, abs(box - reach + 0.05));
  }
  // The body of the mark is faint, the part the clock has filled is stronger, and the rim is a clear line.
  float alpha = max(inside * mix(0.24, 0.6, filled), edge * 0.95) * vColor.a;
  if (alpha < 0.004) discard;
  vec3 color = mix(vColor.rgb, vec3(1.0), vMore.y * 0.7);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createGround(view: GameView): Ground {
  const geometry = new THREE.InstancedBufferGeometry();
  // A square from -1 to 1 in its own x and y.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const place = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const shape = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const more = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  for (const attribute of [place, shape, color, more]) attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aPlace', place);
  geometry.setAttribute('aShape', shape);
  geometry.setAttribute('aColor', color);
  geometry.setAttribute('aMore', more);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: { fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0 } },
    // Just over the ground, without fighting it for the same pixels.
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'fight-ground';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  view.scene.add(mesh);
  let count = 0;

  return {
    begin() { count = 0; },
    draw(kind, x, y, z, facing, reach, width, fill, tint, alpha, hot = 0) {
      if (count >= CAPACITY) return;
      const o = count * 4;
      place.array[o] = x; place.array[o + 1] = y + 0.05 + count * 0.002; place.array[o + 2] = z; place.array[o + 3] = 0;
      shape.array[o] = kind; shape.array[o + 1] = reach; shape.array[o + 2] = width; shape.array[o + 3] = fill;
      color.array[o] = tint.r; color.array[o + 1] = tint.g; color.array[o + 2] = tint.b; color.array[o + 3] = alpha;
      more.array[o] = facing; more.array[o + 1] = hot; more.array[o + 2] = reach + 0.3; more.array[o + 3] = 0;
      count++;
    },
    end() {
      geometry.instanceCount = count;
      mesh.visible = count > 0;
      place.needsUpdate = shape.needsUpdate = color.needsUpdate = more.needsUpdate = true;
    },
    get count() { return count; },
  };
}
