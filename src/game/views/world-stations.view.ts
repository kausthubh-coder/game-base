import { loadEnvironmentModels } from '../../features/props/models.view.ts';
// Draws the stations the player set down: every entry of `game.systems.placeables.all()` gets the prop
// its definition names (workbench, chest, bed), turned by its quarter turns.
//
// Nothing is sent when a station is removed or when a save is loaded, so each frame the list is compared
// with what was drawn.
import type { Placed, Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { footprint } from '../content/placeables.ts';
import { worldProps } from '../worldview/props.ts';

/**
 * A prop may reach this far past the cells its station takes up: a fifth of a block over each edge. A longer
 * prop is drawn smaller. The bed takes two blocks and fits them. The workbench is 1.7 blocks on one.
 */
const OVERHANG = 0.4;

interface Shown {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  quarterTurns: number;
  handle: number;
  /** The frame it was last in the list. */
  seen: number;
}

export async function install(view: GameView): Promise<void> {
  await loadEnvironmentModels();
  const { game } = view;
  const props = worldProps(view);
  const shown: Shown[] = [];
  const byId = new Map<string, Shown>();
  /** The prop and the size in blocks of each kind of station, from the definitions. */
  const defOf = new Map<string, { prop: string; size: readonly [number, number, number] }>();
  let pass = 0;

  function draw(placed: Placed): number {
    let def = defOf.get(placed.kind);
    if (def === undefined) {
      const found = (game.systems as Partial<Systems>).placeables?.defs().find((d) => d.kind === placed.kind);
      def = { prop: found?.prop ?? placed.kind, size: found?.size ?? [1, 1, 1] };
      defOf.set(placed.kind, def);
    }
    if (!props.has(def.prop)) return 0;
    const [sx, , sz] = footprint(def.size, placed.quarterTurns);
    const scale = Math.min(1, (Math.max(sx, sz) + OVERHANG) / props.span(def.prop, 0));
    // A station's front faces north at no turns and goes clockwise seen from above. A prop's front faces south at no rotation.
    const rotation = Math.PI - (placed.quarterTurns * Math.PI) / 2;
    return props.place(def.prop, 0, placed.x + sx / 2, placed.y, placed.z + sz / 2, rotation, scale, true);
  }

  view.onFrame(() => {
    const list = (game.systems as Partial<Systems>).placeables?.all();
    pass++;
    for (let i = 0; list && i < list.length; i++) {
      const placed = list[i];
      let s = byId.get(placed.id);
      if (s && (s.kind !== placed.kind || s.x !== placed.x || s.y !== placed.y || s.z !== placed.z || s.quarterTurns !== placed.quarterTurns)) {
        props.remove(s.handle);
        s.handle = 0;
      }
      if (!s) {
        s = { id: placed.id, kind: placed.kind, x: 0, y: 0, z: 0, quarterTurns: 0, handle: 0, seen: 0 };
        shown.push(s);
        byId.set(s.id, s);
      }
      if (s.handle === 0) {
        s.kind = placed.kind; s.x = placed.x; s.y = placed.y; s.z = placed.z; s.quarterTurns = placed.quarterTurns;
        s.handle = draw(placed);
      }
      s.seen = pass;
    }
    for (let i = shown.length - 1; i >= 0; i--) {
      const s = shown[i];
      if (s.seen === pass) continue;
      props.remove(s.handle);
      byId.delete(s.id);
      shown.splice(i, 1);
    }
  });
}
