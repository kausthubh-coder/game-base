// Shows what the right button would set down before it does: a see-through copy of the held block on the
// face under the aim, or the floor plan of a held station, turned the way it would be placed. It turns red
// where the town's land or the hero's own body is in the way.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import type { Systems } from '../api.sim.ts';
import { footprint } from '../content/placeables.ts';
import type { GameView } from '../shell/view.ts';

const BODY_HALF = 0.3, BODY_TALL = 1.8;

export function install(view: GameView): void {
  const sys = view.game.systems as Partial<Systems>;
  const atlas = view.world.atlas;
  const texture = new THREE.CanvasTexture(atlas.canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(atlas.tile / atlas.canvas.width, atlas.tile / atlas.canvas.height);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box);
  const blockMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  const planMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.28, depthWrite: false, fog: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false, toneMapped: false });
  const ok = new THREE.Color(0xffffff), refused = new THREE.Color(0xff6a55);
  const block = new THREE.Mesh(box, blockMaterial);
  const plan = new THREE.Mesh(box, planMaterial);
  const lines = new THREE.LineSegments(edges, lineMaterial);
  const ghost = new THREE.Group();
  ghost.name = 'ghost';
  ghost.add(block, plan, lines);
  ghost.visible = false;
  ghost.renderOrder = 9;
  for (const part of [block, plan, lines]) { part.renderOrder = 9; part.frustumCulled = false; }
  view.scene.add(ghost);

  // What the ghost is drawn as, worked out again only when the held item changes.
  let heldId: string | null = null, blockId = -1, plannedKind: string | null = null;
  let size: readonly [number, number, number] = [1, 1, 1];
  /** The station's floor plan at the last turn, kept so a frame makes no new array. */
  let turned = -1, fp: [number, number, number] = [1, 1, 1];

  function hold(id: string | null): void {
    heldId = id;
    blockId = -1;
    plannedKind = null;
    if (!id) return;
    const def = view.game.systems.items.get(id);
    if (def.block !== undefined) {
      blockId = def.block;
      const tiles = BLOCKS[blockId]?.tiles;
      const cell = atlas.cells.get(tiles?.side || tiles?.top || '')?.[0];
      if (cell) {
        texture.offset.set((cell[0] * atlas.tile) / atlas.canvas.width, 1 - ((cell[1] + 1) * atlas.tile) / atlas.canvas.height);
        blockMaterial.color.set(0xffffff);
      } else {
        texture.offset.set(0, 0);
        blockMaterial.color.set(BLOCKS[blockId]?.color ?? 0xffffff);
      }
    } else if (def.placeable !== undefined) {
      const kind = sys.placeables?.defs().find((d) => d.kind === def.placeable);
      if (kind) { plannedKind = kind.kind; size = kind.size; turned = -1; }
    }
  }

  const town = (x: number, y: number, z: number): boolean => sys.region?.isProtected(x, y, z) ?? false;
  const solidAt = (x: number, y: number, z: number): boolean => BLOCKS[view.world.sim.getBlock(x, y, z)]?.solid === true;
  const p = view.game.player;
  const inBody = (x: number, y: number, z: number, sx: number, sy: number, sz: number): boolean =>
    p.pos.x + BODY_HALF > x && p.pos.x - BODY_HALF < x + sx && p.pos.z + BODY_HALF > z && p.pos.z - BODY_HALF < z + sz && p.pos.y + BODY_TALL > y && p.pos.y < y + sy;

  view.onFrame(() => {
    const aim = view.aim;
    const held = sys.inventory?.held()?.id ?? null;
    if (held !== heldId) hold(held);
    ghost.visible = false;
    if (!aim || !view.started || view.paused || p.busy || (blockId < 0 && plannedKind === null)) return;
    if (!(aim.nx || aim.ny || aim.nz)) return;
    const x = aim.x + aim.nx, y = aim.y + aim.ny, z = aim.z + aim.nz;

    if (blockId >= 0) {
      if (solidAt(x, y, z) || sys.placeables?.at(x, y, z)) return;
      const blocked = town(x, y, z) || inBody(x, y, z, 1, 1, 1);
      ghost.position.set(x + 0.5, y + 0.5, z + 0.5);
      ghost.scale.setScalar(1.002);
      block.visible = true;
      plan.visible = false;
      blockMaterial.opacity = blocked ? 0.3 : 0.55;
      lineMaterial.color.copy(blocked ? refused : ok);
      ghost.visible = true;
      return;
    }

    // A station is turned to face the player and starts at the aimed cell, as the actions system places it.
    const turns = (Math.round(p.facing / (Math.PI / 2)) + 2) & 3;
    if (turns !== turned) { turned = turns; fp = footprint(size, turns); }
    const [sx, sy, sz] = fp;
    const ax = turns === 1 ? x - sx + 1 : x, az = turns === 2 ? z - sz + 1 : z;
    let blocked = inBody(ax, y, az, sx, sy, sz);
    for (let cx = ax; cx < ax + sx && !blocked; cx++) {
      for (let cz = az; cz < az + sz && !blocked; cz++) {
        if (town(cx, y, cz) || !solidAt(cx, y - 1, cz) || sys.placeables?.at(cx, y, cz)) blocked = true;
        for (let cy = y; cy < y + sy && !blocked; cy++) if (solidAt(cx, cy, cz)) blocked = true;
      }
    }
    ghost.position.set(ax + sx / 2, y + sy / 2, az + sz / 2);
    ghost.scale.set(sx + 0.002, sy + 0.002, sz + 0.002);
    block.visible = false;
    plan.visible = true;
    planMaterial.color.copy(blocked ? refused : ok);
    lineMaterial.color.copy(blocked ? refused : ok);
    ghost.visible = true;
  });
}
