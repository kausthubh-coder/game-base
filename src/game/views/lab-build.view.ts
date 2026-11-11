// The build lab: `?scene=build` in the address opens the game on the player's own plot with a bag of tools
// and pieces, a plank wall and a patch of tilled soil, so building can be tried without playing up to it.
// It skips the title, keeps its own save, and shows a card that says what to try.
//
// `?chest=sprite` beside it draws placed chests as flat pictures that face the camera, to compare with the
// 3D ones. The picture is the bag's chest icon, which stands in for a drawn world sprite.
//
// Without `?scene=build` this file does nothing.
import * as THREE from 'three';
import { blockId } from '../../content/blocks.ts';
import type { Systems } from '../api.sim.ts';
import { clearSave } from '../shell/save.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** What the bag starts with, in the order of the quick slots. */
const KIT: readonly (readonly [item: string, count: number])[] = [
  ['hoe', 1], ['wheat_seeds', 60], ['watering_can', 1], ['fence', 60], ['chest', 4], ['sprinkler', 3], ['plank', 80], ['workbench', 1], ['bed', 1],
];
const FLAG = 'lab.build';

const STYLE = /* css */ `
.ui-book .lab-card {
  position: absolute; left: 16px; top: 16px; width: 300px; padding: 14px 16px 12px; pointer-events: auto; user-select: text;
  font: 400 14px / 1.45 var(--ui-font); -webkit-font-smoothing: antialiased;
  color: var(--ui-ink); background: var(--ui-paper); border-radius: var(--ui-radius); box-shadow: var(--ui-lift);
}
.ui-book.ui-covered .lab-card { visibility: hidden; }
.ui-book .lab-card h2 { margin: 0 0 8px; font: 650 16px / 1.2 var(--ui-font); letter-spacing: -0.005em; }
.ui-book .lab-card ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.ui-book .lab-card li { display: grid; grid-template-columns: 74px 1fr; gap: 8px; color: var(--ui-ink-2); }
.ui-book .lab-card li b { font-weight: 600; color: var(--ui-ink); }
.ui-book .lab-card .lab-row { display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ui-line); }
.ui-book .lab-card button {
  flex: 1; min-height: 32px; padding: 0 10px; cursor: pointer;
  font: 600 13px / 1 var(--ui-font); color: var(--ui-ink); background: var(--ui-paper-3); border: 1px solid var(--ui-line-strong); border-radius: var(--ui-radius-sm);
}
.ui-book .lab-card button:hover { background: var(--ui-paper-4); }
.ui-book .lab-card button:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ui-book .lab-card.is-small ul, .ui-book .lab-card.is-small .lab-row { display: none; }
.ui-book .lab-card.is-small { width: auto; padding: 8px 12px; }
.ui-book .lab-card.is-small h2 { margin: 0; }
.ui-book .lab-card h2 button { float: right; flex: none; min-height: 24px; margin: -3px -4px 0 12px; padding: 0 8px; font-weight: 500; }
@container gu (width < 720px) { .ui-book .lab-card { width: 240px; font-size: 13px; } }
`;

const TRY: readonly (readonly [string, string])[] = [
  ['G', 'Build mode on and off'],
  ['Hoe', 'Drag over the grass to till a field'],
  ['Seeds', 'Drag over the field. The line by the pointer counts them'],
  ['Can', 'Drag over the soil to water it'],
  ['Fence', 'Drag a line, then another across it'],
  ['Chest', 'Hold it by the plank wall. Q and R turn it'],
  ['Sprinkler', 'Hold it near soil to see what it reaches'],
  ['Click', 'A placed thing comes back into your hand'],
  ['Z', 'Takes back the last stroke'],
];

export function install(view: GameView): void {
  const params = new URLSearchParams(location.search);
  if (params.get('scene') !== 'build') return;
  bookOf(view);
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const flat = params.get('chest') === 'sprite';
  addStyle(view.root, 'lab-build', STYLE);

  // ---------------------------------------------------------------- the card
  const card = document.createElement('section');
  card.className = 'lab-card';
  const title = document.createElement('h2');
  const fold = document.createElement('button');
  fold.type = 'button';
  fold.textContent = 'Hide';
  fold.addEventListener('click', () => { fold.textContent = card.classList.toggle('is-small') ? 'Show' : 'Hide'; });
  title.append('Build lab', fold);
  const list = document.createElement('ul');
  for (const [what, words] of TRY) {
    const row = document.createElement('li'), name = document.createElement('b');
    name.textContent = what;
    row.append(name, words);
    list.append(row);
  }
  const row = document.createElement('div');
  row.className = 'lab-row';
  const chests = document.createElement('button');
  chests.type = 'button';
  chests.textContent = flat ? 'Chests: 3D models' : 'Chests: flat sprites';
  chests.addEventListener('click', () => {
    view.save();
    if (flat) params.delete('chest');
    else params.set('chest', 'sprite');
    location.search = params.toString();
  });
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Start over';
  reset.addEventListener('click', () => {
    // The page saves as it closes. Taking the save away after that, on the next page, is too late, so it is marked here.
    sessionStorage.setItem('lab.build.reset', '1');
    location.reload();
  });
  row.append(chests, reset);
  card.append(title, list, row);
  card.hidden = true;
  view.root.append(card);

  if (sessionStorage.getItem('lab.build.reset')) {
    sessionStorage.removeItem('lab.build.reset');
    clearSave();
  }

  // ---------------------------------------------------------------- the scene
  function setUp(): void {
    const at = sys.region?.place('grant.center').at ?? game.player.pos;
    window.__game?.teleport(at.x, at.y, at.z);
    const x = Math.floor(at.x), y = Math.floor(at.y), z = Math.floor(at.z);
    const world = view.world.sim, plank = blockId('oak_plank');
    // A wall two blocks high with a corner, north-east of the player, for a chest to back onto.
    for (let dx = 3; dx <= 7; dx++) for (let dy = 0; dy < 2; dy++) world.setBlock(x + dx, y + dy, z - 5, plank);
    for (let dz = -4; dz <= -2; dz++) for (let dy = 0; dy < 2; dy++) world.setBlock(x + 7, y + dy, z + dz, plank);
    // A small patch that is tilled already, so seeds and the can have something to work on at once.
    for (let dx = -6; dx <= -4; dx++) for (let dz = 2; dz <= 4; dz++) sys.crops?.till(x + dx, y - 1, z + dz);
    for (const [item, count] of KIT) sys.inventory?.add(item, count);
    if (sys.inventory) sys.inventory.selected = 0;
    sys.time?.setTimeOfDay(0.4);
    sys.time?.setWeather('clear', true);
    game.flags.set(FLAG, true);
  }

  // ---------------------------------------------------------------- chests as flat pictures
  const sprites: THREE.Sprite[] = [];
  let material: THREE.SpriteMaterial | null = null;
  function drawFlatChests(): void {
    const all = sys.placeables?.all() ?? [];
    let n = 0;
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      if (p.kind !== 'chest') continue;
      if (!material) {
        const icon = view.assets.icon('chest');
        const map = icon.texture.clone();
        // The sheet is not flipped, so the picture's top is at the lower v.
        map.repeat.set(icon.uv[2] - icon.uv[0], icon.uv[1] - icon.uv[3]);
        map.offset.set(icon.uv[0], icon.uv[3]);
        map.needsUpdate = true;
        material = new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.5, fog: true });
      }
      const sprite = sprites[n] ?? (sprites[n] = new THREE.Sprite(material));
      if (!sprite.parent) view.scene.add(sprite);
      sprite.position.set(p.x + 0.5, p.y + 0.55, p.z + 0.5);
      sprite.scale.set(1.1, 1.1, 1);
      sprite.visible = true;
      n++;
    }
    for (let i = n; i < sprites.length; i++) sprites[i].visible = false;
  }

  let asked = false, ready = false;
  view.onFrame(() => {
    if (!view.started) {
      // The title holds the start. The lab goes straight in: its own save when there is one, a new game otherwise.
      if (!asked) { asked = true; if (!view.continueGame()) view.newGame(); }
      return;
    }
    if (!ready) {
      ready = true;
      if (!game.flags.is(FLAG)) setUp();
      card.hidden = false;
      // The first quest's beam of light stands between the camera and the plot. The lab is no place for it.
      const beam = view.scene.getObjectByName('waypoint-beam') as THREE.Mesh | undefined;
      if (beam) (beam.material as THREE.Material).visible = false;
    }
    if (flat) drawFlatChests();
  });
}
