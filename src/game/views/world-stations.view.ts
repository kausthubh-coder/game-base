// Draws the stations the player set down: every entry of `game.systems.placeables.all()` gets the prop
// its definition names (workbench, chest, bed), turned by its quarter turns.
//
// A kind that `joins`, the fence, is drawn as one post to a cell, with rails to the same kind standing
// east and south of it. So a line, a corner and a closed pen all join by themselves.
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
  /** For a kind that joins: the rails to the same kind east and south of it, or 0. */
  east: number;
  south: number;
  joins: boolean;
  /** The frame it was last in the list. */
  seen: number;
}

/** The variants of a joining prop: the post alone, and the rails alone. */
const POST = 1, RAILS = 2;

export function install(view: GameView): void {
  const { game } = view;
  const props = worldProps(view);
  const shown: Shown[] = [];
  const byId = new Map<string, Shown>();
  /** The prop and the size in blocks of each kind of station, from the definitions. */
  const defOf = new Map<string, { prop: string; size: readonly [number, number, number]; joins: boolean }>();
  let pass = 0;

  function defFor(kind: string): { prop: string; size: readonly [number, number, number]; joins: boolean } {
    let def = defOf.get(kind);
    if (def === undefined) {
      const found = (game.systems as Partial<Systems>).placeables?.defs().find((d) => d.kind === kind);
      def = { prop: found?.prop ?? kind, size: found?.size ?? [1, 1, 1], joins: found?.joins === true };
      defOf.set(kind, def);
    }
    return def;
  }

  // `?chest=sprite` leaves the chests to the build lab, which draws them as flat pictures to compare the two.
  const flatChests = new URLSearchParams(location.search).get('chest') === 'sprite';

  function draw(placed: Placed): number {
    const def = defFor(placed.kind);
    if (!props.has(def.prop) || (flatChests && placed.kind === 'chest')) return 0;
    if (def.joins) return props.place(def.prop, POST, placed.x + 0.5, placed.y, placed.z + 0.5, 0, 1, true);
    const [sx, , sz] = footprint(def.size, placed.quarterTurns);
    const scale = Math.min(1, (Math.max(sx, sz) + OVERHANG) / props.span(def.prop, 0));
    // A station's front faces north at no turns and goes clockwise seen from above. A prop's front faces south at no rotation.
    const rotation = Math.PI - (placed.quarterTurns * Math.PI) / 2;
    return props.place(def.prop, 0, placed.x + sx / 2, placed.y, placed.z + sz / 2, rotation, scale, true);
  }

  /** Stands the rails of every joining thing again. It runs only when one of them came, went or moved. */
  function join(): void {
    const placeables = (game.systems as Partial<Systems>).placeables;
    for (const s of shown) {
      if (!s.joins) continue;
      props.remove(s.east);
      props.remove(s.south);
      s.east = s.south = 0;
      const prop = defFor(s.kind).prop;
      if (!placeables || !props.has(prop)) continue;
      if (placeables.at(s.x + 1, s.y, s.z)?.kind === s.kind) s.east = props.place(prop, RAILS, s.x + 1, s.y, s.z + 0.5, 0, 1, true);
      if (placeables.at(s.x, s.y, s.z + 1)?.kind === s.kind) s.south = props.place(prop, RAILS, s.x + 0.5, s.y, s.z + 1, Math.PI / 2, 1, true);
    }
  }

  view.onFrame(() => {
    const list = (game.systems as Partial<Systems>).placeables?.all();
    let joinsChanged = false;
    pass++;
    for (let i = 0; list && i < list.length; i++) {
      const placed = list[i];
      let s = byId.get(placed.id);
      if (s && (s.kind !== placed.kind || s.x !== placed.x || s.y !== placed.y || s.z !== placed.z || s.quarterTurns !== placed.quarterTurns)) {
        props.remove(s.handle);
        s.handle = 0;
      }
      if (!s) {
        s = { id: placed.id, kind: placed.kind, x: 0, y: 0, z: 0, quarterTurns: 0, handle: 0, east: 0, south: 0, joins: false, seen: 0 };
        shown.push(s);
        byId.set(s.id, s);
      }
      if (s.handle === 0) {
        s.kind = placed.kind; s.x = placed.x; s.y = placed.y; s.z = placed.z; s.quarterTurns = placed.quarterTurns;
        s.joins = defFor(placed.kind).joins;
        s.handle = draw(placed);
        if (s.joins) joinsChanged = true;
      }
      s.seen = pass;
    }
    for (let i = shown.length - 1; i >= 0; i--) {
      const s = shown[i];
      if (s.seen === pass) continue;
      props.remove(s.handle);
      props.remove(s.east);
      props.remove(s.south);
      if (s.joins) joinsChanged = true;
      byId.delete(s.id);
      shown.splice(i, 1);
    }
    if (joinsChanged) join();
  });
}
