import { expect, test } from 'bun:test';
import { DEFAULT_GRAPHICS, readGraphics } from './graphics.ts';
test('old or damaged saves keep usable graphics defaults', () => {
  expect(readGraphics(null)).toEqual(DEFAULT_GRAPHICS);
  expect(readGraphics({shadows:'ultra',bloom:'yes',shadowDistance:Infinity})).toEqual(DEFAULT_GRAPHICS);
});
test('graphics overrides round trip and numeric controls stay within their ranges', () => {
  const settings = {shadows:'sharp' as const,bloom:false,plantDensity:.3,viewDistance:1.2,shadowDistance:60,cloudShadows:false,weatherParticles:false,reduceMotion:true};
  expect(readGraphics(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  expect(readGraphics({plantDensity:4,viewDistance:-4,shadowDistance:1000})).toMatchObject({plantDensity:1,viewDistance:.5,shadowDistance:90});
});
