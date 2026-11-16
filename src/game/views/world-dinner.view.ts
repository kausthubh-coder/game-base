// The dinner table on the green, as assets-src/concept/settlement/dinner.webp draws it: the table the player set
// down is three 2 by 2 modules end to end, with a bench along each long side, a chair at each end, lantern poles
// at the corners of the green and, in the evening, the meal down the middle. The stations view draws the middle
// module (the placeable's own prop); this view draws the rest. The settlement seats its people on the benches
// (src/game/settlement/table.sim.ts gives both the same layout).
//
// The lantern poles (`dinnerLanternPole`) and the meal (`dinnerSpread`) are looked for by name when the game runs.
// A build without them stands in: two strings of lanterns along the long sides, and a cloth runner with bowls, bread,
// mugs and a honey jar built here, one draw call of its own, only in the evening.
import * as THREE from 'three';
import { DINNER, SETTLED_DAY } from '../content/people.ts';
import { footprint } from '../content/placeables.ts';
import type { Placed, Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { GREEN, tableLayout } from '../settlement/table.sim.ts';
import { worldProps } from '../worldview/props.ts';

/** Seconds between two looks at the placed tables. */
const EVERY = 0.5;
/** The table's top, where the meal sits, in blocks above the ground. */
const TOP = 0.8;
const KIND = 'dinner_table';

interface Dressed {
  key: string;
  handles: number[];
  /** The meal's props, set out in the evening and cleared at bedtime. */
  meal: number[];
  /** The middle of each module, for the meal. */
  modules: { x: number; y: number; z: number }[];
  along: readonly [number, number];
}

/** The stand-in meal on one 2 by 2 module, its middle at the origin, lying along x: one geometry with vertex colours. */
function spreadGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, color: number, sy = 1): void => {
    geometry.scale(1, sy, 1);
    geometry.translate(x, y, z);
    const c = new THREE.Color(color), n = geometry.attributes.position.count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
  };
  // The cream runner with its red stripes, down the middle of the module.
  add(new THREE.BoxGeometry(2, 0.02, 0.62), 0, 0.01, 0, 0xf1e6cc);
  for (const z of [-0.24, 0.24]) add(new THREE.BoxGeometry(2, 0.024, 0.05), 0, 0.012, z, 0xb4473a);
  // Two bowls of stew, a loaf, two mugs and a jar of honey that glows a little in the lantern light.
  for (const [x, z] of [[-0.55, -0.42], [0.5, 0.4]] as const) {
    add(new THREE.CylinderGeometry(0.2, 0.12, 0.12, 10), x, 0.06, z, 0xb7814a);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.01, 10), x, 0.12, z, 0xc8662e);
  }
  add(new THREE.SphereGeometry(0.2, 10, 6), 0.05, 0.08, -0.05, 0xd59a4c, 0.55);
  for (const [x, z] of [[-0.15, 0.45], [0.75, -0.42]] as const) add(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), x, 0.08, z, 0x8d6a4f);
  add(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 8), -0.75, 0.1, 0.1, 0xf0a93a);
  const merged = new THREE.BufferGeometry();
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const position = new Float32Array(total * 3), normal = new Float32Array(total * 3), color = new Float32Array(total * 3);
  let at = 0;
  for (const g of parts) {
    g.computeVertexNormals();
    position.set(g.attributes.position.array as Float32Array, at * 3);
    normal.set(g.attributes.normal.array as Float32Array, at * 3);
    color.set(g.attributes.color.array as Float32Array, at * 3);
    at += g.attributes.position.count;
    g.dispose();
  }
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return merged;
}

export function install(view: GameView): void {
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const props = worldProps(view);
  const dressed = new Map<string, Dressed>();
  let since = EVERY;

  // The stand-in meal: one instanced mesh, a module to an instance, shown in the evening.
  const MOST = 12;
  const spread = new THREE.InstancedMesh(spreadGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), MOST);
  spread.name = 'dinner-spread';
  spread.count = 0;
  spread.frustumCulled = false;
  view.scene.add(spread);
  const place = new THREE.Matrix4(), turn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function dress(placed: Placed): Dressed {
    const size = sys.placeables?.defs().find((d) => d.kind === KIND)?.size ?? [6, 1, 2];
    const [sx, , sz] = footprint(size, placed.quarterTurns);
    const center = { x: placed.x + sx / 2, y: placed.y, z: placed.z + sz / 2 };
    const t = placed.quarterTurns & 3;
    const front: [number, number] = [t === 1 ? 1 : t === 3 ? -1 : 0, t === 0 ? -1 : t === 2 ? 1 : 0];
    const layout = tableLayout(center, sx, sz, front);
    const handles: number[] = [];
    const stand = (kind: string, x: number, z: number, rotation: number, scale = 1): void => {
      const handle = props.place(kind, 0, x, center.y, z, rotation, scale, true);
      if (handle) handles.push(handle);
    };
    const lengthwise = layout.along[0] === 1 ? 0 : Math.PI / 2;
    // The middle module is the placeable's own prop.
    for (const m of layout.modules) if (Math.hypot(m.x - center.x, m.z - center.z) > 0.5) stand('homeDinnerTable', m.x, m.z, lengthwise);
    for (const b of layout.benches) stand('homeBench', b.at.x, b.at.z, b.turn);
    for (const c of layout.chairs) stand('homeChair', c.at.x, c.at.z, c.turn);
    if (props.has('dinnerLanternPole')) {
      for (const p of layout.poles) stand('dinnerLanternPole', p.x, p.z, lengthwise);
    } else {
      // Stand-in: a string of lanterns on two posts along each long side, the posts at the green's corners.
      const across: [number, number] = [layout.along[1], layout.along[0]];
      const reach = GREEN.wide / 2 - 0.5;
      for (const side of [-1, 1]) stand('stringLights', center.x + across[0] * side * reach, center.z + across[1] * side * reach, lengthwise, (GREEN.long - 1) / 10);
    }
    return { key: `${placed.x},${placed.y},${placed.z},${placed.quarterTurns}`, handles, meal: [], modules: layout.modules, along: layout.along };
  }

  function look(): void {
    const tables = sys.placeables?.all().filter((p) => p.kind === KIND) ?? [];
    const seen = new Set<string>();
    for (const placed of tables) {
      seen.add(placed.id);
      const key = `${placed.x},${placed.y},${placed.z},${placed.quarterTurns}`;
      const old = dressed.get(placed.id);
      if (old && old.key === key && old.handles.every((h) => props.alive(h))) continue;
      if (old) for (const h of [...old.handles, ...old.meal]) props.remove(h);
      dressed.set(placed.id, dress(placed));
    }
    for (const [id, d] of dressed) {
      if (seen.has(id)) continue;
      for (const h of [...d.handles, ...d.meal]) props.remove(h);
      dressed.delete(id);
    }
    // The meal is out from dinner time until everyone goes home.
    const hour = game.clock.timeOfDay * 24;
    const evening = hour >= DINNER.from * 24 && hour < SETTLED_DAY.home;
    const model = props.has('dinnerSpread');
    for (const d of dressed.values()) {
      if (model && evening && d.meal.length === 0) {
        const turn = d.along[0] === 1 ? 0 : Math.PI / 2;
        for (const m of d.modules) {
          const handle = props.place('dinnerSpread', 0, m.x, m.y, m.z, turn, 1, true);
          if (handle) d.meal.push(handle);
        }
      } else if ((!model || !evening) && d.meal.length > 0) {
        for (const h of d.meal) props.remove(h);
        d.meal.length = 0;
      }
    }
    let n = 0;
    if (evening && !model) {
      for (const d of dressed.values()) {
        turn.setFromAxisAngle(up, d.along[0] === 1 ? 0 : Math.PI / 2);
        for (const m of d.modules) {
          if (n >= MOST) break;
          at.set(m.x, m.y + TOP + view.liftOnLand(m.x, m.y, m.z), m.z);
          spread.setMatrixAt(n++, place.compose(at, turn, one));
        }
      }
    }
    spread.count = n;
    spread.instanceMatrix.needsUpdate = true;
  }

  view.onFrame((dt) => {
    since += dt;
    if (since < EVERY) return;
    since = 0;
    look();
  });
}
