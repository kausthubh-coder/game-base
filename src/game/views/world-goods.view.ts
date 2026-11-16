// Draws the Order's pump on the player's land (src/game/goods): the brass root pump standing in the field while it
// runs, its crate by the camp while it does not, and the ring of grey grass round the spot it last ran at, which
// fades over the three days the ground takes to heal.
//
// The pump is the town's `orderPump` landmark and the crate the clutter `crate`, so it costs no art of its own. The
// ring is one draw call, and only near the pump.
import * as THREE from 'three';
import type { Vec3 } from '../../engine/types.ts';
import type { Systems } from '../api.sim.ts';
import { PUMP } from '../content/goods.ts';
import type { GameView } from '../shell/view.ts';
import { worldProps } from '../worldview/props.ts';

/** Seconds between two looks at the pump. */
const EVERY = 0.25;
/** Further than this from the hero, in blocks, the ring is not drawn. */
const FAR = 90;
/** The grey: an ashen green, the colour the handbook gives Blight. */
const ASH = new THREE.Color(0.45, 0.46, 0.41);
/** How much of the grass the ring covers at full grey. */
const STRENGTH = 0.62;

const RING_VERTEX = /* glsl */ `
varying vec2 vAt;
#include <fog_pars_vertex>
void main() {
  vAt = position.xz;
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vAt;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // Full at the pump, a ragged edge at the rim: the grey creeps out in patches, block by block.
  float d = length(vAt) * 2.0;
  float patchy = hash(floor(vAt * ${(PUMP.grey * 2).toFixed(1)}));
  float edge = smoothstep(1.0, 0.55 + 0.3 * patchy, d);
  float a = edge * uStrength;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <fog_fragment>
}
`;

export function install(view: GameView): void {
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const props = worldProps(view);

  // ---------------------------------------------------------------- the pump, or its crate
  let handle = 0, shownKind = '', shownAt = '';
  function setDown(kind: string | null, at: Vec3 | null): void {
    const key = at ? `${at.x},${at.y},${at.z}` : '';
    if (kind === shownKind && key === shownAt && (!kind || props.alive(handle))) return;
    props.remove(handle);
    handle = 0;
    shownKind = kind ?? '';
    shownAt = key;
    if (!kind || !at || !props.has(kind)) return;
    handle = props.place(kind, 0, at.x, at.y + view.lift(at.x, at.y, at.z), at.z, 0, kind === 'crate' ? 1 : 0.65, true);
  }

  // ---------------------------------------------------------------- the grey ring
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: ASH },
    uStrength: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'pump-grey',
    uniforms,
    vertexShader: RING_VERTEX,
    fragmentShader: RING_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material);
  ring.name = 'pump-grey';
  ring.renderOrder = 1;
  ring.frustumCulled = false;
  ring.matrixAutoUpdate = false;
  ring.visible = false;
  view.scene.add(ring);
  let ringAt = '';

  let wait = 0;
  view.onFrame((dt) => {
    wait -= dt;
    if (wait > 0) return;
    wait = EVERY;
    const pump = sys.goods?.pump();
    if (!pump) return;
    setDown(pump.running ? 'orderPump' : pump.at ? 'crate' : null, pump.at);
    const at = pump.greyAt;
    const near = at && Math.hypot(at.x - game.player.pos.x, at.z - game.player.pos.z) < FAR;
    ring.visible = !!(at && near && pump.grey > 0);
    if (!at || !ring.visible) return;
    uniforms.uStrength.value = pump.grey * STRENGTH;
    const key = `${at.x},${at.y},${at.z}`;
    if (key !== ringAt) {
      ringAt = key;
      const wide = PUMP.grey * 2;
      ring.matrix.makeScale(wide, 1, wide).setPosition(at.x, at.y + view.lift(at.x, at.y, at.z) + 0.04, at.z);
      ring.matrixWorldNeedsUpdate = true;
    }
  });
}
