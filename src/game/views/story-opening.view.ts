// The opening scene: on a new game chosen from the title, before the player has control, a few shots of
// the valley with one line each, letterbox bars and soft fades. The real camera moves over the real world.
// A Skip button and Esc end it at any point. It plays once per new game and never on Continue.
//
// The shots are src/game/content/opening.ts and the clock is src/game/uiview/opening.ts. This file draws
// them: it moves the lens after the game's camera has placed it each frame, so the rig, the cutaway and
// the world's focus still follow the hero and the last shot lands exactly where play begins.
//
// While it plays the rules are paused (once the people are in the world, so Tamsin is at her stone), the
// player is busy, the HUD steps out, and every key and the wheel belong to it.
//
// `?opening-at=<seconds>` holds the scene at that moment, for screenshots.
import * as THREE from 'three';
import type { Vec3 } from '../../engine/types.ts';
import { OPENING, type Offset, type OpeningShot } from '../content/opening.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { OPENING_FLAG, createOpening, playsOpening, takeNewGame, type Opening, type OpeningFrame } from '../uiview/opening.ts';
import { addStyle } from '../uiview/theme.ts';

/** The game's own lens, which the last shot widens back to. */
const GAME_FOV = 20;
/** Seconds the rules may run at the start, at most, while the people are put in the world. */
const SETTLE = 1.5;

const STYLE = /* css */ `
.st-cinema { position: absolute; inset: 0; z-index: 50; pointer-events: none; overflow: hidden; --st-black: 1; --st-bars: 1; --st-words: 0; }
.st-cinema[hidden] { display: none; }
.st-veil { position: absolute; inset: 0; background: oklch(0.12 0.012 60); opacity: var(--st-black); }
.st-bar { position: absolute; left: 0; right: 0; height: clamp(56px, 12vh, 132px); background: oklch(0.13 0.014 60); display: flex; align-items: center; justify-content: center; padding: 0 clamp(16px, 4vw, 48px); }
.st-bar-top { top: 0; transform: translateY(calc(-100% * (1 - var(--st-bars)))); justify-content: flex-end; }
.st-bar-bottom { bottom: 0; transform: translateY(calc(100% * (1 - var(--st-bars)))); }
.st-line {
  margin: 0; max-width: 36em;
  font: 400 clamp(17px, 1.9vw, 23px) / 1.45 var(--ui-font);
  letter-spacing: 0.005em; text-align: center; text-wrap: balance;
  color: oklch(0.93 0.035 85);
  -webkit-font-smoothing: antialiased;
  opacity: var(--st-words);
}
.st-title {
  position: absolute; left: 0; right: 0; top: 30%;
  display: grid; justify-items: center; gap: 12px;
  color: oklch(0.96 0.03 88);
  text-shadow: 0 2px 24px oklch(0.15 0.03 60 / 0.7), 0 1px 3px oklch(0.15 0.03 60 / 0.6);
  opacity: var(--st-words);
  transform: translateY(calc(10px * (1 - var(--st-words))));
}
.st-title[hidden] { display: none; }
.st-eyebrow { font: 600 13px / 1 var(--ui-font); letter-spacing: 0.22em; text-transform: uppercase; color: oklch(0.86 0.09 84); }
.st-name { margin: 0; font: 400 clamp(44px, 8vw, 96px) / 1 var(--ui-font); letter-spacing: -0.015em; }
.st-rule { width: 72px; height: 2px; background: var(--ui-brass); box-shadow: 0 1px 6px oklch(0.15 0.03 60 / 0.5); }
.st-skip {
  pointer-events: auto;
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 40px; padding: 0 10px 0 16px;
  font: 600 15px / 1 var(--ui-font); letter-spacing: 0.02em;
  color: oklch(0.93 0.035 85);
  background: transparent;
  border: 1px solid oklch(0.93 0.035 85 / 0.35); border-radius: 2px;
  cursor: pointer;
  opacity: max(var(--st-bars), 0.0001);
}
.st-skip:hover { background: oklch(0.93 0.035 85 / 0.1); border-color: oklch(0.93 0.035 85 / 0.6); }
.st-skip:active { background: oklch(0.93 0.035 85 / 0.16); }
.st-skip:focus-visible { outline: 2px solid var(--ui-brass); outline-offset: 2px; }
.st-skip kbd {
  display: inline-grid; place-items: center; min-width: 30px; height: 22px; padding: 0 6px;
  font: 600 12px / 1 var(--ui-font); color: oklch(0.86 0.04 85);
  border: 1px solid oklch(0.93 0.035 85 / 0.3); border-radius: 2px;
}
/* The HUD, the prompt, hints, toasts, the waypoint and the marks over heads (placed with the game's camera) step out while the scene plays. */
.ui-book.st-cinema-on .gb-hud, .ui-book.st-cinema-on .gb-beacon, .ui-book.st-cinema-on .gu-top,
.ui-book.st-cinema-on .gu-toasts, .ui-book.st-cinema-on .gu-prompt, .ui-book.st-cinema-on .gb-dialogue,
.ui-book.st-cinema-on .marks { visibility: hidden; }
@container gu (width < 560px) {
  .st-bar { height: 96px; }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  addStyle(root, 'story-opening', STYLE);
  const params = new URLSearchParams(location.search);
  const holdAt = params.has('opening-at') ? Number(params.get('opening-at')) : null;
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- the page
  const cinema = document.createElement('div');
  cinema.className = 'st-cinema';
  cinema.hidden = true;
  cinema.innerHTML = /* html */ `
    <div class="st-veil"></div>
    <div class="st-title" hidden><span class="st-eyebrow">The first part</span><h1 class="st-name"></h1><span class="st-rule"></span></div>
    <div class="st-bar st-bar-top"><button class="st-skip" type="button" data-key="opening:skip">Skip <kbd>Esc</kbd></button></div>
    <div class="st-bar st-bar-bottom"><p class="st-line" aria-live="polite"></p></div>`;
  root.append(cinema);
  const title = cinema.querySelector<HTMLElement>('.st-title')!;
  const name = cinema.querySelector<HTMLElement>('.st-name')!;
  const line = cinema.querySelector<HTMLElement>('.st-line')!;
  const skipButton = cinema.querySelector<HTMLButtonElement>('.st-skip')!;

  let run: Opening | null = null;
  let since = 0, paused = false, shown = -1;
  const frame: OpeningFrame = { shot: 0, move: 0, black: 1, bars: 1, words: 0, done: false };

  function skip(): void {
    if (!run || run.skipped) return;
    run.skip();
    game.events.emit('ui.sound', { sound: 'click' });
  }
  skipButton.addEventListener('click', skip);

  function begin(): void {
    game.flags.set(OPENING_FLAG, true);
    run = createOpening(OPENING);
    since = 0;
    paused = false;
    shown = -1;
    cinema.hidden = false;
    root.classList.add('st-cinema-on');
    game.player.busy = true;
    skipButton.focus({ preventScroll: true });
  }

  function end(): void {
    run = null;
    cinema.hidden = true;
    root.classList.remove('st-cinema-on');
    if (paused) view.setPaused('opening', false);
    paused = false;
    if (document.activeElement === skipButton) skipButton.blur();
    book.settle();
  }

  book.onStart((fresh) => {
    const chosen = takeNewGame();
    if (playsOpening({ fresh, chosen, flags: game.flags })) begin();
  });

  // ---- every key and the wheel are the scene's. Esc skips. In the capture phase, so the panels, the
  // pause menu and the game's keys never see them. This view installs before the ui-* views.
  window.addEventListener('keydown', (event) => {
    if (!run) return;
    if (event.code === 'Escape' && !event.repeat) skip();
    // The Skip button still answers Enter and Space when it has the focus.
    if (document.activeElement === skipButton && (event.code === 'Enter' || event.code === 'Space' || event.code === 'NumpadEnter')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('wheel', (event) => {
    if (!run) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  // ---- the camera
  const lens = view.ctx.camera as THREE.PerspectiveCamera;
  const rigPos = new THREE.Vector3(), rigLook = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), look = new THREE.Vector3(), lookTo = new THREE.Vector3();
  const base: Vec3 = { x: 0, y: 0, z: 0 };

  const at = (out: THREE.Vector3, offset: Offset): THREE.Vector3 => out.set(base.x + offset[0], base.y + offset[1], base.z + offset[2]);

  function aim(shot: OpeningShot, move: number): void {
    const place = view.game.systems.region?.place(shot.place)?.at;
    if (place) { base.x = place.x; base.y = place.y; base.z = place.z; } else { base.x = view.playerPosition.x; base.y = view.playerPosition.y; base.z = view.playerPosition.z; }
    at(from, shot.from);
    at(look, shot.look);
    let fov = shot.fov;
    if (shot.land) {
      // The game's camera has placed the lens for this frame already: that is where the shot ends.
      to.copy(rigPos);
      lookTo.copy(rigLook);
      fov = shot.fov + (GAME_FOV - shot.fov) * move;
    } else {
      at(to, shot.to);
      at(lookTo, shot.lookTo);
    }
    lens.position.lerpVectors(from, to, move);
    look.lerp(lookTo, move);
    lens.lookAt(look);
    lens.fov = fov;
    lens.near = 0.5;
    lens.far = Math.max(lens.far, 600);
    lens.updateProjectionMatrix();
  }

  view.onFrame((dt) => {
    if (!run) return;
    // The people are made on the first step of the rules. Once Tamsin stands at her stone, the world waits.
    since += dt;
    if (!paused && (game.actors.has('npc:tamsin') || since >= SETTLE)) {
      paused = true;
      view.setPaused('opening', true);
    }
    game.player.busy = true;

    if (holdAt !== null && Number.isFinite(holdAt) && !run.skipped) run.advance(Math.max(0, holdAt - run.time));
    else run.advance(dt);
    run.frame(frame);

    rigPos.copy(lens.position);
    rigLook.set(view.playerPosition.x, view.playerPosition.y + 1, view.playerPosition.z);
    const shot = OPENING[frame.shot];
    const move = still ? (shot.land ? 1 : 0.5) : frame.move;
    aim(shot, frame.done ? 1 : move);

    if (frame.shot !== shown) {
      shown = frame.shot;
      line.textContent = shot.line;
      title.hidden = !shot.title;
      name.textContent = shot.title ?? '';
    }
    cinema.style.setProperty('--st-black', frame.black.toFixed(3));
    cinema.style.setProperty('--st-bars', frame.bars.toFixed(3));
    cinema.style.setProperty('--st-words', frame.words.toFixed(3));
    if (frame.done) end();
  });
}
