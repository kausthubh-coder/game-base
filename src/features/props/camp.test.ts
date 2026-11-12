import { expect, test } from 'bun:test';
import { propLight } from '../../content/props.ts';
import { buildProp, propExtras } from './build.ts';

test('the camp burns down without moving its stone ring or lighting the cold ashes', () => {
  const stages = [0, 1, 2].map((variant) => buildProp('campfire', variant));
  expect([0, 1, 2].map((variant) => propLight('campfire', variant))).toEqual([12, 8, 0]);
  for (const [variant, geometry] of stages.entries()) {
    expect(propExtras(geometry).triangles).toBeLessThanOrEqual(320);
    expect(propExtras(geometry).lights.length).toBe(variant === 2 ? 0 : 3);
    const stones = (g: typeof geometry) => {
      const p = g.getAttribute('position'), fx = g.getAttribute('aFx');
      const points: number[][] = [];
      for (let i = 0; i < p.count; i++) {
        if (Math.hypot(p.getX(i), p.getZ(i)) > 0.42 && p.getY(i) > 0.02 && fx.getX(i) === 0) {
          points.push([p.getX(i), p.getY(i), p.getZ(i)]);
        }
      }
      return points;
    };
    expect(stones(geometry)).toEqual(stones(stages[0]));
    if (variant === 2) {
      const fx = geometry.getAttribute('aFx');
      for (let i = 0; i < fx.count; i++) expect(fx.getY(i)).toBe(0);
    }
  }
});

test('the canvas tent fits its camp footprint including ropes and poles', () => {
  const geometry = buildProp('tent', 0);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  expect(box.min.y).toBeGreaterThanOrEqual(-0.05);
  expect(box.max.y).toBeLessThan(1.72);
  expect(Math.max(Math.abs(box.min.x), box.max.x)).toBeLessThan(1.4);
  expect(Math.max(Math.abs(box.min.z), box.max.z)).toBeLessThan(1.8);
  expect(propExtras(geometry).triangles).toBeLessThanOrEqual(260);
});
