// Build mode in the world: G turns it on, and from then the left button paints strokes.
//
// What this view draws, all of it from `game.systems.build.plan()`:
//   - a soft grid on the level ground around the pointer, so cells can be counted before anything is placed;
//   - a tile on every cell of the stroke: green where it will change, amber where the bag runs short, red
//     where it is refused, blue for the can;
//   - the thing itself, see-through, for a chest or a sprinkler, turned as it would stand, and a post or a
//     block on every cell of a line;
//   - the soil a sprinkler would keep wet, before it is placed;
//   - a box around a placed thing that a press would take back into the hand.
// When a stroke lands, its cells flash and puff one after another outward from the press, each with the
// recorded sound of its tool: the hoe, the seed going in, the can.
//
// What it does with the keys: the left button down is `build.press()`, up is `build.release()`, and a button
// the window lost is `build.cancel()`. The right button cancels a stroke. Q and R turn a held chest. Z takes
// the last stroke back. The model of those events is docs/verify/build-stroke/Stroke.tla.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';
import { buildProp } from '../../features/props/index.ts';
import { SOLID } from '../../features/world/chunk.sim.ts';
import { emptyHit } from '../../features/world/index.ts';
import type { BuildPlan, CellVerdict, PlaceableDef, StrokeKind, Systems } from '../api.sim.ts';
import { LINE_SPAN, MAX_CELLS } from '../build/plan.sim.ts';
import type { Press } from '../shell/keys.ts';
import type { GameView } from '../shell/view.ts';
import { KNOWS_BUILD_FLAG } from '../uiview/build.ts';
import { worldProps } from '../worldview/props.ts';

/** The grid reaches this many cells from the pointer each way, at each quality. */
const GRID_REACH: Record<Quality, number> = { low: 4, medium: 6, high: 7 };
const GRID_MOST = (2 * 7 + 1) ** 2;
/** The most cells a sprinkler's reach is drawn on: five blocks each way. */
const REACH_MOST = 11 * 11;
const TILES = GRID_MOST + MAX_CELLS + REACH_MOST + MAX_CELLS;
/** Numbers for one tile: x, y, z, style, then red, green, blue, alpha, then the second it was born. */
const STRIDE = 9;
/** A tile floats this far over the ground, above the wet patch of the crops. */
const LIFT = 0.03;
/** The styles the shader knows: thin lines, a filled cell, and a flash that fades. */
const LINES = 0, FILL = 1, FLASH = 2;
/** Seconds a flash lasts, and the longest a stroke takes to finish landing. */
const FLASH_SECONDS = 0.4, LAND_SECONDS = 0.7;
/** A stroke of more cells than this sounds on every second cell, and so on, so it never roars. */
const SOUNDS = 14;
/** The can's pour is a long sound, so a stroke with the can plays it this many times at most. */
const POURS = 3;
/** A station's prop may reach this far over its cells, as the stations view lets it. */
const OVERHANG = 0.4;

const SOIL = BLOCKS.find((block) => block.key === 'tilled_soil')?.id ?? -1;

const UNIT: readonly [number, number, number] = [1, 1, 1];
const USE: readonly Press['kind'][] = ['use'];
const USE_AND_TURN: readonly Press['kind'][] = ['use', 'turn'];

const VERTEX = /* glsl */ `
attribute vec4 aTile;
attribute vec4 aTint;
attribute float aBorn;
uniform float uTime;
varying vec2 vUv;
varying vec4 vTint;
varying float vStyle;
varying float vAge;
void main() {
  vUv = uv;
  vTint = aTint;
  vStyle = aTile.w;
  vAge = uTime - aBorn;
  gl_Position = projectionMatrix * viewMatrix * vec4(position.x + aTile.x, aTile.y, position.z + aTile.z, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform float uFlash;
varying vec2 vUv;
varying vec4 vTint;
varying float vStyle;
varying float vAge;
void main() {
  vec2 d = min(vUv, 1.0 - vUv);
  float rim = 1.0 - smoothstep(0.03, 0.055, min(d.x, d.y));
  float a;
  if (vStyle < 0.5) a = rim;
  else if (vStyle < 1.5) a = mix(0.42, 1.0, rim);
  else {
    float t = clamp(vAge / uFlash, 0.0, 1.0);
    a = (1.0 - t) * (1.0 - t);
  }
  a *= vTint.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vTint.rgb, a);
}`;

/** The color of a cell for each verdict, and how strong it is. The can's cells are blue. */
const TINT: Record<CellVerdict, { color: THREE.Color; alpha: number }> = {
  ok: { color: new THREE.Color(0x9be36b), alpha: 0.6 },
  short: { color: new THREE.Color(0xffc24a), alpha: 0.6 },
  skip: { color: new THREE.Color(0xfff4d6), alpha: 0.16 },
  far: { color: new THREE.Color(0xff6a55), alpha: 0.3 },
  town: { color: new THREE.Color(0xff6a55), alpha: 0.55 },
  ground: { color: new THREE.Color(0xff6a55), alpha: 0.4 },
  wrong: { color: new THREE.Color(0xff6a55), alpha: 0.4 },
  blocked: { color: new THREE.Color(0xff6a55), alpha: 0.55 },
};
/** The ghost has no light on it, so it is drawn a little over its own colors to read against shaded grass. */
const BRIGHT = new THREE.Color(1.35, 1.35, 1.35);
const WATER = new THREE.Color(0x6ec6ff), GRID = new THREE.Color(0xfff4d6), WHITE = new THREE.Color(0xffffff), REFUSED = new THREE.Color(0xff8a78), LIFT_COLOR = new THREE.Color(0x66e4cf);

/** One cell that is still to land: where, what was done to it, and the second its puff and its sound are due. */
interface Landing { x: number; y: number; z: number; kind: StrokeKind; undone: boolean; at: number; sound: boolean }

export function install(view: GameView): void {
  const { game, keys, effects } = view;
  const sys = game.systems as Partial<Systems>;
  const sim = view.world.sim;
  const lens = view.ctx.camera;
  const props = worldProps(view);

  // ---------------------------------------------------------------- the tiles: one draw call
  const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('uv', quad.getAttribute('uv'));
  const data = new Float32Array(TILES * STRIDE);
  const buffer = new THREE.InstancedInterleavedBuffer(data, STRIDE);
  buffer.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aTile', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  geometry.setAttribute('aTint', new THREE.InterleavedBufferAttribute(buffer, 4, 4));
  geometry.setAttribute('aBorn', new THREE.InterleavedBufferAttribute(buffer, 1, 8));
  geometry.instanceCount = 0;
  const uniforms = { uTime: { value: 0 }, uFlash: { value: FLASH_SECONDS } };
  const tiles = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false, fog: false, toneMapped: false,
  }));
  tiles.name = 'build-tiles';
  tiles.frustumCulled = false;
  tiles.renderOrder = 8;
  tiles.visible = false;
  view.scene.add(tiles);
  let count = 0;

  function tile(x: number, y: number, z: number, style: number, color: THREE.Color, alpha: number, born = 0): void {
    if (count >= TILES) return;
    const at = count++ * STRIDE;
    data[at] = x + 0.5; data[at + 1] = y + 1 + LIFT; data[at + 2] = z + 0.5; data[at + 3] = style;
    data[at + 4] = color.r; data[at + 5] = color.g; data[at + 6] = color.b; data[at + 7] = alpha;
    data[at + 8] = born;
  }

  // ---------------------------------------------------------------- the grid, kept until the pointer moves to another cell
  const grid = new Float32Array(GRID_MOST * 4);
  let gridCount = 0, gridX = NaN, gridY = NaN, gridZ = NaN, gridAge = 0;

  function layGrid(x: number, y: number, z: number): void {
    const reach = GRID_REACH[view.ctx.quality];
    gridCount = 0;
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        const far = Math.hypot(dx, dz) / (reach + 0.5);
        // Level ground only: a solid block with nothing on it.
        if (far >= 1 || !SOLID[sim.getBlock(x + dx, y, z + dz)] || SOLID[sim.getBlock(x + dx, y + 1, z + dz)]) continue;
        const at = gridCount++ * 4;
        grid[at] = x + dx; grid[at + 1] = y; grid[at + 2] = z + dz; grid[at + 3] = 0.42 * (1 - far) * (1 - far);
      }
    }
    gridX = x; gridY = y; gridZ = z; gridAge = 0;
  }

  // ---------------------------------------------------------------- the ghosts: the thing itself, a line of posts, a line of blocks
  // The ghosts write depth: a chest is many parts in one mesh, and without it the far parts draw over the near ones.
  const ghostMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, fog: false });
  const shapes = new Map<string, THREE.BufferGeometry>();
  const shapeOf = (prop: string, variant: number): THREE.BufferGeometry | null => {
    const key = `${prop}:${variant}`;
    let shape = shapes.get(key);
    if (shape === undefined && props.has(prop)) shapes.set(key, (shape = buildProp(prop, variant)));
    return shape ?? null;
  };
  const ghost = new THREE.Mesh(new THREE.BufferGeometry(), ghostMaterial);
  ghost.name = 'build-ghost';
  ghost.renderOrder = 9;
  ghost.frustumCulled = false;
  ghost.visible = false;
  view.scene.add(ghost);

  const postMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, fog: false });
  const posts = new THREE.InstancedMesh(new THREE.BufferGeometry(), postMaterial, LINE_SPAN);
  const boxMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), boxMaterial, LINE_SPAN);
  for (const line of [posts, boxes]) {
    line.renderOrder = 9;
    line.frustumCulled = false;
    line.visible = false;
    line.count = 0;
    line.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    view.scene.add(line);
  }
  let postsOf = '';

  const liftBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: LIFT_COLOR, transparent: true, opacity: 0.95, depthTest: false, fog: false, toneMapped: false }),
  );
  liftBox.name = 'build-lift';
  liftBox.renderOrder = 10;
  liftBox.frustumCulled = false;
  liftBox.visible = false;
  view.scene.add(liftBox);

  const matrix = new THREE.Matrix4(), tint = new THREE.Color();
  const defs = new Map<string, PlaceableDef | null>();
  const defOf = (kind: string): PlaceableDef | null => {
    let def = defs.get(kind);
    if (def === undefined) defs.set(kind, (def = sys.placeables?.defs().find((d) => d.kind === kind) ?? null));
    return def;
  };

  // ---------------------------------------------------------------- the pointer
  const origin = new THREE.Vector3(), ray = new THREE.Vector3();
  const hit = emptyHit(), treeHit = emptyHit();

  /** Tells the build system which block the pointer is on. A locked mouse points from the middle of the screen. */
  function takePoint(): void {
    const build = sys.build;
    if (!build) return;
    const centre = keys.mouse === 'lock';
    const pointer = keys.pointer;
    // A drag that turns the camera, and a pointer that left the picture, point at nothing.
    if (!centre && (!pointer.over || keys.dragging)) { build.point(null); return; }
    // During a stroke the canvas keeps the pointer, also over the quick slots and the panels. There the stroke
    // stays where the pointer left the ground, and does not reach for the land behind the HUD.
    if (!centre && build.dragging) {
      const over = document.elementFromPoint(((pointer.x + 1) / 2) * window.innerWidth, ((1 - pointer.y) / 2) * window.innerHeight);
      if (over !== view.canvas) { build.point(null); return; }
    }
    origin.copy(lens.position);
    ray.set(centre ? 0 : pointer.x, centre ? 0 : pointer.y, 0.5).unproject(lens).sub(origin).normalize();
    const onBlock = sim.raycast(origin.x, origin.y, origin.z, ray.x, ray.y, ray.z, 500, hit, view.camera.hides);
    // A tree in front of the ground is nowhere to build.
    if (!onBlock || sys.trees?.raycast(origin, ray, hit.distance, treeHit)) { build.point(null); return; }
    build.point(hit);
  }

  // ---------------------------------------------------------------- a stroke landing
  const landings: Landing[] = [];
  const flashes = new Float32Array(MAX_CELLS * 4);
  let flashNext = 0;
  const at: Vec3 = { x: 0, y: 0, z: 0 };

  function land(l: Landing): void {
    at.x = l.x + 0.5; at.y = l.y + 0.5; at.z = l.z + 0.5;
    // The flash lies on the ground the cell stands on: the soil itself, or the block under a thing that was set down.
    const ground = l.kind === 'block' || l.kind === 'place' ? l.y - 1 : l.y;
    const f = flashNext++ % MAX_CELLS * 4;
    flashes[f] = l.x; flashes[f + 1] = ground; flashes[f + 2] = l.z; flashes[f + 3] = view.ctx.time;
    const top = { x: at.x, y: ground + 1.05, z: at.z };
    if (l.undone) {
      effects.play('popDust', top, { scale: 0.6 });
      if (l.sound) view.audio?.emit({ type: 'blockBroken', surface: 'dirt', at: { ...at } });
    } else if (l.kind === 'till') {
      effects.play('dust', top, { color: 0x8a6a45 });
      if (l.sound) view.audio?.emit({ type: 'foley', sound: 'hoe', at: { ...at } });
    } else if (l.kind === 'plant') {
      effects.play('popDust', top, { scale: 0.5 });
      if (l.sound) view.audio?.emit({ type: 'foley', sound: 'plant', at: { ...at } });
    } else if (l.kind === 'water') {
      effects.play('splash', top, { scale: 0.6 });
      if (l.sound) view.audio?.emit({ type: 'foley', sound: 'pour', at: { ...at } });
    } else {
      const surface = l.kind === 'block' ? BLOCKS[sim.getBlock(l.x, l.y, l.z)]?.surface ?? 'wood' : 'wood';
      effects.play('pop', top);
      if (l.sound) view.audio?.emit({ type: 'blockPlaced', surface, at: { ...at } });
    }
  }

  game.events.on('build.applied', ({ kind, undone }) => {
    const cells = sys.build?.last() ?? [];
    const calm = view.settings.graphics.reduceMotion;
    const every = Math.ceil(cells.length / (kind === 'water' && !undone ? POURS : SOUNDS));
    // The cells land one after another, nearest the press first, and a long stroke lands faster so it ends in time.
    const gap = cells.length > 1 ? Math.min(0.04, LAND_SECONDS / cells.length) : 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      landings.push({ x: c.x, y: c.y, z: c.z, kind: c.kind, undone, at: view.ctx.time + (calm ? 0 : i * gap), sound: i % every === 0 });
    }
  });

  // ---------------------------------------------------------------- the keys
  let lifted = -1;
  /** True when a panel or a conversation ended build mode, so it comes back when the player is free again. */
  let resume = false;
  game.events.on('build.mode', ({ active }) => {
    resume = !active && game.player.busy;
    // Once the player has used build mode, the chip that names its key has done its work.
    if (active) game.flags.set(KNOWS_BUILD_FLAG, true);
    view.claim('build', active ? USE : null);
    keys.capturePrimary(active);
    view.audio?.emit({ type: 'ui', sound: active ? 'open' : 'close' });
    // The 2.5D camera steps back once to show more ground, and comes back when build mode ends, unless the wheel moved it since.
    const camera = view.camera;
    if (camera.mode !== 'tilt') { lifted = -1; return; }
    if (active) {
      const before = camera.zoom;
      camera.zoomBy(1);
      lifted = camera.zoom !== before ? camera.zoom : -1;
    } else {
      if (lifted >= 0 && camera.zoom === lifted) camera.zoomBy(-1);
      lifted = -1;
    }
  });

  keys.onPress((press) => {
    const build = sys.build;
    if (!build) return;
    // The button is gone, so the stroke ends, whatever else is going on. A pause takes the keys before this
    // view hears of it, and a stroke left behind would sit under the pointer with no button to end it.
    if (press.kind === 'letGo') {
      if (press.why === 'up' && build.active && view.started && !view.paused) { takePoint(); build.release(); }
      else build.cancel();
      return;
    }
    if (!view.started || view.paused) return;
    if (press.kind === 'build') {
      resume = false;
      if (!game.player.busy) build.setActive(!build.active);
      return;
    }
    if (!build.active) return;
    if (press.kind === 'use' && press.button === 'primary') {
      takePoint();
      // A press that starts nothing says so quietly.
      if (!build.press() && !game.player.busy) view.audio?.emit({ type: 'ui', sound: 'click' });
    } else if (press.kind === 'use') {
      build.cancel();
    } else if (press.kind === 'turn') {
      // Q and R turn the piece only while one is in the hand. Otherwise they are the camera's, and the shell has them.
      if (!turning) return;
      build.turn(press.direction);
      view.audio?.emit({ type: 'ui', sound: 'click' });
    } else if (press.kind === 'undo') {
      if (!build.undo()) view.audio?.emit({ type: 'ui', sound: 'click' });
    }
  });

  let turning = false;

  // ---------------------------------------------------------------- one frame
  view.onFrame(() => {
    const build = sys.build;
    const now = view.ctx.time;
    uniforms.uTime.value = now;
    while (landings.length > 0 && landings[0].at <= now) land(landings.shift() as Landing);
    // Opening the bag to fetch another piece ends build mode in the rules. It is back when the bag closes.
    if (resume && build && !build.active && !game.player.busy && view.started && !view.paused) {
      resume = false;
      build.setActive(true);
    }
    if (!build?.active || !view.started || view.paused) {
      if (turning) { turning = false; if (build?.active) view.claim('build', USE); }
      // A stroke that is still landing shows its flashes after build mode is left.
      count = 0;
      drawFlashes(now);
      ghost.visible = posts.visible = boxes.visible = liftBox.visible = false;
      finish();
      return;
    }
    // A drag that turns the camera drops the stroke, as a right click does. So does a stroke whose button is
    // no longer down, however that came about: Stroke.tla's NoStuckStroke, held here as well as by `letGo`.
    if (build.dragging && (keys.dragging || !keys.primary)) build.cancel();
    takePoint();
    const plan = build.plan();
    const turnable = plan !== null && plan.tool.kind === 'place' && plan.tool.shape === 'one';
    if (turnable !== turning) { turning = turnable; view.claim('build', turnable ? USE_AND_TURN : USE); }

    count = 0;
    if (!plan) {
      drawFlashes(now);
      ghost.visible = posts.visible = boxes.visible = liftBox.visible = false;
      finish();
      return;
    }
    // The grid follows the pointer, and is laid again now and then because the ground under it can change.
    if (plan.ax !== gridX || plan.y !== gridY || plan.az !== gridZ || ++gridAge > 20) layGrid(plan.ax, plan.y, plan.az);
    for (let i = 0; i < gridCount; i++) tile(grid[i * 4], grid[i * 4 + 1], grid[i * 4 + 2], LINES, GRID, grid[i * 4 + 3]);

    drawReach(plan);
    if (!plan.lift) drawCells(plan);
    drawFlashes(now);
    drawGhosts(plan, now);
    drawLift(plan);
    finish();
  });

  function finish(): void {
    geometry.instanceCount = count;
    tiles.visible = count > 0;
    if (count > 0) buffer.needsUpdate = true;
  }

  function drawCells(plan: BuildPlan): void {
    const water = plan.tool.kind === 'water';
    for (let i = 0; i < plan.cells.length; i++) {
      const cell = plan.cells[i], look = TINT[cell.verdict];
      // A pointer that only hovers shows its one cell more softly than a stroke in progress.
      tile(cell.x, plan.y, cell.z, FILL, water && cell.verdict === 'ok' ? WATER : look.color, look.alpha * (plan.dragging ? 1 : 0.75));
    }
  }

  /** The soil a sprinkler keeps wet: under the one in the hand, or under a placed one the pointer is on. */
  function drawReach(plan: BuildPlan): void {
    const held = plan.tool.placeable?.waters ? plan.tool.placeable : null;
    const lifted = plan.lift ? defOf(plan.lift.kind) : null;
    const reach = held?.waters ?? lifted?.waters ?? 0;
    if (reach <= 0 || reach > 5) return;
    const x = held ? plan.ax : (plan.lift?.x ?? 0), z = held ? plan.az : (plan.lift?.z ?? 0);
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        if (dx === 0 && dz === 0) continue;
        const id = sim.getBlock(x + dx, plan.y, z + dz);
        if (!SOLID[id] || SOLID[sim.getBlock(x + dx, plan.y + 1, z + dz)]) continue;
        // Soil it will water is strong, and the rest of its reach is faint.
        tile(x + dx, plan.y, z + dz, FILL, WATER, id === SOIL ? 0.55 : 0.14);
      }
    }
  }

  function drawFlashes(now: number): void {
    if (view.ctx.quality === 'low') return;
    for (let i = 0; i < MAX_CELLS; i++) {
      const born = flashes[i * 4 + 3];
      if (born <= 0 || now - born > FLASH_SECONDS) continue;
      tile(flashes[i * 4], flashes[i * 4 + 1], flashes[i * 4 + 2], FLASH, WHITE, 0.8, born);
    }
  }

  function drawGhosts(plan: BuildPlan, now: number): void {
    const tool = plan.tool;
    ghost.visible = posts.visible = boxes.visible = false;
    if (plan.lift || plan.cells.length === 0) return;
    const calm = view.settings.graphics.reduceMotion;

    if (tool.kind === 'place' && tool.placeable && tool.shape === 'one') {
      const def = tool.placeable;
      const shape = shapeOf(def.prop, 0);
      if (!shape) return;
      const sx = plan.turns & 1 ? def.size[2] : def.size[0], sz = plan.turns & 1 ? def.size[0] : def.size[2];
      const ok = plan.cells[0].verdict === 'ok';
      const scale = Math.min(1, (Math.max(sx, sz) + OVERHANG) / props.span(def.prop, 0));
      // It breathes a little while it waits, so it reads as not yet there.
      const breath = calm ? 1 : 1 + 0.025 * Math.sin(now * 5);
      ghost.geometry = shape;
      ghost.position.set(plan.ax + sx / 2, plan.y + 1, plan.az + sz / 2);
      ghost.rotation.y = Math.PI - (plan.turns * Math.PI) / 2;
      ghost.scale.set(scale * breath, scale * (calm ? 1 : 2 - breath), scale * breath);
      ghostMaterial.color.copy(ok ? BRIGHT : REFUSED);
      ghostMaterial.opacity = ok ? 0.88 : 0.55;
      ghost.visible = true;
      return;
    }

    const line = tool.kind === 'place' && tool.placeable?.joins ? posts : tool.kind === 'block' ? boxes : null;
    if (!line) return;
    if (line === posts) {
      const prop = tool.placeable?.prop ?? '';
      if (postsOf !== prop) {
        const shape = shapeOf(prop, 1);
        if (!shape) return;
        posts.geometry = shape;
        postsOf = prop;
      }
    } else {
      boxMaterial.color.setHex(BLOCKS[tool.block]?.color ?? 0xffffff);
    }
    let n = 0;
    for (let i = 0; i < plan.cells.length && n < LINE_SPAN; i++) {
      const cell = plan.cells[i];
      if (cell.verdict === 'skip') continue;
      const ok = cell.verdict === 'ok';
      if (line === posts) matrix.makeTranslation(cell.x + 0.5, plan.y + 1, cell.z + 0.5);
      else matrix.makeScale(0.96, 0.96, 0.96).setPosition(cell.x + 0.5, plan.y + 1.5, cell.z + 0.5);
      line.setMatrixAt(n, matrix);
      line.setColorAt(n, tint.copy(ok ? WHITE : cell.verdict === 'short' ? TINT.short.color : REFUSED));
      n++;
    }
    line.count = n;
    line.instanceMatrix.needsUpdate = true;
    if (line.instanceColor) line.instanceColor.needsUpdate = true;
    line.visible = n > 0;
  }

  function drawLift(plan: BuildPlan): void {
    const placed = plan.lift;
    liftBox.visible = placed !== null;
    if (!placed) return;
    const size = defOf(placed.kind)?.size ?? UNIT;
    const odd = placed.quarterTurns & 1;
    const sx = odd ? size[2] : size[0], sy = size[1], sz = odd ? size[0] : size[2];
    liftBox.position.set(placed.x + sx / 2, placed.y + sy / 2, placed.z + sz / 2);
    liftBox.scale.set(sx + 0.04, sy + 0.04, sz + 0.04);
  }

}
