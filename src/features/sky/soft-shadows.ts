// Soft sun shadows. Three dropped PCFSoftShadowMap: its PCF filter now takes five taps on a Vogel disc of
// `shadow.radius` texels, too few for an edge wider than a texel or two without visible grain. This swaps the
// five taps for SOFT_SHADOW_TAPS, and for a single hardware-filtered tap when the radius is under half a
// texel, so the Sharp setting costs one read and the Soft one a few more. The radius is a uniform, so
// switching between the two needs no recompile.
//
// It edits Three's shader chunk in place, once, before the first material that uses shadows is compiled.
// Every material in the scene gets the same filter that way, whichever feature made it.
import * as THREE from 'three';

/** Taps of the soft filter. Each is a hardware 2 by 2 comparison, so 12 taps read 48 texels. */
export const SOFT_SHADOW_TAPS = 12;

const FIVE_TAPS = /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0\.2;/;

const SOFT_TAPS = /* glsl */ `if ( shadowRadius < 0.5 ) {
					shadow = texture( shadowMap, shadowCoord.xyz );
				} else {
					shadow = 0.0;
					for ( int i = 0; i < ${SOFT_SHADOW_TAPS}; i ++ ) {
						shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, ${SOFT_SHADOW_TAPS}, phi ) * radius, shadowCoord.z ) );
					}
					shadow /= ${SOFT_SHADOW_TAPS}.0;
				}`;

/** Puts the soft filter into `chunks`. Returns false when the chunk is not the one this was written for. */
export function softenShadowChunk(chunks: Record<string, string> = THREE.ShaderChunk as unknown as Record<string, string>): boolean {
  const source = chunks.shadowmap_pars_fragment;
  if (source.includes(`vogelDiskSample( i, ${SOFT_SHADOW_TAPS}, phi )`)) return true;
  if (!FIVE_TAPS.test(source)) return false;
  chunks.shadowmap_pars_fragment = source.replace(FIVE_TAPS, SOFT_TAPS);
  return true;
}
