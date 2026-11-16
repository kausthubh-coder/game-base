import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { SightRule } from '../../features/camera/sight.sim.ts';
import type { CameraView } from '../../features/camera/index.ts';
import type { Game } from '../api.sim.ts';
import { createSight } from './sight.ts';

test('reports opaque wild dressing between the camera and the hero', () => {
  const scene = new THREE.Scene(), wilds = new THREE.Group();
  wilds.name = 'wilds';
  const fern = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial());
  fern.name = 'wild-fern-0';
  fern.position.set(0, 1.1, 5);
  wilds.add(fern);
  scene.add(wilds);
  scene.updateMatrixWorld(true);
  const lens = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  lens.position.set(0, 1.1, 10);
  lens.lookAt(0, 1.1, 0);
  lens.updateMatrixWorld(true);
  const hero = { x: 0, y: 0, z: 0 };
  const game = { systems: {}, actors: new Map([['player', { visible: true }]]) } as unknown as Game;
  const camera = { sight: new SightRule() } as unknown as CameraView;
  const sight = createSight(game, camera, lens, () => 0, scene, {} as HTMLElement, () => hero);
  expect(sight.report()[0]?.hiddenBy).toBe('wilds: wild-fern-0');
  wilds.visible = false;
  expect(sight.report()[0]?.hiddenBy).toBeNull();
});


test('reports a root across the lower body even when the chest is clear', () => {
  const scene = new THREE.Scene(), trees = new THREE.Group();
  trees.name = 'painted-trees';
  const material = new THREE.MeshBasicMaterial();
  material.userData.see = 'wood';
  const root = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.2), material);
  root.name = 'root'; root.position.set(0, 0.5, 0.2); trees.add(root); scene.add(trees);
  scene.updateMatrixWorld(true);
  const lens = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  lens.position.set(0, 1.1, 10); lens.lookAt(0, 1.1, 0); lens.updateMatrixWorld(true);
  const hero = { x: 0, y: 0, z: 0 };
  const game = { systems: {}, actors: new Map([['player', { visible: true }]]) } as unknown as Game;
  const rule = new SightRule(), camera = { sight: rule } as unknown as CameraView;
  const sight = createSight(game, camera, lens, () => 0, scene, {} as HTMLElement, () => hero);
  expect(sight.report()[0]?.hiddenBy).toBe('painted-trees: root');
  rule.keep(0, 0, 0); rule.update(1, 0, 1.1, 10, 0, 0, 0, []);
  expect(sight.report()[0]?.hiddenBy).toBeNull();
});

test('first person keeps no sight hole for its hidden body, but keeps a fight figure', () => {
  const hero = { x: 0, y: 0, z: 0 };
  const actor = { visible: true };
  let fight = false;
  const game = {
    systems: { fights: { running: () => fight ? { over: -1, fight: { beasts: [] } } : null } },
    actors: new Map([['player', actor]]),
  } as unknown as Game;
  const lens = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  lens.position.set(0, 1.1, 10); lens.lookAt(0, 1.1, 0); lens.updateMatrixWorld(true);
  const rule = new SightRule();
  const camera = { sight: rule, mode: 'first', roofs: [] } as unknown as CameraView;
  const sight = createSight(game, camera, lens, () => 0, new THREE.Scene(), {} as HTMLElement, () => hero);
  sight.frame(1, hero);
  expect(sight.report()).toEqual([]);
  expect(rule.cuts(0, 1.1, 3)).toBe(0);
  for (const mode of ['free', 'tilt'] as const) {
    Object.assign(camera, { mode });
    sight.frame(1, hero);
    expect(sight.report().map(body => body.who)).toEqual(['player']);
    expect(rule.cuts(0, 1.1, 3)).toBe(1);
    actor.visible = false;
    sight.frame(1, hero);
    expect(sight.report()).toEqual([]);
    expect(rule.cuts(0, 1.1, 3)).toBe(0);
    actor.visible = true;
  }
  Object.assign(camera, { mode: 'first' });
  actor.visible = false;
  fight = true;
  sight.frame(1, hero);
  expect(sight.report().map(body => body.who)).toEqual(['player']);
  expect(rule.cuts(0, 1.1, 3)).toBe(1);
});

test('first person still keeps the nearby story speaker in sight', () => {
  const hero = { x: 0, y: 0, z: 0 };
  const speaker = { id: 'npc:tamsin', visible: true, pos: { x: 4, y: 0, z: 0 } };
  const game = {
    systems: { talk: { active: true, current: () => ({ npc: 'tamsin' }) } },
    actors: new Map([['player', { id: 'player', visible: true, pos: hero }], ['npc:tamsin', speaker]]),
  } as unknown as Game;
  const lens = new THREE.PerspectiveCamera(); lens.position.set(0, 12, 20);
  const rule = new SightRule();
  const camera = { mode: 'first', sight: rule, roofs: [] } as unknown as CameraView;
  createSight(game, camera, lens, () => 0, new THREE.Scene(), {} as HTMLElement, () => hero).frame(1, hero);
  expect(Array.from(rule.state.points.slice(0, 4))).toEqual([4, Math.fround(1.1), 0, Math.fround(rule.options.radius)]);
  expect(rule.state.points[7]).toBe(0);
});
