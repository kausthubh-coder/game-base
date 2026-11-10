import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { SOFT_SHADOW_TAPS, softenShadowChunk } from './soft-shadows.ts';

test('the shadow filter takes one tap when sharp and the soft taps otherwise', () => {
  const chunks = { shadowmap_pars_fragment: THREE.ShaderChunk.shadowmap_pars_fragment };
  expect(softenShadowChunk(chunks)).toBe(true);
  const patched = chunks.shadowmap_pars_fragment;
  expect(patched).toContain('if ( shadowRadius < 0.5 )');
  expect(patched).toContain(`vogelDiskSample( i, ${SOFT_SHADOW_TAPS}, phi )`);
  expect(patched).not.toContain('vogelDiskSample( 0, 5, phi )');
  // A second call leaves it as it is.
  expect(softenShadowChunk(chunks)).toBe(true);
  expect(chunks.shadowmap_pars_fragment).toBe(patched);
});

test('an unknown chunk is left alone', () => {
  const chunks = { shadowmap_pars_fragment: 'float getShadow() { return 1.0; }' };
  expect(softenShadowChunk(chunks)).toBe(false);
  expect(chunks.shadowmap_pars_fragment).toBe('float getShadow() { return 1.0; }');
});
