// The day up the river: grant day's last step, a camera move over the real Greenhollow, shot by shot with one
// line each, letterbox bars and soft dips to black (`RIVER` in content/opening.ts, timed by uiview/opening.ts).
// It ends on the hero at the landing, where the game's own camera takes over.
//
// The land loads round the hero, so the hero rides along unseen: behind each dip to black they are set down at
// the next shot's place, and the land there is made at once. The rules wait while it plays, and every key and the
// wheel are its; Esc skips to the landing.
import * as THREE from 'three';
import type { Vec3 } from '../../engine/types.ts';
import { RIVER, type Offset, type OpeningShot } from '../content/opening.ts';
import type { GameView } from '../shell/view.ts';
import type { Book } from '../uiview/book.ts';
import { createOpening, type Opening, type OpeningFrame } from '../uiview/opening.ts';
import { addStyle } from '../uiview/theme.ts';

/** The game's own lens, which the last shot widens back to. */
const GAME_FOV = 20;
/** Chunks made at once round each shot's place, each way. */
const LOAD_REACH = 3;
/** The longest a dip to black waits for the next shot's land to be drawn, in seconds. */
const HOLD_MAX = 2.5;

const STYLE = /* css */ `
.st-cinema { position: absolute; inset: 0; z-index: 50; pointer-events: none; overflow: hidden; --st-black: 1; --st-bars: 1; --st-words: 0; }
.st-cinema[hidden] { display: none; }
.st-veil { position: absolute; inset: 0; background: oklch(0.12 0.012 60); opacity: var(--st-black); }
.st-bar { position: absolute; left: 0; right: 0; height: clamp(56px, 12vh, 132px); background: oklch(0.13 0.014 60); display: flex; align-items: center; justify-content: center; padding: 0 clamp(16px, 4vw, 48px); }
.st-bar-top { top: 0; transform: translateY(calc(-100% * (1 - var(--st-bars)))); justify-content: flex-end; }
.st-bar-bottom { bottom: 0; transform: translateY(calc(100% * (1 - var(--st-bars)))); }
.st-line { margin: 0; max-width: 36em; font: 600 clamp(17px, 1.9vw, 23px) / 1.45 var(--ui-font); text-align: center; text-wrap: balance; color: var(--ui-glass-ink); opacity: var(--st-words); }
.st-title { position: absolute; left: 0; right: 0; top: 30%; display: grid; justify-items: center; gap: 12px; color: var(--ui-paper-light); text-shadow: 0 2px 24px rgb(10 12 20 / 0.7), 0 1px 3px rgb(10 12 20 / 0.6); opacity: var(--st-words); transform: translateY(calc(10px * (1 - var(--st-words)))); }
.st-title[hidden] { display: none; }
.st-name { margin: 0; font: 650 clamp(44px, 8vw, 96px) / 1 var(--ui-display); letter-spacing: -0.015em; }
.st-rule { width: 72px; height: 2px; background: var(--ui-gold-bright); }
.st-skip { pointer-events: auto; display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px 0 16px; font: 700 15px / 1 var(--ui-font); color: var(--ui-glass-ink); background: transparent; border: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ui-glass-line); cursor: pointer; opacity: max(var(--st-bars), 0.0001); }
.st-skip:hover { background: rgb(246 241 231 / 0.1); }
.st-skip:focus-visible { outline: 2px solid var(--ui-gold-bright); outline-offset: 2px; }
.st-skip kbd { display: inline-grid; place-items: center; min-width: 30px; height: 22px; padding: 0 6px; font: 700 12px / 1 var(--ui-font); color: var(--ui-night); background: linear-gradient(180deg, var(--ui-paper-light), var(--ui-paper-3)); border-radius: 6px; }
/* The HUD and the marks over heads step out while the river plays. */
.ui-book.st-cinema-on .gb-hud, .ui-book.st-cinema-on .gb-beacon, .ui-book.st-cinema-on .gu-top, .ui-book.st-cinema-on .gu-toasts,
.ui-book.st-cinema-on .gu-prompt, .ui-book.st-cinema-on .gb-dialogue, .ui-book.st-cinema-on .marks { visibility: hidden; }
`;

export interface River {
  readonly playing: boolean;
  /** Plays it. `done` runs once the hero stands at the landing and the game's camera has them. */
  play(done: () => void): void;
}

export function createRiver(view: GameView, book: Book): River {
  const { game, root } = view;
  addStyle(root, 'story-river', STYLE);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cinema = document.createElement('div');
  cinema.className = 'st-cinema';
  cinema.hidden = true;
  cinema.innerHTML = /* html */ `
    <div class="st-veil"></div>
    <div class="st-title" hidden><h1 class="st-name"></h1><span class="st-rule"></span></div>
    <div class="st-bar st-bar-top"><button class="st-skip" type="button" data-key="river:skip">Skip <kbd>Esc</kbd></button></div>
    <div class="st-bar st-bar-bottom"><p class="st-line" aria-live="polite"></p></div>`;
  root.append(cinema);
  const title = cinema.querySelector<HTMLElement>('.st-title')!;
  const name = cinema.querySelector<HTMLElement>('.st-name')!;
  const line = cinema.querySelector<HTMLElement>('.st-line')!;
  const skipButton = cinema.querySelector<HTMLButtonElement>('.st-skip')!;

  let run: Opening | null = null;
  let onDone: (() => void) | null = null;
  let shown = -1, standing = -1, held = 0;
  /** The land is painted (not the blocks look): only then is there drawn land to wait for. */
  let painted = false;
  const frame: OpeningFrame = { shot: 0, move: 0, black: 1, bars: 1, words: 0, done: false };

  const placeOf = (shot: OpeningShot): Vec3 | null => {
    try { return game.systems.region?.place(shot.place).at ?? null; } catch { return null; }
  };

  /**
   * Sets the hero down, unseen, where the shot's camera starts, so the land in view is made and nothing stands
   * between the camera and the hero to be cut away. The last shot's place is the landing itself.
   */
  function standAt(i: number): void {
    standing = i;
    const shot = RIVER[i];
    const place = placeOf(shot);
    if (!place) return;
    const at = shot.land ? place : { x: place.x + shot.from[0], y: place.y, z: place.z + shot.from[2] };
    const cx = Math.floor(at.x) >> 4, cz = Math.floor(at.z) >> 4;
    for (let dx = -LOAD_REACH; dx <= LOAD_REACH; dx++) for (let dz = -LOAD_REACH; dz <= LOAD_REACH; dz++) view.world.sim.load(cx + dx, cz + dz);
    view.hero.teleport(at.x, at.y, at.z, Math.PI);
    // The rules are paused, so nothing else moves the drawn hero: the land loads round where it is drawn.
    view.hero.blend(1);
    if (RIVER[i].land) view.camera.snap();
  }

  function skip(): void {
    if (!run || run.skipped) return;
    run.skip();
    game.events.emit('ui.sound', { sound: 'click' });
  }
  skipButton.addEventListener('click', skip);

  function end(): void {
    run = null;
    cinema.hidden = true;
    root.classList.remove('st-cinema-on');
    view.setPaused('river', false);
    view.hero.actor.visible = true;
    if (document.activeElement === skipButton) skipButton.blur();
    game.player.busy = false;
    book.settle();
    const done = onDone;
    onDone = null;
    done?.();
  }

  window.addEventListener('keydown', (event) => {
    if (!run) return;
    if (event.code === 'Escape' && !event.repeat) skip();
    if (document.activeElement === skipButton && (event.code === 'Enter' || event.code === 'Space')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('wheel', (event) => {
    if (!run) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  // ---- the camera, moved after the game's camera has placed it each frame
  const lens = view.ctx.camera as THREE.PerspectiveCamera;
  const rigPos = new THREE.Vector3(), rigLook = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), look = new THREE.Vector3(), lookTo = new THREE.Vector3();
  const base: Vec3 = { x: 0, y: 0, z: 0 };
  const at = (out: THREE.Vector3, o: Offset): THREE.Vector3 => out.set(base.x + o[0], base.y + o[1], base.z + o[2]);

  function aim(shot: OpeningShot, move: number): void {
    const place = placeOf(shot);
    if (place) { base.x = place.x; base.y = place.y; base.z = place.z; } else { base.x = view.playerPosition.x; base.y = view.playerPosition.y; base.z = view.playerPosition.z; }
    at(from, shot.from);
    at(look, shot.look);
    let fov = shot.fov;
    if (shot.land) {
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

  /**
   * The painted land the shot shows is drawn: it is made a few tiles a frame, outward from the hero, so the film
   * samples the ground from the camera out past where it looks, and to each side.
   */
  function landDrawn(i: number): boolean {
    const shot = RIVER[i];
    const place = shot.land ? view.playerPosition : placeOf(shot);
    if (!place) return true;
    if (shot.land) return Number.isFinite(view.groundAt(place.x, place.z));
    for (const [eye, aimAt] of [[shot.from, shot.look], [shot.to, shot.lookTo]] as const) {
      const dx = aimAt[0] - eye[0], dz = aimAt[2] - eye[2];
      for (let t = 0; t <= 1.6; t += 0.4) {
        for (let side = -0.4; side <= 0.4; side += 0.4) {
          const x = place.x + eye[0] + dx * t - dz * side * t, z = place.z + eye[2] + dz * t + dx * side * t;
          if (!Number.isFinite(view.groundAt(x, z))) return false;
        }
      }
    }
    return true;
  }

  view.onFrame((dt) => {
    if (!run) return;
    game.player.busy = true;
    // Behind the black between two shots, the film waits for the next shot's land, so none of it pops in on screen.
    const waiting = painted && !run.skipped && frame.black > 0.98 && frame.shot === standing && held < HOLD_MAX && !landDrawn(frame.shot);
    held = waiting ? held + dt : frame.black > 0.98 ? held : 0;
    run.advance(waiting ? 0 : dt);
    run.frame(frame);
    // The hero moves on to the next place as a shot begins, out of the dip to black, and is never seen on the way.
    if (frame.shot !== standing) standAt(frame.shot);
    view.hero.actor.visible = !!RIVER[frame.shot].land && frame.move > 0.85;
    rigPos.copy(lens.position);
    rigLook.set(view.playerPosition.x, view.playerPosition.y + 1, view.playerPosition.z);
    const shot = RIVER[frame.shot];
    aim(shot, frame.done ? 1 : still ? (shot.land ? 1 : 0.5) : frame.move);
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

  return {
    get playing() { return run !== null; },
    play(done) {
      onDone = done;
      run = createOpening(RIVER);
      shown = standing = -1;
      held = 0;
      // The quay the hero stands on is drawn, unless the land is drawn as blocks.
      painted = Number.isFinite(view.groundAt(view.playerPosition.x, view.playerPosition.z));
      frame.shot = 0;
      frame.black = 1;
      cinema.hidden = false;
      root.classList.add('st-cinema-on');
      view.setPaused('river', true);
      game.player.busy = true;
      view.hero.actor.visible = false;
      standAt(0);
      skipButton.focus({ preventScroll: true });
    },
  };
}
