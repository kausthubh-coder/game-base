import { test, expect } from 'bun:test';
import { galleryThreat, requireGalleryWin } from './play-gallery.mjs';
test('lash tells cover the forward line but leave a sideways escape', () => {
  const t = { kind: 'line', x: 0, z: 0, facing: 0, reach: 5.5, width: 1 };
  expect(galleryThreat(t, { x: 0, z: -4 })).toBe(true);
  expect(galleryThreat(t, { x: 2, z: -4 })).toBe(false);
  expect(galleryThreat(t, { x: 0, z: 2 })).toBe(false);
});
test('spore tells cover the landing circle', () => {
  const t = { kind: 'circle', x: 4, z: 5, reach: 2 };
  expect(galleryThreat(t, { x: 4, z: 5 })).toBe(true);
  expect(galleryThreat(t, { x: 8, z: 5 })).toBe(false);
});
test('fight end observation rejects falls and walkouts immediately', () => {
  expect(() => requireGalleryWin({ fight: 8, result: 'won' }, 8)).not.toThrow();
  for (const result of ['fell', 'left'])
    expect(() => requireGalleryWin({ fight: 8, result }, 8)).toThrow('without victory');
  expect(() => requireGalleryWin({ fight: 9, result: 'won' }, 8)).toThrow();
  expect(() => requireGalleryWin(undefined, 8)).toThrow();
});

test('both Gallery route legs pass authored under-bridge height to shared walk unchanged',async()=>{
  const {walkGalleryRoute}=await import('./play-gallery.mjs');
  const path=[{x:373.5,y:24,z:-338.5},{x:374.5,y:24,z:-339.5}];
  const observations=[];
  const sharedWalk=async(x,z,within,y,authored)=>{observations.push({x,z,y:y??32,within,authored});};
  await walkGalleryRoute(path,sharedWalk);
  await walkGalleryRoute([...path].reverse(),sharedWalk);
  expect(observations).toEqual([path[0],path[1],path[1],path[0]].map(p=>({...p,within:.2,authored:true})));
});
