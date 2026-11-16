// Staging: while a scene of content/scenes.ts plays in the dialogue box, it is acted in the world and framed.
//
//   The hero's mark. A scene with people stands the hero beside them, on the side nothing hides from the camera,
//     facing them; a scene's `staging.hero` names the mark itself. When the hero has to move there, the picture
//     cuts, so the first line already shows everyone who speaks.
//   The frame. The game's camera keeps the way it faces, so the player is never turned round; it comes in on the
//     hero and the people (whoever is talking, the stand-ins the story director put in the world, actors named
//     `stage:<who>`) close enough that they fill the space above the dialogue box. A film also drifts a little
//     round them, unless the player asked for reduced motion. When the conversation ends the camera eases back.
//   What the lines say. A scene's props stand from the line that names them, its beats play as their words show
//     (the Mark glowing in the hand, an eye opening, the hero turning to the camera), and the stage cues of a line,
//     which the box never prints (src/game/talk/cues.sim.ts), are acted: CUE_BEATS, or the speaker turns to the hero.
//
// The lens is moved after the game's camera has placed it each frame, as the film director does
// (story-cutscene.view.ts), and never while that director plays a film of its own.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import type { Actor, Systems, TalkLine } from '../api.sim.ts';
import { CONVERSATIONS } from '../content/dialogue.ts';
import type { NpcId } from '../content/ids.ts';
import { CUE_BEATS, sceneOf, type SceneBeat, type SceneDef } from '../content/scenes.ts';
import { clearCampTent } from '../region/ground.sim.ts';
import { openArea } from '../shell/sight.ts';
import type { GameView } from '../shell/view.ts';
import { STAND_IN, stageCentre } from '../story/scenes.sim.ts';
import { createStageActors } from '../uiview/stage-actors.ts';
import { splitCues } from '../talk/cues.sim.ts';
import { sceneNumber } from '../talk/index.sim.ts';
import { worldProps } from '../worldview/props.ts';
import { placeAt } from '../worldview/region.ts';

/** Seconds to ease in, and out. */
const EASE_IN = 0.7, EASE_OUT = 0.6;
/** Someone this far from the player is not in the frame. */
const IN_FRAME = 16;
/** The nearest the lens comes, for a close shot, a scene and a wide one, and the farthest. */
const CLOSE = 11, NEAR = 15, WIDE = 22, FAR = 44;
/** Blocks kept clear round the people at the frame's sides, and above their heads and below their feet. */
const SIDE_ROOM = 1.6, HEAD_ROOM = 2.6;
/** Radians a film drifts round its people a second, and the most it drifts. */
const DRIFT = 0.025, DRIFT_MAX = 0.12;
/** The head height looked at. */
const EYES = 1.1;
/** How far beside the people the hero is stood, past the farthest of them. */
const BESIDE = 2.2;
/** The hero is moved to a mark only when farther than this past the people's spread. */
const NEAR_ENOUGH = 3.5;
/** The share of the picture kept clear inside its band, as the sight check keeps it (src/game/shell/sight.ts). */
const EDGE = 0.04;
/** Where a hidden stand-in tries to stand instead: blocks across the picture and toward the camera, nearest first. */
const STEP_ASIDE: readonly [number, number][] = [[1.5, 0], [-1.5, 0], [0, 1.5], [3, 0], [-3, 0], [1.5, 1.5], [-1.5, 1.5], [0, 3], [4.5, 0], [-4.5, 0]];
/** Extra clear marks for the Gallery memory, beyond its raised dais. */
const MEMORY_ASIDE: readonly (readonly [number, number])[] = [...STEP_ASIDE, [0, 4.5], [0, 6]];
const MEMORY_HEIGHTS = [0.4, 0.7, 1.1, 1.5] as const;
const MEMORY_SIDES = [-0.3, 0, 0.3] as const;
/** Seconds between two sparks of the Mark in the hand. */
const SPARK_EVERY = 0.18;

/** Who speaks in each conversation, by person. */
const speakersOf = new Map(CONVERSATIONS.map((c) => [c.id, new Set<string>(c.lines.flatMap((line) => {
  const by = typeof line === 'string' ? c.npc : line.by ?? c.npc;
  return by === 'narrator' ? [] : [by];
}))]));

export function install(view: GameView): void {
  const { game, root } = view;
  const sys = game.systems as Partial<Systems>;
  const talk = sys.talk;
  if (!talk) return;
  const lens = view.ctx.camera as THREE.PerspectiveCamera;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const props = worldProps(view);

  const centre = new THREE.Vector3();
  const rigPos = new THREE.Vector3(), rigDir = new THREE.Vector3(), rigLook = new THREE.Vector3();
  const want = new THREE.Vector3(), look = new THREE.Vector3(), flat = new THREE.Vector3(), right = new THREE.Vector3();
  /** Where the framing was when the conversation ended, so it eases out from there. */
  const lastCentre = new THREE.Vector3();
  let lastDistance = NEAR;
  let k = 0;
  let drift = 0;
  let staging = false;
  /** True once the stand-ins were looked at again from the scene's own camera. */
  let recleared = false;
  /** How far the game's camera looks down this frame. */
  let pitchNow = 0.6;

  // ---------------------------------------------------------------- the scene playing now
  let scene: SceneDef | null = null;
  /** The people of the scene in the world: its stand-ins, and whoever speaks in it and is here. */
  const people: Actor[] = [];
  /** Props stood for the scene, with the words of the line they wait for. */
  const stood: { handle: number; at: string | undefined; index: number }[] = [];
  /** Where the scene is staged. */
  const stageAt = { x: 0, y: 0, z: 0 };
  /** The line shown last, and what it asked for. */
  let lineKey = '';
  /** The band of the screen the picture shows above the box and between a film's bars, from the top. */
  let area = { top: 0, bottom: 0.74 };
  let hand = false, sparks = 0;
  /** Actors woken by a cue: their sleeping look stays gone for the rest of the scene. */
  const woken: Actor[] = [];
  /** People of the world who speak in the scene, held where they stand until it ends. */
  const held: NpcId[] = [];
  /** Nearby passers-by leave the scene 27 shot until it ends. */
  const bystanders: Actor[] = [];

  const stageActors = createStageActors(game.actors);

  function clearScene(): void {
    stageActors.clear();
    for (const actor of bystanders) actor.visible = true;
    bystanders.length = 0;
    for (const who of held) sys.people?.hold(who, false);
    held.length = 0;
    for (const p of stood) if (p.handle > 0) props.remove(p.handle);
    stood.length = 0;
    people.length = 0;
    woken.length = 0;
    scene = null;
    lineKey = '';
    hand = false;
  }

  /** The way the lens looks across the ground, and its right, from the lens as the game's camera placed it. */
  function ground(): void {
    lens.getWorldDirection(flat);
    flat.y = 0;
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
    flat.normalize();
    right.set(-flat.z, 0, flat.x);
  }

  const tentProbe = { x: 0, y: 0, z: 0 };
  /** True when the hero can stand here: on ground near the scene's height, with room for a body and no water. */
  function standable(x: number, y: number, z: number, near: number): boolean {
    if (Math.abs(y - near) > 1.6) return false;
    // Scene 27 plays beside the camp. Canvas is a model, absent from the block probe below.
    if (scene?.n === 27 && (game.flags.is('camp.pitched') || game.flags.is('quest.ground.done')) && placeAt(game, 'camp')) {
      tentProbe.x = x; tentProbe.y = y; tentProbe.z = z;
      if (clearCampTent(tentProbe)) return false;
    }
    const fx = Math.floor(x), fz = Math.floor(z), fy = Math.floor(y + 0.01);
    for (let dy = 0; dy < 2; dy++) {
      const b = BLOCKS[game.world.getBlock(fx, fy + dy, fz)];
      if (b?.solid || b?.liquid) return false;
    }
    return true;
  }

  /** Faces the hero toward a point, or toward the camera. */
  function faceHero(x: number | null, z = 0): void {
    const p = game.player.pos;
    if (x === null) {
      ground();
      view.hero.body.facing = Math.atan2(-flat.x, flat.z);
    } else {
      view.hero.body.facing = Math.atan2(x - p.x, -(z - p.z));
    }
  }

  function turnToHero(actor: Actor): void {
    const p = game.player.pos;
    actor.facing = Math.atan2(p.x - actor.pos.x, -(p.z - actor.pos.z));
  }

  /**
   * A stand-in something solid hides from the camera (the grant stone, a wall) steps aside, across the picture or
   * toward the camera, to the nearest spot in the clear. The hero is not the only one who must be seen.
   */
  // Probe past the ordinary own-place exclusion, so nearby dais and wall pieces count.
  const memoryRay = new THREE.Vector3();
  function clearMemoryBody(x: number, y: number, z: number): boolean {
    if (scene?.n !== 28) return true;
    lens.getWorldDirection(memoryRay);
    for (const height of MEMORY_HEIGHTS) for (const side of MEMORY_SIDES) {
      if (view.blocked(x + right.x * side + memoryRay.x, y + height - EYES + memoryRay.y, z + right.z * side + memoryRay.z)) return false;
    }
    return true;
  }

  function clearStandIns(): void {
    ground();
    for (const a of people) {
      if (!a.id.startsWith(STAND_IN)) continue;
      if ((scene?.n !== 27 || standable(a.pos.x, a.pos.y, a.pos.z, a.pos.y)) && !view.blocked(a.pos.x, a.pos.y, a.pos.z) && clearMemoryBody(a.pos.x, a.pos.y, a.pos.z)) continue;
      for (const [across, toward] of (scene?.n === 28 ? MEMORY_ASIDE : STEP_ASIDE)) {
        const x = a.pos.x + right.x * across - flat.x * toward, z = a.pos.z + right.z * across - flat.z * toward;
        const y = game.world.heightAt(Math.floor(x), Math.floor(z));
        if (!standable(x, y, z, a.pos.y) || view.blocked(x, y, z) || !clearMemoryBody(x, y, z)) continue;
        if (scene?.n === 27 && people.some((other) => other !== a && Math.hypot(other.pos.x - x, other.pos.z - z) < 2.5)) continue;
        a.pos.x = x; a.pos.y = y; a.pos.z = z;
        break;
      }
    }
  }

  /** Stands the hero on the scene's mark: its own, or beside the people where nothing hides them. True when the hero moved. */
  function mark(def: SceneDef): boolean {
    const p = game.player.pos;
    const at = stageCentre(game, def.n);
    const own = def.staging?.hero;
    let mx = NaN, mz = NaN;
    if (own) {
      mx = at.x + own.x; mz = at.z + own.z;
    } else if (people.length > 0) {
      let cx = 0, cz = 0;
      for (const a of people) { cx += a.pos.x; cz += a.pos.z; }
      cx /= people.length; cz /= people.length;
      let spread = 0;
      for (const a of people) spread = Math.max(spread, Math.hypot(a.pos.x - cx, a.pos.z - cz));
      // Already with them, in the clear: the hero stays where the player put them.
      if (Math.hypot(p.x - cx, p.z - cz) <= spread + NEAR_ENOUGH && (def.n !== 27 || (standable(p.x, p.y, p.z, p.y) && !view.blocked(p.x, p.y - 0.7, p.z) && !view.blocked(p.x, p.y + 0.4, p.z))) && !view.blocked(p.x, p.y, p.z)) return false;
      ground();
      const reach = spread + BESIDE;
      // Beside them, a little toward the camera: either side, the nearer to the hero first. Then in front, then round them.
      const tries: [number, number][] = [];
      const side = (p.x - cx) * right.x + (p.z - cz) * right.z >= 0 ? 1 : -1;
      for (const s of [side, -side]) tries.push([cx + right.x * s * reach - flat.x * 0.8, cz + right.z * s * reach - flat.z * 0.8]);
      tries.push([cx - flat.x * reach, cz - flat.z * reach]);
      for (const ring of [1, 3]) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          tries.push([cx + Math.cos(a) * (reach + ring), cz + Math.sin(a) * (reach + ring)]);
        }
      }
      // Last, the place the scene is staged at, which is somewhere a person stands.
      tries.push([at.x, at.z]);
      const y0 = people[0]!.pos.y;
      for (const [x, z] of tries) {
        const y = game.world.heightAt(Math.floor(x), Math.floor(z));
        if (!standable(x, y, z, y0)) continue;
        if (view.blocked(x, y, z)) continue;
        if (def.n === 27 && (view.blocked(x, y - 0.7, z) || view.blocked(x, y + 0.4, z))) continue;
        mx = x; mz = z;
        break;
      }
      if (!(mx === mx) && def.n !== 27) { mx = tries[0]![0]; mz = tries[0]![1]; }
    }
    if (!(mx === mx) || Math.hypot(mx - p.x, mz - p.z) < 1) return false;
    view.hero.teleport(mx, game.world.heightAt(Math.floor(mx), Math.floor(mz)), mz);
    return true;
  }

  function begin(id: string): void {
    clearScene();
    const conversation = CONVERSATIONS.find((c) => c.id === id);
    // The map is an unnumbered conversation, but its speaker still needs a staged frame.
    const def = conversation ? sceneOf(id === 'talk.vaults' ? 17 : sceneNumber(conversation)) : undefined;
    if (!conversation || !def) return;
    scene = def;
    recleared = false;
    const p = game.player.pos;
    const at = stageCentre(game, def.n);
    stageAt.x = at.x; stageAt.y = at.y; stageAt.z = at.z;
    stageActors.begin(def, at, (x, z) => game.world.heightAt(Math.floor(x), Math.floor(z)));
    const speakers = speakersOf.get(id);
    for (const actor of game.actors.values()) {
      if (!actor.visible) continue;
      const speaks = actor.id.startsWith('npc:') && speakers?.has(actor.id.slice(4));
      if ((actor.id.startsWith(STAND_IN) || speaks) && Math.hypot(actor.pos.x - p.x, actor.pos.z - p.z) <= 30) people.push(actor);
      // Whoever speaks stays to say it, and does not walk off on their day's round.
      if (speaks && sys.people?.get(actor.id.slice(4) as NpcId)) {
        sys.people.hold(actor.id.slice(4) as NpcId, true);
        held.push(actor.id.slice(4) as NpcId);
      }
    }
    const memory = def.memory === true;
    clearStandIns();
    const moved = !memory && mark(def);
    // The people face the hero, and the hero faces them or the camera.
    for (const a of people) turnToHero(a);
    if (def.staging?.hero?.face === 'camera') faceHero(null);
    else if (people.length > 0) {
      let cx = 0, cz = 0;
      for (const a of people) { cx += a.pos.x; cz += a.pos.z; }
      faceHero(cx / people.length, cz / people.length);
    }
    // A cut, not a glide, when the hero was moved: the first line shows them where they stand.
    if (moved) k = 1;
    for (const prop of def.staging?.props ?? []) stood.push({ handle: 0, at: prop.at, index: stood.length });
  }

  /** Stands the props whose line has come. */
  function standProps(text: string): void {
    if (!scene) return;
    const at = stageCentre(game, scene.n);
    const defs = scene.staging?.props ?? [];
    for (const p of stood) {
      const def = defs[p.index];
      if (!def || p.handle || (def.at && !text.includes(def.at))) continue;
      const by = def.by ? (game.actors.get(`${STAND_IN}${def.by}`) ?? game.actors.get(`npc:${def.by}`))?.pos : undefined;
      const x = (by ?? at).x + def.x, z = (by ?? at).z + def.z;
      p.handle = props.place(def.kind, def.variant, x, game.world.heightAt(Math.floor(x), Math.floor(z)), z, def.turn ?? 0, def.scale ?? 1, true) || -1;
    }
  }

  function beat(what: SceneBeat, speaker: Actor | undefined): void {
    if (what === 'hand') hand = true;
    else if (what === 'face') faceHero(null);
    else if (what === 'wake' && speaker && !woken.includes(speaker)) woken.push(speaker);
  }

  /** A new line: its props, its beats and its cues. */
  function onLine(line: TalkLine): void {
    hand = false;
    standProps(line.text);
    const speaker = line.npc ? (game.actors.get(`npc:${line.npc}`) ?? game.actors.get(`${STAND_IN}${line.npc}`)) : undefined;
    for (const b of scene?.staging?.beats ?? []) if (line.text.includes(b.at)) beat(b.do, speaker);
    for (const cue of splitCues(line.text).cues) {
      const known = CUE_BEATS[cue];
      if (known) beat(known, speaker);
      else if (speaker) turnToHero(speaker);
    }
  }

  view.game.events.on('talk.started', ({ conversation }) => begin(conversation));
  view.game.events.on('talk.ended', () => clearScene());

  /** The middle of the people in the scene, and how far the frame must reach across and up. Allocates nothing. */
  const reach = { across: 0, up: 0 };
  function frame(line: TalkLine): void {
    const player = game.player.pos;
    // In a memory the player is hidden, and not part of the picture.
    const hero = game.actors.get('player');
    let n = hero && !hero.visible ? 0 : 1;
    if (n) centre.set(player.x, player.y, player.z);
    else centre.set(0, 0, 0);
    const also = scene?.staging?.frame;
    const framed = (actor: Actor): boolean =>
      actor.visible && (actor.id.startsWith(STAND_IN) || (!!line.npc && actor.id === `npc:${line.npc}`) || people.includes(actor) || !!also?.includes(actor.id)) &&
      Math.hypot(actor.pos.x - player.x, actor.pos.z - player.z) <= IN_FRAME;
    for (const actor of game.actors.values()) {
      if (!framed(actor)) continue;
      centre.x += actor.pos.x; centre.y += actor.pos.y; centre.z += actor.pos.z;
      n++;
    }
    // A scene that stands the hero on its own mark is about its place: the door behind the hero.
    const place = scene?.staging?.hero ? stageAt : null;
    if (place) { centre.x += place.x; centre.y += place.y; centre.z += place.z; n++; }
    if (n === 0) centre.set(player.x, player.y, player.z);
    else centre.divideScalar(n);
    // How far each one stands from the middle, across the picture and into it.
    // Up the picture, ground farther off and a body standing higher both climb.
    reach.across = 0; reach.up = 0;
    const sin = Math.sin(pitchNow), cos = Math.cos(pitchNow);
    const measure = (x: number, y: number, z: number): void => {
      const dx = x - centre.x, dz = z - centre.z;
      reach.across = Math.max(reach.across, Math.abs(dx * right.x + dz * right.z));
      reach.up = Math.max(reach.up, Math.abs((dx * flat.x + dz * flat.z) * sin + (y - centre.y) * cos));
    };
    if (!hero || hero.visible) measure(player.x, player.y, player.z);
    for (const actor of game.actors.values()) if (framed(actor)) measure(actor.pos.x, actor.pos.y, actor.pos.z);
    if (place) measure(place.x, place.y, place.z);
  }

  function clearBystander(actor: Actor): void {
    if (!actor.visible || people.includes(actor) || !(actor.id.startsWith('npc:') || actor.id.startsWith('pet:'))) return;
    if (Math.hypot(actor.pos.x - game.player.pos.x, actor.pos.z - game.player.pos.z) > IN_FRAME) return;
    actor.visible = false;
    if (!bystanders.includes(actor)) bystanders.push(actor);
  }

  view.onFrame((dt) => {
    const line = talk.active ? talk.current() : null;
    if (!line && scene) clearScene();
    if (line) {
      if (scene?.n === 27) {
        game.actors.forEach(clearBystander);
      }
      const key = `${line.npc}|${line.text}`;
      if (key !== lineKey) { lineKey = key; onLine(line); area = openArea(root); }
      // What a cue woke stays awake, whatever the rules draw it as.
      for (const a of woken) { a.anim = 'idle'; a.mark = ''; }
      if (hand && (sparks -= dt) <= 0) {
        sparks = SPARK_EVERY;
        const p = view.playerPosition;
        ground();
        view.effects.play('trail', { x: p.x + right.x * 0.25 - flat.x * 0.3, y: p.y + 0.85, z: p.z + right.z * 0.25 - flat.z * 0.3 });
      }
    }
    // The film director has the camera while it plays a film of its own.
    const theirs = root.classList.contains('sf-on');
    // A scene is framed whatever its kind; an everyday conversation keeps the game's own camera.
    const on = !!line && (line.kind !== 'talk' || line.scene > 0 || scene !== null) && !theirs;
    if (on) {
      ground();
      pitchNow = Math.asin(Math.max(-0.95, Math.min(0.95, -lens.getWorldDirection(rigDir).y)));
      frame(line);
      lastCentre.copy(centre);
      // Far enough that everyone fits across the frame and from head to foot above the dialogue box.
      const half = THREE.MathUtils.degToRad(lens.fov) / 2;
      const across = (reach.across + SIDE_ROOM) / (Math.tan(half) * lens.aspect * 0.9);
      const up = (2 * reach.up + HEAD_ROOM) / (2 * Math.tan(half) * Math.max(0.3, area.bottom - area.top - 2 * EDGE));
      const shot = scene?.staging?.shot;
      const least = scene?.staging?.distance ?? (shot === 'close' ? CLOSE : shot === 'wide' ? WIDE : NEAR);
      // A portrait viewport has less horizontal room at the same vertical field of view.
      // Let its distance limit grow with that loss so the cast is not clipped at the sides.
      const far = FAR / Math.min(1, lens.aspect);
      lastDistance = Math.min(far, Math.max(least, across, up));
      if (!staging) drift = 0;
      staging = true;
      k = Math.min(1, k + dt / EASE_IN);
      // Once the camera has come in, a stand-in it still finds hidden steps aside: what hid them may have been
      // drawn only now. Done once a scene.
      if (k >= 1 && !recleared) { recleared = true; clearStandIns(); }
      if (line.kind === 'film' && !reduced) drift = Math.min(DRIFT_MAX, drift + DRIFT * dt);
    } else {
      staging = false;
      k = theirs ? 0 : Math.max(0, k - dt / EASE_OUT);
    }
    if (k <= 0) return;
    const ease = k * k * (3 - 2 * k);

    // The game's camera has placed the lens for this frame: the framing keeps its direction, closer in.
    rigPos.copy(lens.position);
    lens.getWorldDirection(rigDir);
    rigLook.copy(rigPos).addScaledVector(rigDir, rigPos.distanceTo(lastCentre));
    look.copy(lastCentre);
    look.y += EYES;
    // The way the camera faces across the ground, turned a little for a film's drift.
    flat.set(rigDir.x, 0, rigDir.z);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
    flat.normalize();
    if (drift) flat.applyAxisAngle(THREE.Object3D.DEFAULT_UP, drift);
    // The same pitch as the game's camera, so the scene is seen as the world is.
    const pitch = Math.asin(Math.max(-0.95, Math.min(0.95, -rigDir.y)));
    // The people sit in the middle of the band the box and the bars leave: look a little nearer than them, which
    // lowers the aim and raises them in the picture.
    const tall = 2 * lastDistance * Math.tan(THREE.MathUtils.degToRad(lens.fov) / 2);
    look.addScaledVector(flat, -(tall * (0.5 - (area.top + area.bottom) / 2)) / Math.max(0.2, Math.sin(pitch)));
    want.copy(look).addScaledVector(flat, -Math.cos(pitch) * lastDistance);
    want.y += Math.sin(pitch) * lastDistance;
    lens.position.lerpVectors(rigPos, want, ease);
    rigLook.lerp(look, ease);
    lens.lookAt(rigLook);
  });
}
