// Draws the stations the player set down: every entry of `game.systems.placeables.all()` gets the prop
// its definition names (workbench, chest, bed), turned by its quarter turns.
//
// Nothing is sent when a station is removed or when a save is loaded, so each frame the list is compared
// with what was drawn.
import type { Placed, Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { worldProps } from '../worldview/props.ts';

/**
 * A station takes up one block, and some props are longer: the workbench is 1.7 blocks and the bed 2.
 * A prop is drawn smaller until its longer side is this many blocks, so it stays on its own block with
 * a fifth of a block over each edge.
 */
const LONGEST = 1.4;

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

export function install(view: GameView): void {
  const { game } = view;
  const props = worldProps(view);
  const shown: Shown[] = [];
  const byId = new Map<string, Shown>();
  /** The prop of each kind of station, from the definitions. */
  const propOf = new Map<string, string>();
  let pass = 0;

  function draw(placed: Placed): number {
    let prop = propOf.get(placed.kind);
    if (prop === undefined) {
      prop = (game.systems as Partial<Systems>).placeables?.defs().find((def) => def.kind === placed.kind)?.prop ?? placed.kind;
      propOf.set(placed.kind, prop);
    }
    if (!props.has(prop)) return 0;
    const scale = Math.min(1, LONGEST / props.span(prop, 0));
    // A station's front faces north at no turns and goes clockwise seen from above. A prop's front faces south at no rotation.
    const rotation = Math.PI - (placed.quarterTurns * Math.PI) / 2;
    return props.place(prop, 0, placed.x + 0.5, placed.y, placed.z + 0.5, rotation, scale, true);
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
