// Draws the player's camp: the fire and the tent at the place `camp`, the warm pool of light the fire lays on
// the ground, the sparks over it and the sound of it. Where everything stands is `CAMP` in content/region.ts.
//
// The fire is `cold` by day and `lit` from dusk. Once scene 9 has played it burns `low` until the night is
// over. While a film plays it holds the fire itself (src/game/worldview/camp.ts), and the fire here does as
// the film says, its light, its look and its sound.
//
// The campfire, the tent, the sparks and the smoke are made by another helper. Until each lands it stands in
// for itself: the brazier for the fire, the bed for the tent, fireflies for the sparks, no smoke. Each name is
// looked for when the game runs, so the art is picked up the day it is merged.
//
// One draw call of its own, the pool of light, and only near the camp at night.
import * as THREE from 'three';
import { PROPS } from '../../content/props.ts';
import { effects as EFFECTS, type EffectId } from '../../content/effects.ts';
import type { Vec3 } from '../../engine/types.ts';
import { FILMS, filmFlag } from '../content/cutscenes.ts';
import { CAMP } from '../content/region.ts';
import { isDark } from '../quests/rules.sim.ts';
import type { GameView } from '../shell/view.ts';
import { createFireSound, type FireSound } from '../uiview/film-sound.ts';
import { campOf } from '../worldview/camp.ts';
import { worldProps } from '../worldview/props.ts';
import { placeAt } from '../worldview/region.ts';

/** Seconds between two looks at the flags and the hour. */
const EVERY = 0.25;
/** The fire's light when it burns low, as a share of a fire burning well. A film's own track says the rest. */
const LOW = 0.66;
/** Further than this from the fire, in blocks, none of it is drawn and nothing of it is heard. */
const FAR = 80;
/** The fire is heard from this far, loudest beside it. */
const HEARD = 16;
/** Seconds between two puffs of sparks from a fire burning well, and of the fireflies that stand in for them. A low fire sends fewer. */
const SPARKS = 0.3, FIREFLIES = 3;
/** The brazier that stands in for the campfire is a town lamp on a post: cut down, it reads as a fire bowl on the ground. */
const BRAZIER = 0.45;
/** Seconds between two puffs of smoke. */
const SMOKE = 0.9;
/** The pool's width across, in blocks, at full light: the firelight reaches `CAMP.reach` each way. */
const POOL = CAMP.reach * 2.2;
/** Firelight on the ground: a deep orange that warms to yellow at the middle. */
const EMBER = new THREE.Color(1, 0.46, 0.16);
/** The night after scene 9 the fire stays low until this flag. */
const NIGHT_OVER = 'night.over';

const POOL_VERTEX = /* glsl */ `
varying vec2 vAt;
#include <fog_pars_vertex>
void main() {
  vAt = position.xz;
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const POOL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uFlicker;
varying vec2 vAt;
#include <fog_pars_fragment>
void main() {
  // Brightest at the stones, falling away softly to nothing at the rim, and a little yellower at the middle.
  float d = length(vAt) * 2.0;
  float pool = pow(max(1.0 - d, 0.0), 1.6) * uStrength * (1.0 + uFlicker * (1.0 - d));
  vec3 color = mix(uColor, vec3(1.0, 0.78, 0.45), max(1.0 - d * 2.5, 0.0));
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      pool *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      pool *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #endif
  gl_FragColor = vec4(color * pool, 1.0);
}
`;

const variantOf = (kind: string, name: string): number => {
  const def = (PROPS as Record<string, { variants: readonly string[] }>)[kind];
  return def ? Math.max(0, def.variants.indexOf(name)) : 0;
};
const effectOr = (want: string, or: EffectId | null): EffectId | null => (want in EFFECTS ? (want as EffectId) : or);

export function install(view: GameView): void {
  const { game } = view;
  const { flags } = game;
  const camp = campOf(view);
  const props = worldProps(view);
  const fire: Vec3 = { x: CAMP.fire.x, y: CAMP.fire.y, z: CAMP.fire.z };
  /** Films whose end leaves the fire low for the rest of the night. */
  const lowAfter = FILMS.filter((film) => film.place === 'camp').map(filmFlag);

  // ---------------------------------------------------------------- the fire and the tent
  const fireKind = props.has('campfire') ? 'campfire' : props.has('brazier') ? 'brazier' : null;
  const tentKind = props.has('tent') ? 'tent' : props.has('bed') ? 'bed' : null;
  const spark = effectOr('ember', 'firefly'), smoke = effectOr('campsmoke', null);
  const sparkEvery = spark === 'firefly' ? FIREFLIES : SPARKS;
  let fireHandle = 0, fireShown = '', tentHandle = 0;

  /** What the fire is doing now: `lit`, `low` or `cold`, and its light, 1 burning well. */
  let state: 'lit' | 'low' | 'cold' = 'cold', light = 0;
  function look(): void {
    const held = camp.held;
    if (held) {
      state = held.light <= 0 ? 'cold' : held.low ? 'low' : 'lit';
      light = held.light;
    } else if (!isDark(game.clock.timeOfDay)) {
      state = 'cold';
      light = 0;
    } else if (lowAfter.some((flag) => flags.is(flag)) && !flags.is(NIGHT_OVER)) {
      state = 'low';
      light = LOW;
    } else {
      state = 'lit';
      light = 1;
    }
  }

  function setDown(): void {
    if (fireKind) {
      // The brazier has one look. It stands in for every state of the fire.
      const name = fireKind === 'campfire' ? state : 'lit';
      if (name !== fireShown || !props.alive(fireHandle)) {
        props.remove(fireHandle);
        fireHandle = props.place(fireKind, variantOf(fireKind, name), fire.x, fire.y, fire.z, 0, fireKind === 'campfire' ? 1 : BRAZIER, true);
        fireShown = name;
      }
    }
    if (tentKind && !props.alive(tentHandle)) {
      tentHandle = props.place(tentKind, 0, CAMP.tent.x, CAMP.tent.y, CAMP.tent.z, CAMP.tent.rotation, 1, true);
    }
  }

  // ---------------------------------------------------------------- the light on the ground
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: EMBER },
    uStrength: { value: 0 },
    uFlicker: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'camp-glow',
    uniforms,
    vertexShader: POOL_VERTEX,
    fragmentShader: POOL_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material);
  pool.name = 'camp-glow';
  pool.renderOrder = 2;
  pool.frustumCulled = false;
  pool.matrixAutoUpdate = false;
  pool.visible = false;
  view.scene.add(pool);
  let poolLight = -1;
  function setPool(): void {
    if (light === poolLight) return;
    poolLight = light;
    // A low fire lights less ground, and less brightly.
    const wide = POOL * (0.55 + 0.45 * light);
    pool.matrix.makeScale(wide, 1, wide).setPosition(fire.x, fire.y + view.lift(fire.x, fire.y, fire.z) + 0.05, fire.z);
    pool.matrixWorldNeedsUpdate = true;
  }

  // ---------------------------------------------------------------- the sound
  let sound: FireSound | null = null;
  view.onAudio((audio) => { sound = createFireSound(audio.context, audio.effectsInput); });

  // ---------------------------------------------------------------- each frame
  const from: Vec3 = { x: 0, y: 0, z: 0 };
  let since = EVERY, sparkIn = 0, smokeIn = 0, found: boolean | null = null;
  view.onFrame((dt) => {
    if (!view.started) return;
    // A region without the camp draws none of it.
    if (found === null) {
      const at = placeAt(game, 'camp');
      found = at !== null;
      if (at) { fire.x = at.x; fire.y = at.y; fire.z = at.z; }
    }
    if (!found) return;
    since += dt;
    if (since >= EVERY || camp.held) {
      since = 0;
      look();
      setDown();
      setPool();
    }
    const player = game.player.pos;
    const far = Math.hypot(player.x - fire.x, player.z - fire.z);
    const near = far < FAR;
    // Firelight shows against the dusk and is all there is at night. It never quite holds still.
    const night = view.sky.look.night;
    const t = view.ctx.time;
    const flicker = 0.07 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 14.7 + 1.3) + 0.04 * Math.sin(t * 23.3 + 0.4);
    uniforms.uStrength.value = light * (0.35 + 0.75 * night);
    uniforms.uFlicker.value = flicker * 2;
    pool.visible = near && light > 0;

    // A film holds the fire's sound as it holds its light. Otherwise it is heard by how near the player is.
    const close = Math.max(0, 1 - far / HEARD);
    sound?.set(camp.held ? camp.held.sound : light * close * close * 0.75);
    sound?.update();

    if (!near || light <= 0) return;
    sparkIn -= dt;
    if (spark && sparkIn <= 0) {
      sparkIn = sparkEvery / Math.max(0.2, light * light);
      from.x = fire.x + (Math.random() - 0.5) * 0.3; from.y = fire.y + 0.45; from.z = fire.z + (Math.random() - 0.5) * 0.3;
      view.effects.play(spark, from);
    }
    smokeIn -= dt;
    if (smoke && smokeIn <= 0) {
      smokeIn = SMOKE;
      from.x = fire.x; from.y = fire.y + 0.9; from.z = fire.z;
      view.effects.play(smoke, from);
    }
  });
}
