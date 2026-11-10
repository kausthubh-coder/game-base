// Layouts for the two pages that show props on their own: the contact sheet (every prop and variant of a
// group in rows, labeled) and the turntable (`?only=<kind>`: one kind alone, with its triangle count).
// Everything on one page is drawn at one scale, so sizes can be compared.
import * as THREE from 'three';
import { PROPS, PROP_KINDS, propDef, type PropGroup, type PropKind } from '../../src/content/props.ts';
import { buildProp, propExtras } from '../../src/features/props/index.ts';

export const GROUPS: PropGroup[] = ['tree', 'plant', 'ground', 'town', 'clutter', 'station'];
export const GROUP_NAMES: Record<PropGroup, string> = { tree: 'Trees', plant: 'Small plants', ground: 'Ground', town: 'Town', clutter: 'Clutter', station: 'Stations' };

/** The camera looks down at this angle on both pages, as the game's does. */
export const PITCH = (35 * Math.PI) / 180;
/** A label is about this many pixels wide and tall, on a page 1600 wide. */
const LABEL = { wide: 168, tall: 50, page: 1600 };

export interface Item {
  kind: PropKind;
  variant: number;
  /** Where it stands. */
  x: number;
  z: number;
  /** The middle of its own box, from where it stands, and the box's size. */
  offsetX: number;
  offsetZ: number;
  width: number;
  depth: number;
  height: number;
  triangles: number;
  budget: number;
}

export interface Layout {
  items: Item[];
  /** The box that holds every item and its label: across, back to front, and the tallest item of the back row. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  high: number;
  /** The tallest item of all. */
  tallest: number;
}

function measure(kind: PropKind, variant: number): Omit<Item, 'x' | 'z'> {
  const geometry = buildProp(kind, variant);
  const box = geometry.boundingBox as THREE.Box3;
  const item = {
    kind, variant,
    offsetX: (box.min.x + box.max.x) / 2, offsetZ: (box.min.z + box.max.z) / 2,
    width: box.max.x - box.min.x, depth: box.max.z - box.min.z, height: box.max.y,
    triangles: propExtras(geometry).triangles, budget: propDef(kind).triangles,
  };
  geometry.dispose();
  return item;
}

/**
 * Rows of every variant of these kinds, in order, wrapped into about `rows` rows. Each item gets the
 * room it needs and no less than a label's width. Rows are spaced so that, seen from PITCH, a tall row
 * does not cover the labels of the row behind it.
 */
export function layoutRows(kinds: readonly PropKind[], rows: number): Layout {
  const measured = kinds.flatMap((kind) => PROPS[kind].variants.map((_, variant) => measure(kind, variant)));
  // Two passes: the first guesses how many meters a row holds, the second gives each item at least a label's width of them.
  let rowWide = 0;
  let cells: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const least = (rowWide * LABEL.wide) / LABEL.page;
    cells = measured.map((m) => Math.max(m.width * 1.15 + 0.2, least));
    rowWide = Math.max(Math.max(...cells), cells.reduce((sum, c) => sum + c, 0) / rows);
  }
  const perMeter = LABEL.page / rowWide;
  const labelDeep = LABEL.tall / perMeter / Math.sin(PITCH);

  // Fill rows from the back. A row is full when half of the next item would pass its width, and the last row takes what is left.
  const lines: number[][] = [[]];
  let used = 0;
  measured.forEach((_, i) => {
    if (used + cells[i] / 2 > rowWide && lines.length < rows) {
      lines.push([]);
      used = 0;
    }
    lines[lines.length - 1].push(i);
    used += cells[i];
  });
  const widest = Math.max(...lines.map((line) => line.reduce((sum, i) => sum + cells[i], 0)));

  const items: Item[] = [];
  let z = 0;
  lines.forEach((line, row) => {
    const tall = Math.max(...line.map((i) => measured[i].height));
    const deep = Math.max(...line.map((i) => measured[i].depth));
    // Far enough in front of the row behind that this row's tops stay under that row's labels.
    if (row > 0) z += deep / 2 + (tall * Math.cos(PITCH)) / Math.sin(PITCH);
    const wide = line.reduce((sum, i) => sum + cells[i], 0);
    let x = -wide / 2;
    for (const i of line) {
      items.push({ ...measured[i], x: x + cells[i] / 2, z });
      x += cells[i];
    }
    z += deep / 2 + labelDeep;
  });
  const back = lines[0];
  return {
    items,
    x0: -widest / 2, x1: widest / 2,
    z0: -Math.max(...back.map((i) => measured[i].depth)) / 2, z1: z,
    high: Math.max(...back.map((i) => measured[i].height)),
    tallest: Math.max(...measured.map((m) => m.height)),
  };
}

export function kindsOf(group: PropGroup): PropKind[] {
  return PROP_KINDS.filter((kind) => PROPS[kind].group === group);
}

/** How far up the picture a point is, in meters, for a camera looking north and down at PITCH. */
const up = (y: number, z: number) => y * Math.cos(PITCH) - z * Math.sin(PITCH);

/** The size of a layout as the camera sees it: meters across, and meters from its lowest point to its highest. */
function seen(layout: Layout): { across: number; low: number; high: number } {
  return { across: layout.x1 - layout.x0, low: up(0, layout.z1), high: up(layout.high, layout.z0) };
}

/**
 * Where a camera with this lens must stand to see a whole layout from PITCH, looking north. It returns
 * the point on the ground to look at and the distance, for a view `aspect` wide.
 */
export function frame(layout: Layout, fovDegrees: number, aspect: number, margin = 1.06): { target: THREE.Vector3; distance: number } {
  const tan = Math.tan((fovDegrees * Math.PI) / 360);
  const { across, low, high } = seen(layout);
  const distance = (Math.max(across / aspect, high - low) * margin) / (2 * tan);
  // The point on the ground that sits halfway up the picture.
  const target = new THREE.Vector3((layout.x0 + layout.x1) / 2, 0, -(low + high) / 2 / Math.sin(PITCH));
  return { target, distance };
}

/** How tall a picture of this layout is for a picture this wide, in pixels. */
export function pictureHeight(layout: Layout, width: number): number {
  const { across, low, high } = seen(layout);
  return Math.round((width * (high - low)) / across);
}
