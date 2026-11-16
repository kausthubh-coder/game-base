// Grant day at Saltgate as the player sees it, after the film: the quarter's models and stand-ins
// (openingview/saltgate.ts), the mirror and the deed (openingview/panels.ts), the bout with Dax, a gold diamond
// over the place to walk up to next (the mirror, the porridge, Dax's table, the map wall, the rack, the ring, the grant table,
// the ferry; the hall's door or the guild gate on the way when it is in another part of the guild), named, and waiting
// at the screen's edge with a chevron when off it, and the day up the river once the ferry pushes off
// (openingview/river.ts).
// The rules are src/game/opening; this file reads `game.systems.opening` and answers it.
//
// The bout: while it is on, a click or F swings at Dax. Three that land empty his guard; one too soon after the
// last is taken on his crate lid. His guard shows over his head as three diamonds.
//
// `?opening=<step>` starts a new game at a step of grant day (`wake`, `breakfast`, `lock`, `map`, `rack`, `spar`,
// `deed`, `quay` or `river`), every step before it done, the hero beside what that step needs. For testers and pictures.
import type { Systems } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import { PEOPLE, SALTGATE, SPOTS, type SpotId } from '../content/saltgate.ts';
import { GUARD, STEPS, type GrantStep } from '../opening/index.sim.ts';
import { saltgateAt } from '../opening/land.sim.ts';
import { createGrantPanels } from '../openingview/panels.ts';
import { createRiver } from '../openingview/river.ts';
import { createSaltgateDressing } from '../openingview/saltgate.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** How far from the screen's edges the mark waits when what it marks is off the screen, in pixels: room at the sides
 * for its name, and at the bottom for its name and the quick slots. */
const EDGE = { side: 96, top: 56, bottom: 128 };
/** The hall's wide door onto the yard, and the parts of the guild a mark leads between, in the quarter's grid. */
const HALL_DOOR = { x: 30.5, z: 17.5 };
const partOf = (x: number, z: number): 'hall' | 'yard' | 'out' => (x < 12 || x > 44 || z >= 29.5 ? 'out' : z < 17.5 ? 'hall' : 'yard');
/** The names the mark carries for what it marks: the mirror and the porridge need none, being in the room. */
const NAMES: Partial<Record<SpotId, string>> = { locks: 'Dax\'s lock table', maps: 'Mina\'s map wall', rack: 'The weapon rack', ring: 'Dax, in the ring', deed: 'The grant table', berth: 'The ferry' };

/** Seconds Dax rocks back when a swing lands, and how far, in blocks. */
const JOLT = 0.22, JOLT_SIZE = 0.28;

const STYLE = /* css */ `
.gd-mark, .gd-guard { position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none; will-change: transform; }
.gd-mark[hidden], .gd-guard[hidden] { display: none; }
.gd-mark { display: grid; justify-items: center; gap: 8px; width: 0; height: 0; }
.gd-mark i { width: 14px; height: 14px; margin-top: -7px; background: var(--ui-gold-bright); rotate: 45deg; box-shadow: 0 0 0 2px rgb(10 12 20 / 0.55), 0 0 14px rgb(240 212 138 / 0.85); animation: gd-bob 1.4s ease-in-out infinite alternate; }
.gd-mark span { white-space: nowrap; padding: 2px 10px 3px; font: 800 13px / 1.3 var(--ui-font); color: var(--ui-glass-ink); background: var(--ui-glass); border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ui-glass-line), var(--ui-glass-shadow); }
/* Off the screen the diamond waits at its edge, a gold chevron pointing the way. */
.gd-mark b { display: none; width: 0; height: 0; border: 7px solid transparent; border-left: 10px solid var(--ui-gold-bright); filter: drop-shadow(0 0 4px rgb(240 212 138 / 0.8)); }
.gd-mark.is-off b { display: block; position: absolute; left: 12px; top: -7px; transform-origin: -12px 50%; rotate: var(--gd-way, 0deg); }
@keyframes gd-bob { from { translate: 0 0; } to { translate: 0 -5px; } }
.gd-guard { display: flex; gap: 6px; padding: 6px 10px; margin: -14px 0 0 -38px; border-radius: 999px; background: var(--ui-glass); box-shadow: inset 0 0 0 1px var(--ui-glass-line); }
.gd-guard i { width: 10px; height: 10px; background: var(--ui-gold-bright); transform: rotate(45deg); box-shadow: 0 0 6px rgb(240 212 138 / 0.7); }
.gd-guard i.gone { background: transparent; box-shadow: inset 0 0 0 1.5px rgb(246 241 231 / 0.45); }
.ui-book.st-cinema-on .gd-mark, .ui-book.st-cinema-on .gd-guard, .ui-book.st-film-on .gd-mark, .ui-book.ui-covered .gd-mark { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { .gd-mark i { animation: none; } }
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  const sys = game.systems as Partial<Systems>;
  if (!sys.opening) return;
  addStyle(root, 'story-grantday', STYLE);

  const sound = (s: 'click' | 'open' | 'close') => game.events.emit('ui.sound', { sound: s });
  const dressing = createSaltgateDressing(view);
  const panels = createGrantPanels(root, () => sys.opening, sound);
  const river = createRiver(view, book);

  // ---- the diamond over what to walk up to, and Dax's guard
  const mark = document.createElement('div');
  mark.className = 'gd-mark';
  mark.hidden = true;
  mark.append(document.createElement('i'), document.createElement('b'), document.createElement('span'));
  const markName = mark.querySelector('span')!;
  const guard = document.createElement('div');
  guard.className = 'gd-guard';
  guard.hidden = true;
  guard.setAttribute('aria-label', 'Dax\'s guard');
  for (let i = 0; i < GUARD; i++) guard.append(document.createElement('i'));
  root.append(mark, guard);
  const screen = { x: 0, y: 0 };

  /** Where the next step of grant day is: the mirror after Hobb has spoken, the porridge, Dax's lock table, Mina's map
   * wall, the rack, the grant table, the berth. A scene's people stand there; things have no "!" of their own. */
  function nextThing(): SpotId | null {
    const f = game.flags;
    if (!f.is(FLAG.opening)) return null;
    if (!f.is(FLAG.scene(1))) return null;
    if (!f.get(FLAG.heroLook) && !(sys.talk?.active ?? false)) return 'mirror';
    if (!f.is(FLAG.step('grantday', 'breakfast'))) return 'porridge';
    if (!f.is(FLAG.scene(2))) return 'locks';
    if (!f.is(FLAG.scene(3))) return 'maps';
    if (!f.get(FLAG.choice('weapon'))) return 'rack';
    if (!f.is(FLAG.scene(4))) return 'ring';
    if (!f.is(FLAG.scene(5))) return 'deed';
    if (f.is(FLAG.scene(5)) && f.get(FLAG.heroName) && !f.is(FLAG.scene(6))) return 'berth';
    return null;
  }
  /** Where the next thing is, or the doorway on the way to it when it is in another part of the guild. */
  function wayTo(thing: SpotId, hero: { x: number; z: number }): { spot: SpotId | 'door'; name: string } {
    const here = partOf(hero.x - SALTGATE.x, hero.z - SALTGATE.z), there = partOf(SPOTS[thing].x, SPOTS[thing].z);
    if (here === there) return { spot: thing, name: NAMES[thing] ?? '' };
    // The hall and the yard meet at the hall's wide door, and the yard and the street at the gate.
    if (here === 'hall' || (here === 'yard' && there === 'hall')) return { spot: 'door', name: here === 'hall' ? 'Into the yard' : 'Into the hall' };
    return { spot: 'gate', name: 'The guild gate' };
  }

  function pin(el: HTMLElement, x: number, y: number, z: number): void {
    const p = view.project(x, y, z, screen);
    el.hidden = !p;
    if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }
  /** Like pin, but off the screen it waits at the edge on the hero's side of the way, pointing. With `edgeOnly`, only that. */
  function pinOrPoint(el: HTMLElement, x: number, y: number, z: number, edgeOnly = false): void {
    const p = view.project(x, y, z, screen);
    el.classList.toggle('is-off', !p);
    el.hidden = !!p && edgeOnly;
    if (p) { el.style.transform = `translate(${p.x}px, ${p.y}px)`; return; }
    const hero = view.playerPosition;
    const from = view.project(hero.x, hero.y + 1, hero.z, screen);
    if (!from) { el.hidden = true; return; }
    const hx = from.x, hy = from.y;
    // A point two blocks along the way gives its direction on the screen.
    const d = Math.hypot(x - hero.x, z - hero.z) || 1;
    const step = view.project(hero.x + ((x - hero.x) / d) * 2, hero.y + 1, hero.z + ((z - hero.z) / d) * 2, screen);
    if (!step) { el.hidden = true; return; }
    let dx = step.x - hx, dy = step.y - hy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = innerWidth, h = innerHeight;
    const tx = dx > 0 ? (w - EDGE.side - hx) / dx : dx < 0 ? (EDGE.side - hx) / dx : Infinity;
    const ty = dy > 0 ? (h - EDGE.bottom - hy) / dy : dy < 0 ? (EDGE.top - hy) / dy : Infinity;
    const t = Math.max(0, Math.min(tx, ty));
    el.style.transform = `translate(${hx + dx * t}px, ${hy + dy * t}px)`;
    el.style.setProperty('--gd-way', `${Math.atan2(dy, dx)}rad`);
  }

  // ---- the bout
  let jolt = 0;
  const daxHome = { x: 0, z: 0 };
  game.events.on('opening.swing', ({ landed }) => {
    sound(landed ? 'open' : 'click');
    if (landed) jolt = JOLT;
  });
  const boutOn = (): boolean => sys.opening?.bout().on ?? false;
  view.keys.onPress((press) => {
    if (press.kind === 'use' && press.button === 'primary' && boutOn() && !game.player.busy) sys.opening?.swing();
  });

  // Keys while a panel is open, and F in the bout. In the capture phase, so the pause menu and the game never see
  // a key a panel used. This view installs before the ui-* views.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (panels.open) {
      if (panels.key(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const typing = event.target instanceof HTMLInputElement;
      const moving = ['Tab', 'Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code);
      // The mirror has no text box: a letter would open the bag under it.
      if (!typing && !moving) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    if (event.code === 'KeyF' && !event.repeat && boutOn() && !game.player.busy) {
      event.preventDefault();
      sys.opening?.swing();
    }
  }, { capture: true });

  // ---- `?opening=<step>`: a new game at a step of grant day
  /** What each step leaves done, in order, and where the hero stands for the step after it. */
  const DONE: Record<(typeof STEPS)[number], [flag: string, value: string | number | boolean][]> = {
    film: [[FLAG.opening, true]],
    wake: [[FLAG.heroLook, 'a'], [FLAG.scene(1), true]],
    breakfast: [[FLAG.step('grantday', 'breakfast'), true], [FLAG.mealDay, 1]],
    lock: [[FLAG.scene(2), true]],
    map: [[FLAG.scene(3), true]],
    rack: [[FLAG.choice('weapon'), 'sword']],
    spar: [['story.seen.scene.4', true], [FLAG.scene(4), true]],
    deed: [[FLAG.heroName, 'Ash'], [FLAG.scene(5), true]],
    quay: [[FLAG.scene(6), true]],
    river: [],
  };
  const STAND: Partial<Record<GrantStep, SpotId>> = { wake: 'bunk', breakfast: 'porridge', lock: 'locks', map: 'maps', rack: 'rack', spar: 'ring', deed: 'deed', quay: 'berth' };
  const asked = new URLSearchParams(location.search).get('opening') as GrantStep | null;
  book.onStart((fresh) => {
    if (!fresh || !asked || !STEPS.includes(asked as (typeof STEPS)[number])) return;
    for (const step of STEPS) {
      if (step === asked) break;
      for (const [flag, value] of DONE[step]) game.flags.set(flag, value);
    }
    const spot = STAND[asked];
    if (!spot) return;
    const at = saltgateAt(SPOTS[spot].x - (spot === 'rack' ? -1.4 : 1.2), SPOTS[spot].z + (spot === 'locks' || spot === 'maps' ? 1.4 : 0));
    const cx = Math.floor(at.x) >> 4, cz = Math.floor(at.z) >> 4;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) view.world.sim.load(cx + dx, cz + dz);
    view.hero.teleport(at.x, at.y, at.z, Math.PI);
    view.hero.blend(1);
    view.camera.follow(at.x, at.y, at.z);
    view.camera.snap();
  });

  // ---- the frame
  let ferrying = false;
  view.onFrame((dt) => {
    const opening = sys.opening;
    if (!opening) return;
    const f = game.flags;
    const ask = opening.asking();
    panels.sync(ask);
    if (ask) game.player.busy = true;
    dressing.update({
      ate: f.is(FLAG.step('grantday', 'breakfast')),
      weapon: (f.get(FLAG.choice('weapon')) as string | undefined) ?? null,
      grant: !f.is(FLAG.scene(5)),
    });
    view.claim('bout', boutOn() ? ['use'] : null);

    // The ferry pushes off once the goodbyes are over.
    if (opening.stage() === 'ferry' && !ferrying && !river.playing && !(sys.talk?.active ?? false)) {
      ferrying = true;
      river.play(() => {
        ferrying = false;
        opening.ferryDone();
      });
    }

    const here = opening.inSaltgate(view.playerPosition);
    // The diamond over the next thing.
    const thing = here ? nextThing() : null;
    if (thing && !book.covered && !(sys.talk?.active ?? false)) {
      const way = wayTo(thing, view.playerPosition);
      const spot = way.spot === 'door' ? HALL_DOOR : SPOTS[way.spot];
      const at = saltgateAt(spot.x, spot.z, SALTGATE.ground + (way.spot === 'mirror' ? 2.9 : way.spot === 'rack' || way.spot === 'gate' || way.spot === 'door' || way.spot === 'maps' ? 2.6 : 1.6));
      if (way.spot === 'mirror') at.x = saltgateAt(33.9, 0).x;
      if (markName.textContent !== way.name) markName.textContent = way.name;
      markName.hidden = way.name === '';
      // In the ring Dax's guard marks him: the mark only points the way while he is off the screen.
      pinOrPoint(mark, at.x, at.y, at.z, way.spot === 'ring');
    } else mark.hidden = true;

    // Dax's guard, and his step back when a swing lands.
    const dax = game.actors.get(PEOPLE.dax.id);
    if (dax && boutOn()) {
      if (jolt <= 0) { daxHome.x = dax.pos.x; daxHome.z = dax.pos.z; }
      const left = sys.opening?.bout().guard ?? 0;
      guard.querySelectorAll('i').forEach((pip, i) => pip.classList.toggle('gone', i >= left));
      pin(guard, dax.pos.x, dax.pos.y + 2.5, dax.pos.z);
    } else guard.hidden = true;
    if (dax && jolt > 0) {
      jolt = Math.max(0, jolt - dt);
      const push = Math.sin((jolt / JOLT) * Math.PI) * JOLT_SIZE;
      dax.pos.x = daxHome.x - Math.sin(dax.facing) * push;
      dax.pos.z = daxHome.z + Math.cos(dax.facing) * push;
    }
  });
}
