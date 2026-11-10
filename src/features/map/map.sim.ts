// The map as rules: what has been seen, what is marked, and where the active waypoint is from the
// player. One object that saves and loads as plain JSON. The drawing is in the .view.ts and .ui.ts files.
import { bearingTo, distanceTo } from './geometry.sim.ts';
import { Marks, type MarksSave } from './marks.sim.ts';
import { SeenCells, type SeenSave } from './seen.sim.ts';

export interface MapSave extends MarksSave {
  v: 1;
  seen: SeenSave;
}

/** How far and which way the active waypoint is. */
export interface Heading {
  /** Blocks along the ground, or -1 when no waypoint is active. */
  distance: number;
  /** The compass direction, 0 north and PI / 2 east. */
  bearing: number;
}

export class MapRules {
  readonly seen = new SeenCells();
  readonly marks = new Marks();

  /** The distance and bearing from a point to the active waypoint. Writes into `out`. The distance is -1 when nothing is active. */
  headingFrom(x: number, z: number, out: Heading): Heading {
    const active = this.marks.active;
    if (!active) {
      out.distance = -1;
      out.bearing = 0;
      return out;
    }
    out.distance = distanceTo(x, z, active.x, active.z);
    out.bearing = bearingTo(x, z, active.x, active.z);
    return out;
  }

  /** Everything the map keeps, as plain JSON. */
  save(): MapSave {
    return { v: 1, seen: this.seen.save(), ...this.marks.save() };
  }

  /** Replaces the map with a save. Returns false, with an empty map, when the save is not one this version can read. */
  load(save: unknown): boolean {
    const data = save as Partial<MapSave> | null;
    if (!data || typeof data !== 'object' || data.v !== 1) {
      this.seen.clear();
      this.marks.load(null);
      return false;
    }
    const seen = this.seen.load(data.seen);
    return this.marks.load(data) && seen;
  }
}
