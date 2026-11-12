// The director: plays a film from src/game/content/cutscenes.ts in the real world with the real camera. Every
// frame of it comes from src/game/uiview/cutscene.ts, a pure function of the film and its time; this file only
// draws that frame. The design and its seven rules are docs/cutscenes.md, "How a film works".
//
// A film starts when the rules first set its flag in play, with the player near its place. The director sets
// the film's own flag as it starts, so it plays once in a save, and never in an online world. While it plays
// the rules are paused, the player is busy, the HUD steps out, and every key and the wheel belong to it; Esc
// and the Skip button end it. Under black, as it starts, the player is put where the film ends (`land`), so
// the world after it is the same watched or skipped.
//
// The people in it are puppets, sprites of the director's own. The actor of the rules each one stands for is
// hidden while it plays. The lens is moved after the game's camera has placed it each frame, so the last shot
// eases into exactly the camera play resumes with. The fire is held through src/game/worldview/camp.ts, and
// the film's own sounds are src/game/uiview/film-sound.ts.
//
// `?scene=<scene>` starts a new game straight into a film (its own save, src/game/shell/save.ts), and
// `?cut-at=<seconds>` holds it at that moment, for pictures and checks. The opening scene keeps its own player,
// src/game/views/story-opening.view.ts, and this is modelled on it.
import * as THREE from 'three';
import type { Systems } from '../api.sim.ts';
import { FILMS, filmFlag, type Film, type Pose, type PuppetPose } from '../content/cutscenes.ts';
import { readSave } from '../shell/save.ts';
import type { SpriteHandle } from '../../features/sprites/index.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { createFilm, facingTo, filmForScene, newFrame, resolveFilm, startsFilm, type Cut, type FilmFrame, type FilmRun } from '../uiview/cutscene.ts';
import { setStage } from '../uiview/cutscene-stage.ts';
import { createFilmSound, type FilmSound } from '../uiview/film-sound.ts';
import { addStyle } from '../uiview/theme.ts';
import { campOf, type HeldFire } from '../worldview/camp.ts';
import { placeAt } from '../worldview/region.ts';

/** The reason the rules are paused while a film plays. */
const PAUSE = 'film';
/** The lens comes this close to what it films. The game's own camera keeps a block or more. */
const NEAR = 0.2;
/** Seconds a puppet stays after the film when its actor of the rules is not in the world yet. */
const LINGER = 1;

const STYLE = /* css */ `
.sf-cinema { position: absolute; inset: 0; z-index: 50; pointer-events: none; overflow: hidden; --sf-black: 1; --sf-bars: 1; --sf-words: 0; }
.sf-cinema[hidden] { display: none; }
.sf-veil { position: absolute; inset: 0; background: oklch(0.1 0.012 60); opacity: var(--sf-black); }
.sf-bar { position: absolute; left: 0; right: 0; height: clamp(52px, 11vh, 120px); background: oklch(0.1 0.012 60); display: flex; align-items: center; justify-content: center; padding: 0 clamp(16px, 4vw, 48px); }
.sf-bar-top { top: 0; transform: translateY(calc(-100% * (1 - var(--sf-bars)))); justify-content: flex-end; }
.sf-bar-bottom { bottom: 0; transform: translateY(calc(100% * (1 - var(--sf-bars)))); }
.sf-line {
  margin: 0; max-width: 34em;
  font: 400 clamp(17px, 1.9vw, 23px) / 1.45 var(--ui-font);
  letter-spacing: 0.005em; text-align: center; text-wrap: balance; font-style: italic;
  color: oklch(0.93 0.035 85);
  -webkit-font-smoothing: antialiased;
  opacity: var(--sf-words);
}
.sf-skip {
  pointer-events: auto;
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 40px; padding: 0 10px 0 16px;
  font: 600 15px / 1 var(--ui-font); letter-spacing: 0.02em;
  color: oklch(0.93 0.035 85 / 0.8);
  background: transparent;
  border: 1px solid oklch(0.93 0.035 85 / 0.25); border-radius: 2px;
  cursor: pointer;
  opacity: max(var(--sf-bars), 0.0001);
}
.sf-skip:hover { color: oklch(0.93 0.035 85); background: oklch(0.93 0.035 85 / 0.1); border-color: oklch(0.93 0.035 85 / 0.6); }
.sf-skip:active { background: oklch(0.93 0.035 85 / 0.16); }
.sf-skip:focus-visible { outline: 2px solid var(--ui-brass); outline-offset: 2px; }
.sf-skip kbd {
  display: inline-grid; place-items: center; min-width: 30px; height: 22px; padding: 0 6px;
  font: 600 12px / 1 var(--ui-font); color: oklch(0.86 0.04 85);
  border: 1px solid oklch(0.93 0.035 85 / 0.3); border-radius: 2px;
}
/* The HUD, the prompt, hints, toasts, the waypoint, the badges and the marks over heads step out while a film plays. */
.ui-book.sf-on .gb-hud, .ui-book.sf-on .gb-beacon, .ui-book.sf-on .gu-top,
.ui-book.sf-on .gu-toasts, .ui-book.sf-on .gu-prompt, .ui-book.sf-on .gb-dialogue,
.ui-book.sf-on .marks, .ui-book.sf-on .st-gift, .ui-book.sf-on .ui-playtest, .ui-book.sf-on .ui-experiment { visibility: hidden; }
@container gu (width < 560px) {
  .sf-bar { height: 88px; }
}
`;

/** One puppet: a sprite for each sheet it is drawn from, made the first time it is needed. */
interface Puppet {
  handles: Map<string, SpriteHandle>;
  shown: SpriteHandle | null;
}

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root, assets } = view;
  const sys = game.systems as Partial<Systems>;
  const camp = campOf(view);
  addStyle(root, 'story-cutscene', STYLE);
  const params = new URLSearchParams(location.search);
  const holdAt = params.has('cut-at') ? Number(params.get('cut-at')) : null;
  const holding = holdAt !== null && Number.isFinite(holdAt);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- the page
  const cinema = document.createElement('div');
  cinema.className = 'sf-cinema';
  cinema.dataset.key = 'film';
  cinema.hidden = true;
  cinema.innerHTML = /* html */ `
    <div class="sf-veil"></div>
    <div class="sf-bar sf-bar-top"><button class="sf-skip" type="button" data-key="film:skip">Skip <kbd>Esc</kbd></button></div>
    <div class="sf-bar sf-bar-bottom"><p class="sf-line" aria-live="polite"></p></div>`;
  root.append(cinema);
  const line = cinema.querySelector<HTMLElement>('.sf-line')!;
  const skipButton = cinema.querySelector<HTMLButtonElement>('.sf-skip')!;

  // ---- what is playing
  let run: FilmRun | null = null;
  let frame: FilmFrame | null = null;
  /** A film whose flag was set in this step of the rules. It starts on the next frame. */
  let pending: Film | null = null;
  let puppets: Puppet[] = [];
  /** Each actor of the rules the film hid, and whether it was shown before. */
  const hidden = new Map<string, boolean>();
  let shownText = '';
  let cuesPlayed = -1;
  let sound: FilmSound | null = null;
  const held: HeldFire = { light: 1, low: false, sound: 0 };
  /** The player's own ambience and music volumes, and how the film leaves them as it ends. */
  const volume = { ambience: 1, music: 1 };
  let after = 0, afterFor = 0, afterWorld = 1, afterMusic = 1;
  /** Puppets kept on after the film until the rules have their actors in the world. */
  let linger = 0;

  function skip(): void {
    if (!run || run.skipped || run.done) return;
    run.skip();
    game.events.emit('ui.sound', { sound: 'click' });
  }
  skipButton.addEventListener('click', skip);

  /** The flag of a film is set in play: the rules stand still from this step, and the film starts on the next frame. */
  function cue(film: Film): void {
    pending = film;
    game.flags.set(filmFlag(film), true);
    view.setPaused(PAUSE, true);
  }

  game.events.on('flag.changed', ({ flag, value }) => {
    // A save being loaded is not play, and an online world's rules are the server's.
    if (!value || run || pending || !view.started || view.online) return;
    for (const film of FILMS) {
      if (film.trigger.flag !== flag) continue;
      const near = placeAt(game, film.trigger.near);
      if (!near) continue;
      const far = Math.hypot(game.player.pos.x - near.x, game.player.pos.z - near.z);
      if (startsFilm(film, flag, { flags: game.flags, inPlay: true, near: far })) {
        cue(film);
        return;
      }
    }
  });

  function begin(film: Film): void {
    pending = null;
    const cut: Cut | null = resolveFilm(film, (name) => placeAt(game, name));
    if (!cut) {
      // A region without the film's places plays nothing, and the rules go on.
      view.setPaused(PAUSE, false);
      return;
    }
    run = createFilm(cut);
    frame = newFrame(cut);
    cuesPlayed = -1;
    shownText = '';
    line.textContent = '';
    cinema.hidden = false;
    root.classList.add('sf-on');
    showBeam(false);
    game.player.busy = true;
    skipButton.focus({ preventScroll: true });
    // Under the first black, the player goes where the film leaves them.
    const land = cut.land.player;
    if (land) window.__game?.teleport(land.x, land.y, land.z, land.facing);
    puppets = cut.puppets.map(() => ({ handles: new Map(), shown: null }));
    hidden.clear();
    linger = 0;
    volume.ambience = view.settings.volume('ambience');
    volume.music = view.settings.volume('music');
    after = 0;
    if (view.audio) startSound();
  }

  function startSound(): void {
    const audio = view.audio;
    if (!audio || sound || !run) return;
    sound = createFilmSound(audio.context, audio.effectsInput);
  }
  view.onAudio(() => startSound());

  function end(): void {
    if (!run || !frame) return;
    const film = run.cut.film;
    run = null;
    cinema.hidden = true;
    root.classList.remove('sf-on');
    showBeam(true);
    if (document.activeElement === skipButton) skipButton.blur();
    sound?.stop();
    sound = null;
    camp.held = null;
    // The night comes back to the player's volume over a few seconds.
    after = afterFor = film.sound.after;
    afterWorld = frame.world;
    afterMusic = frame.music;
    // The actors of the rules are shown again, and the puppets go as soon as each one is in the world.
    for (const [actor, visible] of hidden) {
      const a = game.actors.get(actor);
      if (a) a.visible = visible;
    }
    linger = LINGER;
    view.setPaused(PAUSE, false);
    book.settle();
  }

  // ---- every key and the wheel are the film's. Esc skips. In the capture phase, so the panels, the pause menu
  // and the game's keys never see them.
  window.addEventListener('keydown', (event) => {
    if (!run) return;
    if (event.code === 'Escape' && !event.repeat) skip();
    if (document.activeElement === skipButton && (event.code === 'Enter' || event.code === 'Space' || event.code === 'NumpadEnter')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('wheel', (event) => {
    if (!run) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  /** The quest's beam of light is the game's, not the film's. It is a material of the map feature's, so it is hidden there. */
  function showBeam(shown: boolean): void {
    const beam = view.scene.getObjectByName('waypoint-beam') as THREE.Mesh | undefined;
    if (beam) (beam.material as THREE.Material).visible = shown;
  }

  // ---- the puppets
  /** The pose drawn for a pose wanted: itself when the manifest has its sprite and animation, else what stands in. */
  const drawn = new Map<PuppetPose, Pose>();
  const hasAnim = (pose: Pose): boolean => assets.hasSprite(pose.sprite) && pose.anim in assets.sprite(pose.sprite).animations;
  function drawnPose(pose: PuppetPose): Pose {
    let use = drawn.get(pose);
    if (!use) drawn.set(pose, (use = hasAnim(pose) ? pose : pose.or));
    return use;
  }

  function drawPuppets(f: FilmFrame): void {
    for (let i = 0; i < f.puppets.length; i++) {
      const p = f.puppets[i], puppet = puppets[i], pose = drawnPose(p.pose);
      let handle = puppet.handles.get(pose.sprite);
      if (!handle) {
        handle = view.sprites.add(pose.sprite, { x: p.x, y: p.y, z: p.z, facing: p.facing, animation: pose.anim, visible: false });
        puppet.handles.set(pose.sprite, handle);
      }
      if (puppet.shown !== handle) {
        puppet.shown?.setVisible(false);
        puppet.shown = handle;
      }
      handle.setVisible(p.visible);
      handle.setPosition(p.x, p.y + view.liftOnLand(p.x, p.y, p.z), p.z);
      handle.setFacing(p.facing);
      // Every frame of the drawing comes from the film's time too: a walk from the ground covered, the rest from
      // the seconds since the pose began. So a held moment always shows the same drawing.
      const anim = assets.hasSprite(pose.sprite) ? assets.sprite(pose.sprite).animations[pose.anim] : undefined;
      const loop = anim ? anim.frames / anim.fps : 1;
      const phase = pose.stride && p.walked >= 0 ? (p.walked / pose.stride) % 1 : pose.once ? Math.min(1, p.since / loop) : (p.since / loop) % 1;
      handle.play(pose.anim, { loop: !pose.once, restart: true, phase });
    }
  }

  function dropPuppets(): void {
    for (const puppet of puppets) for (const handle of puppet.handles.values()) handle.remove();
    puppets = [];
  }

  /** Hides the actor of the rules each puppet stands for. The rules may put one in the world while the film plays. */
  function hideActors(f: FilmFrame): void {
    for (const p of f.puppets) {
      const actor = game.actors.get(p.actor);
      if (!actor) continue;
      if (!hidden.has(p.actor)) hidden.set(p.actor, actor.visible);
      actor.visible = false;
    }
  }

  // ---- the camera
  const lens = view.ctx.camera as THREE.PerspectiveCamera;
  const rigPos = new THREE.Vector3(), rigLook = new THREE.Vector3(), rigDir = new THREE.Vector3();
  const look = new THREE.Vector3();

  function aim(f: FilmFrame): void {
    // The game's camera has placed the lens for this frame already: that is where the last shot ends.
    rigPos.copy(lens.position);
    lens.getWorldDirection(rigDir);
    const hero = view.playerPosition;
    const reach = Math.max(1, Math.hypot(rigPos.x - hero.x, rigPos.y - hero.y, rigPos.z - hero.z));
    rigLook.copy(rigPos).addScaledVector(rigDir, reach);
    const rigFov = lens.fov, rigNear = lens.near;
    const k = f.land;
    lens.position.set(f.lens.x, f.lens.y, f.lens.z).lerp(rigPos, k);
    look.set(f.lens.lookX, f.lens.lookY, f.lens.lookZ).lerp(rigLook, k);
    lens.lookAt(look);
    lens.fov = f.lens.fov + (rigFov - f.lens.fov) * k;
    lens.near = NEAR + (rigNear - NEAR) * k;
    lens.far = Math.max(lens.far, 400);
    lens.updateProjectionMatrix();
  }

  // ---- `?scene=` and the experiment badge: a game set up for a film's scene
  /** The film the address or a click asked for, until its game is running and set up. */
  let wanted: Film | null = filmForScene(FILMS, params.get('scene'));
  let starting = false;

  function setUp(film: Film): void {
    const door = window.__game, stand = placeAt(game, film.setup.stand), at = placeAt(game, film.place);
    if (!door || !stand || !at) return;
    door.skipTo(film.setup.quest);
    door.teleport(film.setup.stand, undefined, undefined, facingTo(stand.x, stand.z, at.x, at.z));
    door.setTime(film.setup.timeOfDay);
    // A film is shot in clear weather.
    sys.time?.setWeather('clear', true);
  }

  setStage(view, {
    get playing() { return run !== null || pending !== null; },
    play(scene) {
      const film = filmForScene(FILMS, scene);
      if (!film || run || pending || view.online) return false;
      if (!view.started) {
        wanted = film;
        starting = true;
        view.newGame();
        return true;
      }
      game.flags.set(filmFlag(film), false);
      setUp(film);
      // Its flag already set in this game: the rules will not set it again, so the film is played as it stands.
      if (game.flags.is(film.trigger.flag)) cue(film);
      return true;
    },
  });

  // ---- each frame
  view.onFrame((dt) => {
    if (wanted) {
      if (!view.started) {
        // The title holds the start. A scene goes straight in: on to its own save when the film has played in it,
        // else into a new game set up for it.
        if (!starting) {
          starting = true;
          const save = readSave();
          const seen = save?.game.flags.some(([flag, value]) => flag === filmFlag(wanted!) && Boolean(value)) ?? false;
          if (!(seen && view.continueGame())) view.newGame();
        }
        return;
      }
      const film = wanted;
      wanted = null;
      starting = false;
      if (!game.flags.is(filmFlag(film))) setUp(film);
    }
    if (pending && !run) begin(pending);

    // After the film: the night comes back up, and the puppets go once the rules have drawn their actors.
    if (!run) {
      if (after > 0) {
        after = Math.max(0, after - dt);
        const k = 1 - after / afterFor, audio = view.audio;
        audio?.setVolume('ambience', volume.ambience * (afterWorld + (1 - afterWorld) * k));
        audio?.setVolume('music', volume.music * (afterMusic + (1 - afterMusic) * k));
      }
      if (linger > 0) {
        linger -= dt;
        let all = true;
        for (const [actor] of hidden) if (!game.actors.has(actor)) all = false;
        for (const p of frame?.puppets ?? []) if (!game.actors.has(p.actor)) all = false;
        if (all || linger <= 0) {
          linger = 0;
          dropPuppets();
        }
      }
      return;
    }

    game.player.busy = true;
    if (holding && !run.skipped) run.seek(holdAt);
    else run.advance(dt);
    const f = run.frame(frame!, { still: reduced || view.settings.graphics.reduceMotion });

    hideActors(f);
    drawPuppets(f);
    aim(f);

    // The hour and the fire, held as the film says.
    sys.time?.setTimeOfDay(f.timeOfDay);
    held.light = f.fire;
    held.low = f.fireLow;
    held.sound = f.fireSound;
    camp.held = held;

    // The sound: the player's ambience and music under the film, the held note, and each cue as its moment comes.
    const audio = view.audio;
    if (audio) {
      audio.setVolume('ambience', volume.ambience * f.world);
      audio.setVolume('music', volume.music * f.music);
    }
    if (cuesPlayed < 0) cuesPlayed = f.cues;
    const cues = run.cut.film.sound.cues;
    while (cuesPlayed < f.cues) sound?.cue(cues[cuesPlayed++].cue);
    sound?.setNote(f.note);

    if (f.text !== shownText) {
      shownText = f.text;
      line.textContent = f.text;
    }
    cinema.style.setProperty('--sf-black', f.black.toFixed(3));
    cinema.style.setProperty('--sf-bars', f.bars.toFixed(3));
    cinema.style.setProperty('--sf-words', f.words.toFixed(3));
    if (run.done) end();
  });
}
