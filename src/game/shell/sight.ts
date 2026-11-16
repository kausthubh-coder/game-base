// What the camera keeps in sight, each frame once the lens is placed: the hero, the person the hero is talking to,
// the people a scene stood in the world, and the beasts of a running fight. The camera's sight rule
// (src/features/camera/sight.sim.ts) decides what to cut for them, and the painted light cuts it.
import * as THREE from 'three';
import type { CameraView } from '../../features/camera/index.ts';
import { setSight } from '../../features/painted/index.ts';
import type { Game, Systems } from '../api.sim.ts';
import { STAND_IN } from '../story/scenes.sim.ts';
import { BIOMES } from '../content/greenhollow.ts';
import { biomeMix } from '../region/greenhollow.sim.ts';

/** A beast's hole is this much wider than its body. */
const BEAST_ROOM = 0.9;
/**
 * The kinds of land whose crowns roof the ground, and how much of the wide hole each opens: under them the game's
 * camera looks through it. The grey forest's crowns are pale and its giants stand far apart, so it opens less and
 * more of its crowns and trunks stay in the picture.
 */
const GROVES: readonly (readonly [number, number])[] = [[BIOMES.indexOf('oldForest'), 1], [BIOMES.indexOf('greyForest'), 0.7]];

/** One body that should be seen, as a check finds it on screen. */
export interface Seen {
  /** `player`, `npc:<who>`, `stage:<who>` or `beast:<kind>`. */
  who: string;
  x: number; y: number; z: number;
  /** Where its chest falls on the screen, 0 to 1 from the top left, or null behind the lens. */
  screen: { x: number; y: number } | null;
  /** True when the chest is on screen, clear of the edges and, while someone talks, above the dialogue box. */
  inFrame: boolean;
  /** What stands between the lens and its chest or body samples and is not cut away, or null when nothing does. */
  hiddenBy: string | null;
}

export interface Sight {
  /** Keeps this frame's points in sight. `hero` is where the hero is drawn. Allocates nothing. */
  frame(dt: number, hero: { x: number; y: number; z: number }): void;
  /**
   * The hero, the person talking, a scene's people and a fight's beasts: whether each is in the frame and whether
   * anything left standing hides it. For checks: it casts rays through the scene, so never call it every frame.
   */
  report(): Seen[];
  /**
   * What solid thing would stand in front of a body standing here, seen the way the lens looks, cut away or not, or
   * null: where a scene puts its people.
   */
  blocked(x: number, y: number, z: number): string | null;
}

/** What a ray from the lens passes through without counting it: what is not solid, or is drawn over everything. */
const SEE_PAST = new Set(['sprites', 'sprite-shadows', 'grass', 'effects', 'waypoint-beam', 'aim', 'ghost', 'build-tiles', 'build-ghost', 'build-lift',
  'fight-sparks', 'fight-ground', 'fight-figures', 'sky', 'sky-fill', 'cloud-shadows', 'sky-phenomena', 'backdrop', 'far-land', 'painted-water', 'forest-shafts',
  'camp-glow', 'hall-glow', 'river-lamp-glow', 'river-lamps', 'pump-grey', 'wet-soil', 'crops']);
/** How far back along the camera's way a scene looks for what would hide someone. */
const ALONG = 30;
/** Within this much of the body, what the ray meets is the body's own place: the sack it sits on, the plinth. */
const OWN_ROOM = 0.9;
/** A voice farther than this from the hero speaks from out of the picture: through a stone, from the pack. */
const VOICE_REACH = 16;
const near = (actor: { pos: { x: number; z: number } }, hero: { x: number; z: number }): boolean => Math.hypot(actor.pos.x - hero.x, actor.pos.z - hero.z) <= VOICE_REACH;

/** The share of the screen kept clear at its edges. */
const EDGE = 0.04;

/**
 * The band of the screen the picture shows while someone talks, as shares of its height from the top: below a
 * film's top bar, above its bottom bar and above the dialogue box (src/game/views/ui-talk.view.ts). The whole screen
 * when nobody talks. It reads the page, so call it when a line changes, not every frame.
 */
export function openArea(root: HTMLElement): { top: number; bottom: number } {
  const h = root.clientHeight || window.innerHeight || 1;
  let top = 0, bottom = h;
  // Heights, not boxes: a bar sliding in is scaled, and its box is not yet where it will be.
  const barTop = root.querySelector<HTMLElement>('.ui-talk-bars:not([hidden]) .ui-talk-bar-top');
  const barBottom = root.querySelector<HTMLElement>('.ui-talk-bars:not([hidden]) .ui-talk-bar-bottom');
  if (barTop) top = barTop.offsetHeight;
  if (barBottom) bottom = h - barBottom.offsetHeight;
  const clear = parseFloat(getComputedStyle(root).getPropertyValue('--ui-talk-clear'));
  if (clear > 0) bottom = Math.min(bottom, h - clear);
  return { top: top / h, bottom: bottom / h };
}

export function createSight(game: Game, camera: CameraView, lens: THREE.Camera, heightAt: (x: number, z: number) => number, scene: THREE.Scene, root: HTMLElement, hero: () => { x: number; y: number; z: number }): Sight {
  const sys = game.systems as Partial<Systems>;
  const rule = camera.sight;

  const ray = new THREE.Raycaster(), towards = new THREE.Vector3(), eyeAt = new THREE.Vector3();
  /**
   * What stands between the lens and this point, or null. With `cuts`, what the sight rule and the block cutaway
   * cut away does not count; without, anything solid does.
   */
  function blocker(at: THREE.Vector3, cuts: boolean, along = false): string | null {
    if (along) {
      // From the way the lens looks, wherever it stands: a scene's camera comes in along that way.
      lens.getWorldDirection(towards).negate();
      ray.set(eyeAt.copy(at).addScaledVector(towards, ALONG), towards.negate());
      ray.far = ALONG - OWN_ROOM;
    } else {
      const eye = lens.position;
      ray.set(eye, towards.copy(at).sub(eye).normalize());
      // Keep close roots in the report; a body can stand inside their branches.
      ray.far = eye.distanceTo(at) - 0.05;
    }
    for (const child of scene.children) {
      if (!child.visible || SEE_PAST.has(child.name)) continue;
      for (const hit of ray.intersectObject(child, true)) {
        if (!visibleAll(hit.object)) continue;
        const material = (hit.object as THREE.Mesh).material as THREE.Material | THREE.Material[];
        const one = Array.isArray(material) ? material[0] : material;
        if (!one || one.transparent || !one.depthWrite) continue;
        const p = hit.point, d = ray.ray.direction;
        if (cuts && child.name === 'world') {
          // A block: the cutaway hides it, or it stands.
          if (camera.hides(Math.floor(p.x + d.x * 0.01), Math.floor(p.y + d.y * 0.01), Math.floor(p.z + d.z * 0.01)) || rule.cuts(p.x, p.y, p.z) >= 0.5) continue;
        } else if (cuts) {
          const see = one.userData.see as string | undefined;
          if (see && see !== 'none' && rule.cuts(p.x, p.y, p.z, see === 'leaves', see === 'wood') >= 0.5) continue;
        }
        return `${child.name}: ${hit.object.name || hit.object.type}`;
      }
    }
    return null;
  }

  function report(): Seen[] {
    const bodies: { who: string; x: number; y: number; z: number }[] = [];
    const running = sys.fights?.running?.() ?? null;
    const me = game.actors.get('player'), h = hero();
    if (running || (camera.mode !== 'first' && (!me || me.visible))) bodies.push({ who: 'player', ...h });
    const line = sys.talk?.active ? sys.talk.current() : null;
    for (const actor of game.actors.values()) {
      if (!actor.visible) continue;
      if ((line?.npc && actor.id === `npc:${line.npc}` && near(actor, h)) || (line && actor.id.startsWith(STAND_IN))) bodies.push({ who: actor.id, x: actor.pos.x, y: actor.pos.y, z: actor.pos.z });
    }
    if (running && running.over < 0) {
      for (const beast of running.fight.beasts) if (beast.doing !== 'calmed') bodies.push({ who: `beast:${beast.def.kind}`, x: beast.x, y: heightAt(beast.x, beast.z), z: beast.z });
    }
    const at = new THREE.Vector3(), point = new THREE.Vector3();
    const area = line ? openArea(root) : { top: 0, bottom: 1 };
    return bodies.map((body) => {
      at.set(body.x, body.y + rule.options.chest, body.z);
      point.copy(at).project(lens);
      const ahead = point.z > -1 && point.z < 1;
      const screen = ahead ? { x: (point.x + 1) / 2, y: (1 - point.y) / 2 } : null;
      const inFrame = !!screen && screen.x > EDGE && screen.x < 1 - EDGE && screen.y > area.top + EDGE && screen.y < area.bottom - EDGE;
      let hiddenBy = blocker(at, true);
      // Sample the body as well as the chest, including roots inside the old own-place exclusion.
      const right = new THREE.Vector3().setFromMatrixColumn(lens.matrixWorld, 0);
      for (const height of [0.4, 0.7, 1.5]) {
        for (const side of [-0.3, 0, 0.3]) {
          at.set(body.x, body.y + height, body.z).addScaledVector(right, side);
          hiddenBy ??= blocker(at, true);
        }
      }
      return { who: body.who, x: body.x, y: body.y, z: body.z, screen, inFrame, hiddenBy };
    });
  }

  const spot = new THREE.Vector3(), mix = new Float32Array(BIOMES.length);
  /** How much grove the hero stands in, 0 to 1: full once two thirds of the land round them is grove. */
  function groveShare(x: number, z: number): number {
    biomeMix(x, z, mix);
    let share = 0;
    for (const [k, open] of GROVES) share += (mix[k] as number) * open;
    return Math.min(1, share * 1.5);
  }
  return {
    report,
    blocked(x, y, z) {
      spot.set(x, y + rule.options.chest, z);
      return blocker(spot, false, true);
    },
    frame(dt, hero) {
      rule.clear();
      const running = sys.fights?.running?.() ?? null;
      const me = game.actors.get('player');
      // In a memory the hero is not in the picture, and nothing need be cut for them. A fight hides the actor and
      // draws the hero as a figure of its own.
      if (running || (camera.mode !== 'first' && (!me || me.visible))) rule.keep(hero.x, hero.y, hero.z);
      const line = sys.talk?.active ? sys.talk.current() : null;
      // Whoever speaks comes next, in the world or stood in for: a level with few points keeps them first.
      const speaker = line?.npc ? (game.actors.get(`${STAND_IN}${line.npc}`) ?? game.actors.get(`npc:${line.npc}`)) : undefined;
      if (speaker?.visible && near(speaker, hero)) rule.keep(speaker.pos.x, speaker.pos.y, speaker.pos.z);
      if (line) {
        for (const actor of game.actors.values()) {
          if (actor.visible && actor.id.startsWith(STAND_IN)) rule.keep(actor.pos.x, actor.pos.y, actor.pos.z);
        }
      }
      if (running && running.over < 0) {
        for (const beast of running.fight.beasts) {
          if (beast.doing === 'calmed') continue;
          rule.keep(beast.x, heightAt(beast.x, beast.z), beast.z, Math.max(rule.options.radius, beast.def.radius + BEAST_ROOM));
        }
      }
      // Only the game's own camera looks down through the crowns; the free and first-person ones stand under them.
      rule.underGrove(camera.mode === 'tilt' ? groveShare(hero.x, hero.z) : 0);
      const eye = lens.position;
      rule.update(dt, eye.x, eye.y, eye.z, hero.x, hero.y, hero.z, camera.roofs);
      setSight(rule.state, rule.options);
    },
  };
}

function visibleAll(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}
