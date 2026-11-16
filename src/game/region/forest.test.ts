import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { OLD_OAK_SIZE, PAINTED_TREES } from '../../content/painted.ts';
import { buildTree, type TreeSpec } from '../../features/painted/trees.ts';
import { treesInArea } from '../../features/world/terrain.sim.ts';
import { FIGHTS, LANDMARK_SIZES, toWorld } from '../content/greenhollow.ts';
import { BEE_TREES, FOREST_HELD, FOREST_SITES, GLADES, PLANTED_OAKS } from '../content/wilds-forest.ts';
import { greenhollowGrove, planPathReach } from './greenhollow-land.sim.ts';
import { blightAt } from './greenhollow.sim.ts';

const SEED = 7;
/** A square of the Old Forest west of the vault, and one of the grey forest north of the High Road. */
const OLD = { x0: -330, z0: -300, x1: -230, z1: -200 }, GREY = { x0: -330, z0: -400, x1: -230, z1: -350 };
const inside = (a: typeof OLD) => treesInArea(SEED, a.x0, a.z0, a.x1, a.z1).filter((t) => greenhollowGrove(t.x, t.z) >= 0.5);

describe('the groves of old oaks', () => {
  test('are giants about twenty blocks apart with young oaks between, in the Old Forest and the grey', () => {
    for (const area of [OLD, GREY]) {
      const trees = inside(area);
      expect(trees.every((t) => t.kind === 'oldOak')).toBe(true);
      const giants = trees.filter((t) => t.variant <= 2), young = trees.filter((t) => t.variant >= 3);
      const blocks = ((area.x1 - area.x0) * (area.z1 - area.z0)) / 400;
      expect(giants.length).toBeGreaterThan(blocks * 0.5);
      expect(giants.length).toBeLessThan(blocks * 1.2);
      expect(young.length).toBeGreaterThan(0);
      for (const a of giants) for (const b of giants) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(12);
      for (const y of young) for (const g of giants) expect(Math.hypot(y.x - g.x, y.z - g.z)).toBeGreaterThanOrEqual(9);
      // A giant's size is twice an oak's in the rules, a young oak's an oak's.
      for (const t of trees) expect(t.size / (OLD_OAK_SIZE[t.variant] as number)).toBeCloseTo(1, 0);
    }
  });

  test('leave the plan\'s glades open, and the giants stand back from a canopy gap', () => {
    for (const g of GLADES) {
      const c = toWorld(g.at), r = Math.max(g.w, g.d) / 2 + 14;
      for (const t of treesInArea(SEED, c.x - r, c.z - r, c.x + r, c.z + r)) {
        const k = Math.hypot((t.x - c.x) / (g.w / 2), (t.z - c.z) / (g.d / 2));
        expect(k, `${t.kind}:${t.variant} in the ${g.id} glade`).toBeGreaterThanOrEqual(t.kind === 'oldOak' && t.variant <= 2 && g.canopy < 0 ? 0.6 : 1);
      }
    }
  });

  test('stand the giants set by hand round Bramble\'s clearing, grey', () => {
    for (const oak of PLANTED_OAKS) {
      const at = toWorld(oak.at), tree = treesInArea(SEED, at.x, at.z, at.x + 1, at.z + 1)[0];
      expect(tree?.kind, `${oak.at}`).toBe('oldOak');
      expect(tree?.variant).toBe(oak.variant);
      expect(blightAt(at.x, at.z)).toBeGreaterThan(0.95);
    }
  });

  test('keep the fights\' ground clear at Bramble\'s clearing', () => {
    for (const at of [toWorld([438, 204]), toWorld(FIGHTS.find((f) => f.n === 3)?.at as [number, number])]) {
      expect(treesInArea(SEED, at.x - 8, at.z - 6, at.x + 8, at.z + 6)).toEqual([]);
    }
  });

  test('stand each bee tree where its hollow faces its comb', () => {
    // The turn the painted world gives a tree by its column (`own(x, z, 1)` in src/game/views/world-painted.view.ts).
    const own = (x: number, z: number, salt: number): number => {
      let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(salt, 2246822519)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    for (const bee of BEE_TREES) {
      const at = toWorld(bee.at), tree = treesInArea(SEED, at.x, at.z, at.x + 1, at.z + 1)[0];
      expect(tree?.kind).toBe('oldOak');
      expect(tree?.variant).toBe(4);
      // The hollow faces the tree's own +x; turned by the view, that is (cos, -sin) of its turn.
      const turn = own(at.x, at.z, 1) * Math.PI * 2, faces = (bee.faces * Math.PI) / 2;
      expect(Math.cos(turn)).toBeCloseTo(Math.sin(faces), 1);
      expect(-Math.sin(turn)).toBeCloseTo(Math.cos(faces), 1);
      const comb = FOREST_SITES.find((s) => s.model === 'forestBeeComb' && s.turn === bee.faces && Math.hypot((s.at?.[0] ?? 0) - bee.at[0] - 0.5, (s.at?.[1] ?? 0) - bee.at[1] - 0.5) < 1);
      expect(comb).toBeDefined();
    }
  });

  test('set the kit\'s pieces off the paths, each with its size', () => {
    for (const s of [...FOREST_SITES, ...FOREST_HELD]) {
      const size = LANDMARK_SIZES[s.model];
      expect(size, s.model).toBeDefined();
      if (!size || size.dress || !s.at) continue;
      const w = toWorld(s.at), half = Math.max(size.w, size.d) / 2;
      expect(planPathReach(w.x, w.z) - half, s.id).toBeGreaterThan(1);
    }
  });
});

describe('the old oaks', () => {
  // The kit's envelopes (assets-src/concept/region-forests, kit-trees): width, depth and height in blocks.
  const KIT = [[24, 22, 22], [28, 24, 24], [22, 18, 20], [7, 6, 9], [8, 7, 10]];
  test('are drawn at the kit\'s sizes, and a giant costs no more than two oaks', () => {
    (PAINTED_TREES.oldOak ?? []).forEach((v, i) => {
      const k = OLD_OAK_SIZE[i] as number, tree = buildTree(v.spec as TreeSpec);
      const box = new THREE.Box3().setFromBufferAttribute(tree.leaves.getAttribute('position') as THREE.BufferAttribute);
      const [w, d, h] = KIT[i] as number[];
      const across = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * k, tall = (box.max.y + (v.spec.card ?? 0) * 0.5) * k;
      expect(across, `variant ${i} across`).toBeGreaterThan(Math.min(w as number, d as number) * 0.8);
      expect(across, `variant ${i} across`).toBeLessThan(Math.max(w as number, d as number) * 1.15);
      expect(tall, `variant ${i} high`).toBeGreaterThan((h as number) * 0.85);
      expect(tall, `variant ${i} high`).toBeLessThan((h as number) * 1.15);
      expect(tree.leaves.index?.count ?? 0).toBeLessThan(2 * 2 * 1200 * 3);
    });
  });
});
