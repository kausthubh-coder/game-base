// Temporary source and destination marks for the first ditch, independent of camera direction.
import * as THREE from 'three';
import { ARRIVAL_IRRIGATION } from '../content/region.ts';
import { irrigationGuide } from '../region/irrigation-guide.sim.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';
import { addStyle } from '../uiview/theme.ts';
import { bookOf } from '../uiview/book.ts';
import { worldLabelLayout } from './world-label-layout.ts';

const STYLE = /* css */ `
.ui-book .ui-irrigation-guide { position: absolute; inset: 0; pointer-events: none; }
.ui-book .ui-irrigation-guide[hidden], .ui-book .ui-irrigation-guide-label[hidden] { display: none; }
.ui-book .ui-irrigation-guide-label { position: absolute; left: 0; top: 0; pointer-events: none; white-space: nowrap; color: var(--ui-glass-ink); font: 800 14px/1.3 var(--ui-font); text-shadow: var(--ui-text-shadow); }
.ui-book .ui-irrigation-guide-label b { color: var(--ui-gold-bright); margin-right: 5px; }
`;

export function install(view: GameView): void {
  const { field, fieldTarget, source } = ARRIVAL_IRRIGATION;
  const y = field.soilY + 1.06, x0 = field.x0, x1 = field.x1 + 1, z0 = field.z0, z1 = field.z1 + 1;
  const positions: number[] = [];
  const edge = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => { positions.push(ax, ay, az, bx, by, bz); };
  edge(x0,y,z0,x1,y,z0); edge(x1,y,z0,x1,y,z1); edge(x1,y,z1,x0,y,z1); edge(x0,y,z1,x0,y,z0);
  for (const [x,z] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]]) edge(x,y,z,x,y+.45,z);
  // A small diamond identifies the source water without drawing an invented required trench path.
  const sx = source.x, sy = source.y + .06, sz = source.z, r = .6;
  edge(sx-r,sy,sz,sx,sy,sz-r); edge(sx,sy,sz-r,sx+r,sy,sz); edge(sx+r,sy,sz,sx,sy,sz+r); edge(sx,sy,sz+r,sx-r,sy,sz);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf0d48a, transparent: true, opacity: .95, depthTest: false, fog: false, toneMapped: false }));
  lines.name = 'irrigation-guide'; lines.renderOrder = 4; lines.frustumCulled = false; lines.visible = false;
  view.scene.add(lines);

  const book = bookOf(view), layout = worldLabelLayout(view.root);
  const feet: ScreenPoint = { x: 0, y: 0 }, head: ScreenPoint = { x: 0, y: 0 };
  addStyle(view.root, 'irrigation-guide', STYLE);
  const root = document.createElement('div'); root.className = 'ui-irrigation-guide'; root.hidden = true; view.root.append(root);
  const labels = [{ id: 'source', text: 'Pond source', at: source }, { id: 'field', text: 'Dry field', at: fieldTarget }].map(({ id, text, at }) => {
    const element = document.createElement('span'); element.className = 'ui-irrigation-guide-label'; element.dataset.irrigation = id;
    const diamond = document.createElement('b'); diamond.textContent = '◆'; diamond.setAttribute('aria-hidden', 'true');
    element.append(diamond, document.createTextNode(text)); root.append(element);
    return { element, at, screen: { x: 0, y: 0 } as ScreenPoint, place: layout.register(element) };
  });
  view.onFrame(() => {
    const active = view.started && !view.paused && !view.game.player.busy && !book.menuOpen && book.panel === null && !book.map?.isOpen && !view.root.classList.contains('sf-on') && irrigationGuide(view.game.flags) !== null;
    lines.visible = active; root.hidden = !active;
    if (!active) { for (let i = 0; i < labels.length; i++) labels[i].element.hidden = true; return; }
    const hero = view.playerPosition;
    layout.protectHero(view.project(hero.x, hero.y, hero.z, feet), view.project(hero.x, hero.y + 1.7, hero.z, head));
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i], at = view.project(label.at.x, label.at.y + 1.25, label.at.z, label.screen);
      label.element.hidden = at === null;
      if (!at) continue;
      // A label is only shown at its real anchor. Shared layout rejects HUD, hero and tag collisions.
      const width = label.element.offsetWidth, height = label.element.offsetHeight;
      if (at.x - width / 2 < 8 || at.x + width / 2 > view.root.clientWidth - 8 || at.y - height < 72 || at.y > view.root.clientHeight - 100) {
        label.element.hidden = true;
        continue;
      }
      label.place(at.x, at.y, 0);
    }
  });
}
