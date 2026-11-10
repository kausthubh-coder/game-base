import type * as THREE from 'three';
import type { Ambient, Quality } from './types.ts';
import type { WorldQuery } from './world-query.ts';

/** What a view system gets every frame. A feature never reaches for globals. */
export interface ViewContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  ambient: Ambient;
  world: WorldQuery;
  quality: Quality;
  /** Seconds since the game started. */
  time: number;
}

/** Anything that draws. A feature exports `createX(ctx, options)` that returns one of these plus its own methods. */
export interface ViewSystem {
  update(dt: number, ctx: ViewContext): void;
  setQuality?(quality: Quality): void;
  dispose(): void;
}
