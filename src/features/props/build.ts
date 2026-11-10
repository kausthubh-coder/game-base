// Builds the geometry of one prop: looks its entry up, runs its builder, and checks the names on the way.
import type * as THREE from 'three';
import { propDef } from '../../content/props.ts';
import { environmentGeometry } from './models.view.ts';
import { BUILDERS } from './builders/index.ts';
import { extrasOf, type ShapeExtras } from './shape.ts';

/** One merged geometry for this kind and variant. Each call builds a new one: the caller owns and disposes it. */
export function buildProp(kind: string, variant: number): THREE.BufferGeometry {
  const def = propDef(kind);
  const builder = BUILDERS[def.builder];
  if (!builder) throw new Error(`prop ${kind} names the builder ${def.builder}, which is not in builders/index.ts`);
  if (!Number.isInteger(variant) || variant < 0 || variant >= def.variants.length) throw new Error(`prop ${kind} has no variant ${variant}`);
  const original = builder(variant, def);
  if (!def.wind) {
    const fx = original.getAttribute('aFx');
    for (let i=0;i<fx.count;i++) fx.setX(i,0);
  }
  const model = environmentGeometry(kind, variant);
  if (!model) return original;
  const geometry = model.clone();
  geometry.userData.prop = { ...extrasOf(original), triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3 };
  original.dispose();
  return geometry;
}

/** The shadow casters, lights and triangle count of a geometry `buildProp` made. */
export function propExtras(geometry: THREE.BufferGeometry): ShapeExtras {
  return extrasOf(geometry);
}
