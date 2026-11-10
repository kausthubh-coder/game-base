// Shows what a click would act on: a thin box around the block under the pointer when it is in reach,
// which closes in and turns warm as the block breaks.
import * as THREE from 'three';
import type { GameView } from '../shell/view.ts';

export function install(view: GameView): void {
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, fog: false, toneMapped: false });
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), material);
  outline.name = 'aim';
  outline.renderOrder = 10;
  outline.visible = false;
  outline.frustumCulled = false;
  view.scene.add(outline);
  const calm = new THREE.Color(0xffffff), warm = new THREE.Color(0xffb347);

  view.onFrame(() => {
    const aim = view.aim;
    const game = view.game;
    outline.visible = aim !== null && view.started && !view.paused && !game.player.busy;
    if (!aim || !outline.visible) return;
    const breaking = game.systems.actions?.breaking() ?? null;
    const progress = breaking && breaking.x === aim.x && breaking.y === aim.y && breaking.z === aim.z ? breaking.progress : 0;
    outline.position.set(aim.x + 0.5, aim.y + 0.5, aim.z + 0.5);
    outline.scale.setScalar(1 - 0.12 * progress);
    material.color.copy(calm).lerp(warm, Math.min(1, progress * 1.5));
    material.opacity = 0.55 + 0.45 * progress;
  });
}
