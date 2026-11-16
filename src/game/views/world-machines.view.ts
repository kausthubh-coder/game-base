import { updateMachineBounds } from './machine-bounds.ts';
// Draws the machines: every part the machines system runs, from its `part*` model in src/features/props/builders/
// parts.ts, in the variant of its state (working, starved, backed up; a part switched off is drawn still, as
// starved), with its moving piece turning at its shaft's speed: a wheel about its axle, a sprinkler's head, a
// shaft along itself, a pusher's plate, an arm's sweep. A spade's hole is drawn as the pit model, a ditch as the
// ditch model. Loose goods lie on the ground as their icons, which the hero walks over to pick up.
//
// Stationary pieces share one geometry rebuilt when their placements or models change. Moving or
// wind-deformed pieces keep one instanced mesh per model and variant, on the same props material.
import * as THREE from 'three';
import { darkness } from '../../features/props/index.ts';
import { PART_PLACEMENT, farmFenceEnd, farmPartParts, type PartKind } from '../../features/props/builders/parts.ts';
import { createPropMaterial, paintedLightLive } from '../../features/props/material.view.ts';
import type { MachinePart, MachineState, Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { createUiArt } from '../uiview/art.ts';
import { addStyle } from '../uiview/theme.ts';
import { createMachineStationaryBatch } from './machine-stationary.ts';

/** The model of each part, by its kind. */
const MODEL: Readonly<Record<string, PartKind | 'post'>> = {
  waterwheel: 'partWheel', gear_shaft: 'partShaft', lever: 'partLever', sprinkler: 'partSprinkler', chute: 'partChute',
  collector_chest: 'partCollector', pusher: 'partPusher', sensor: 'partSensor', switch_lamp: 'partSwitchableLamp',
  harvester_arm: 'partArm', saw_arm: 'partSawArm', bee_box: 'partBeeBox', post: 'post', clapper: 'partClapper', hatch: 'partHatch',
};
/** A state's variant: 0 working, 1 starved, 2 backed up. A part switched off is drawn still, as starved. */
const VARIANT: Readonly<Record<MachineState, number>> = { working: 0, starved: 1, 'backed up': 2, off: 1 };
/** Loose goods drawn at most, the nearest first, and how far from the hero. */
const GOODS = 24, GOODS_FAR = 22;
/** How far from the hero parts are drawn. */
const FAR = 72;

const STYLE = /* css */ `
.ui-book .fm-good { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -26px 0 0 -13px; pointer-events: none;
  image-rendering: pixelated; filter: drop-shadow(0 2px 2px rgb(10 12 20 / 0.55)); will-change: transform; }
.ui-book .fm-good > .ui-cell { position: absolute; inset: 0; display: block; }
.ui-book .fm-good b { position: absolute; right: -8px; bottom: -4px; min-width: 14px; padding: 0 3px; border-radius: 7px; font: 800 11px/14px var(--ui-font);
  color: var(--ui-ink); background: var(--ui-paper-light); box-shadow: 0 1px 2px rgb(10 12 20 / 0.4); text-align: center; }
@media (prefers-reduced-motion: no-preference) { .ui-book .fm-good { animation: fm-bob 1.6s ease-in-out infinite alternate; } }
@keyframes fm-bob { from { translate: 0 0; } to { translate: 0 -3px; } }
`;

interface Batch {
  mesh: THREE.InstancedMesh;
  capacity: number;
  count: number;
}

interface Model {
  stationary: THREE.BufferGeometry;
  moving: THREE.BufferGeometry | null;
  pivot: THREE.Vector3;
  /** The moving piece's resting turn about x, by the variant. */
  rest: number;
}

export function install(view: GameView): void {
  const { game, scene } = view;
  const sys = game.systems as Partial<Systems>;
  const { material, uniforms } = createPropMaterial();
  const group = new THREE.Group();
  group.name = 'machines';
  scene.add(group);
  addStyle(view.root, 'machines', STYLE);
  const art = createUiArt(view.assets);

  const stationary = createMachineStationaryBatch(material);
  group.add(stationary.mesh);
  const models = new Map<string, Model>();
  const batches = new Map<string, Batch>();
  /** How far each part's moving piece has turned or travelled, by its id. */
  const phase = new Map<string, number>();

  function modelOf(key: PartKind | 'post', variant: number): Model {
    const name = `${key}:${variant}`;
    let model = models.get(name);
    if (!model) {
      if (key === 'post') {
        model = { stationary: farmFenceEnd(), moving: null, pivot: new THREE.Vector3(), rest: 0 };
      } else {
        const parts = farmPartParts(key, variant);
        const empty = !parts.moving.attributes.position || parts.moving.attributes.position.count === 0;
        model = { stationary: parts.stationary, moving: empty ? null : parts.moving, pivot: new THREE.Vector3(...parts.pivot), rest: parts.pose.rx };
      }
      models.set(name, model);
    }
    return model;
  }

  function batchOf(name: string, geometry: THREE.BufferGeometry): Batch {
    let batch = batches.get(name);
    if (!batch) {
      const mesh = new THREE.InstancedMesh(geometry, material, 8);
      mesh.name = `machines:${name}`;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      batch = { mesh, capacity: 8, count: 0 };
      batches.set(name, batch);
    }
    return batch;
  }

  function add(name: string, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
    if (name.endsWith(':s') && stationary.add(geometry, matrix)) return;
    let batch = batchOf(name, geometry);
    if (batch.count >= batch.capacity) {
      // More copies than it holds: a bigger mesh, once, never every frame.
      const capacity = batch.capacity * 2;
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.name = batch.mesh.name;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (let i = 0; i < batch.count; i++) {
        batch.mesh.getMatrixAt(i, _grow);
        mesh.setMatrixAt(i, _grow);
      }
      group.remove(batch.mesh);
      batch.mesh.dispose();
      group.add(mesh);
      batch = { mesh, capacity, count: batch.count };
      batches.set(name, batch);
    }
    batch.mesh.setMatrixAt(batch.count++, matrix);
  }

  const _m = new THREE.Matrix4();
  const _grow = new THREE.Matrix4();
  const _station = new THREE.Matrix4();
  const _piece = new THREE.Matrix4();
  const _turn = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _one = new THREE.Vector3(1, 1, 1);
  const _up = new THREE.Vector3(0, 1, 0);

  /** The turn of a part's front: a station's front faces north at no turns, a model's faces south at none. */
  const rotationOf = (part: MachinePart): number => {
    if (part.kind === 'gear_shaft' || part.kind === 'waterwheel') {
      // A shaft lies along the shaft it joins; a wheel's axle runs across the stream to the shaft.
      const parts = sys.machines?.parts() ?? [];
      const along = parts.some((o) => o !== part && o.shaft === part.shaft && o.y === part.y && o.z === part.z && Math.abs(o.x - part.x) === 1);
      return part.kind === 'gear_shaft' ? (along ? 0 : Math.PI / 2) : along ? Math.PI / 2 : 0;
    }
    return Math.PI - (part.quarterTurns * Math.PI) / 2;
  };

  /** Where the moving piece is now, by its model: a turn about its axis, or a push along z. */
  function motion(key: PartKind | 'post', part: MachinePart, dt: number, t: number): void {
    const running = part.state === 'working' || (part.state === 'starved' && part.speed > 0);
    const speed = running ? Math.max(0.15, part.speed) : 0;
    const p = (phase.get(part.id) ?? 0) + dt * speed;
    phase.set(part.id, p);
    _turn.identity();
    switch (key) {
      case 'partWheel': _turn.makeRotationZ(-p * 1.4); break;
      case 'partSprinkler': _turn.makeRotationY(p * 3); break;
      case 'partShaft': _turn.makeRotationX(p * 4); break;
      case 'partPusher': _turn.makeTranslation(0, 0, speed ? Math.max(0, Math.sin(p * Math.PI)) * 0.18 : 0); break;
      case 'partArm': _turn.makeRotationY(speed ? Math.sin(p * 1.6) * 0.7 : 0); break;
      case 'partSawArm': _turn.makeTranslation(0, 0, speed ? Math.sin(p * 9) * 0.08 : 0); break;
      case 'partClapper': _turn.makeRotationX(speed ? -Math.max(0, Math.sin(t * 3)) * 0.5 : 0); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- loose goods, as icons on the ground
  const goodEls: { el: HTMLElement; icon: string; count: HTMLElement; shown: boolean }[] = [];
  const point = { x: 0, y: 0 };
  function goodEl(i: number): (typeof goodEls)[number] {
    let g = goodEls[i];
    if (!g) {
      const el = document.createElement('div');
      el.className = 'fm-good';
      const count = document.createElement('b');
      el.append(count);
      view.root.append(el);
      g = { el, icon: '', count, shown: true };
      goodEls.push(g);
    }
    return g;
  }
  const near: { x: number; y: number; z: number; icon: string; count: number; d: number }[] = [];

  view.onFrame((dt) => {
    const machines = sys.machines;
    const t = game.clock.seconds;
    uniforms.uPropTime.value = t;
    uniforms.uPropNight.value = darkness(game.clock.timeOfDay);
    uniforms.uPropPaint.value = paintedLightLive() ? 1 : 0;
    stationary.begin();
    for (const batch of batches.values()) batch.count = 0;
    const me = view.playerPosition;
    if (machines && view.started) {
      for (const part of machines.parts()) {
        if (Math.abs(part.x - me.x) > FAR || Math.abs(part.z - me.z) > FAR) continue;
        const key = MODEL[part.kind];
        if (!key) continue;
        let variant = VARIANT[part.state];
        if (part.kind === 'hatch') variant = machines.hatchOpen(part.id) ? 0 : 1;
        if (part.kind === 'switch_lamp' || part.kind === 'sensor') variant = part.state === 'working' ? 0 : 1;
        const model = modelOf(key, variant);
        const offset = key === 'post' ? 0 : (PART_PLACEMENT as Record<string, number>)[key] ?? 0;
        _pos.set(part.x + 0.5, part.y + offset, part.z + 0.5);
        _q.setFromAxisAngle(_up, rotationOf(part));
        _station.compose(_pos, _q, _one);
        add(`${key}:${variant}:s`, model.stationary, _station);
        if (!model.moving) continue;
        motion(key, part, dt, t);
        // The piece hangs from its pivot, turned to its variant's rest and then by its motion.
        _piece.makeTranslation(model.pivot.x, model.pivot.y, model.pivot.z).multiply(_m.makeRotationX(model.rest)).multiply(_turn);
        add(`${key}:${variant}:m`, model.moving, _m.multiplyMatrices(_station, _piece));
      }
      // Holes: a dry one is a pit, a wet one a ditch.
      for (const hole of machines.holes()) {
        if (Math.abs(hole.x - me.x) > FAR || Math.abs(hole.z - me.z) > FAR) continue;
        const key: PartKind = hole.wet ? 'partDitch' : 'partPit';
        const model = modelOf(key, 0);
        _pos.set(hole.x + 0.5, hole.y + 1 + PART_PLACEMENT[key], hole.z + 0.5);
        _station.compose(_pos, _q.identity(), _one);
        add(`${key}:0:s`, model.stationary, _station);
      }
    }
    for (const batch of batches.values()) {
      batch.mesh.count = batch.count;
      batch.mesh.visible = batch.count > 0;
      if (batch.count > 0) {
        batch.mesh.instanceMatrix.needsUpdate = true;
        updateMachineBounds(batch.mesh);
      }
    }

    stationary.finish();

    // The nearest loose goods, as icons where they lie.
    near.length = 0;
    if (machines && view.started) {
      for (const good of machines.loose()) {
        const d = Math.abs(good.x - me.x) + Math.abs(good.z - me.z);
        if (d > GOODS_FAR) continue;
        near.push({ x: good.x, y: good.y, z: good.z, icon: sys.items?.get(good.item).icon ?? '', count: good.count, d });
      }
      near.sort((a, b) => a.d - b.d);
    }
    const shown = Math.min(GOODS, near.length);
    for (let i = 0; i < Math.max(shown, goodEls.length); i++) {
      const g = goodEl(i);
      const good = i < shown ? near[i] : null;
      const on = good ? view.project(good.x, good.y + 0.3 + view.lift(good.x, good.y, good.z), good.z, point) : null;
      if (!good || !on) {
        if (g.shown) { g.el.style.display = 'none'; g.shown = false; }
        continue;
      }
      if (!g.shown) { g.el.style.display = ''; g.shown = true; }
      if (g.icon !== good.icon) {
        g.icon = good.icon;
        g.el.querySelector('.ui-cell')?.remove();
        const icon = art.iconElement(good.icon);
        if (icon) g.el.prepend(icon);
      }
      const words = good.count > 1 ? String(good.count) : '';
      if (g.count.textContent !== words) { g.count.textContent = words; g.count.style.display = words ? '' : 'none'; }
      g.el.style.transform = `translate(${on.x.toFixed(1)}px, ${on.y.toFixed(1)}px)`;
    }
  });
}
