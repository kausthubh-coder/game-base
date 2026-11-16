// The opening film: on a new game begun from the title, before the player can move, the painted-layers cut that
// Kausthubh picked (handbook chapter 29, `demos/opening`: the cut-out renderer, the eleven shots timed to Hobb's
// lines, the score and the effects). It ends on the guild's door, and the hero wakes behind it, in the bunk room
// at Saltgate. It plays once a game, by the flag `story.opening`, and never on Continue.
//
// The world loads behind it: the hero is set down in the bunk room the moment the film begins, the rules wait,
// and the film's art comes in shot by shot, its first two before it starts and the rest while it plays. A shot
// whose pictures are not in yet holds the film, and the sound with it, until they are.
//
// Any key or press shows "Hold to skip"; holding it a second skips. Once this browser has seen the film, one
// press skips. The Skip pill skips when clicked. Every key and the wheel are the film's while it plays.
//
// `?opening-at=<seconds>` holds the film at that moment, for screenshots.
import titleArt from '../../../demos/opening/art/title.webp?url';
import type { CreateRenderer, Film, FilmRenderer, Soundtrack } from '../../../demos/opening/types.ts';
import { FLAG } from '../content/flags.ts';
import { SPOTS } from '../content/saltgate.ts';
import { saltgateAt } from '../opening/land.sim.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { playsOpening, takeNewGame } from '../uiview/opening.ts';
import { addStyle } from '../uiview/theme.ts';

/** Seconds a press is held to skip. */
const HOLD = 1;
/** Seconds the film takes to fade into the bunk room at its end. */
const FADE_OUT = 1.2;
/** Seconds after the last key or move that the skip pill stays up. */
const PILL = 3;
/** This browser has watched the film once: one press skips it after that. */
const SEEN_KEY = 'greenhollow.film.seen';
/** Chunks made at once round the bunk, each way, so the rules never see a hole when the film ends. */
const LOAD_REACH = 3;

const STYLE = /* css */ `
/* The title is the film's last picture: the guild's door on grant morning, the door the hero walks out of. */
.ui-book .gu-art-title .gu-stage-title, .ui-book.ui-unstarted .gu-art-title .gu-stage-settings { --gu-title-art: url("${titleArt}"); image-rendering: auto; }
.st-film { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; background: #000; pointer-events: auto; cursor: default; opacity: 1; transition: opacity ${FADE_OUT}s ease-in; }
.st-film[hidden] { display: none; }
.st-film.st-out { opacity: 0; pointer-events: none; }
.st-film-stage { position: relative; width: min(100%, 100cqh * 16 / 9); aspect-ratio: 16 / 9; overflow: hidden; container-type: inline-size; }
.ui-book .st-film-stage { width: min(100%, calc(100vh * 16 / 9)); }
.st-film-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.st-film-say {
  position: absolute; left: 50%; bottom: 7%; z-index: 3; width: min(80%, 34em); margin: 0; transform: translate(-50%, 10px);
  font: 700 clamp(14px, 2.15cqw, 30px) / 1.42 var(--ui-font); color: var(--ui-glass-ink); text-align: center; text-wrap: balance;
  text-shadow: 0 1px 2px rgb(10 12 20 / 0.95), 0 0 14px rgb(10 12 20 / 0.7);
  opacity: 0; transition: opacity 200ms ease-out, transform 0s 200ms; pointer-events: none;
}
.st-film-say.on { opacity: 1; transform: translate(-50%, 0); transition: transform 220ms var(--ui-ease); }
.st-film-say.cut { transition: none; }
.st-film-title { position: absolute; left: 8%; top: 11%; z-index: 3; margin: 0; display: grid; gap: 0.5em; pointer-events: none; opacity: 0; transform: translateY(10px); transition: opacity 200ms ease-out, transform 0s 200ms; }
.st-film-title.on { opacity: 1; transform: none; transition: transform 900ms var(--ui-ease); }
.st-film-title::before { content: ''; position: absolute; inset: -45% -35% -40% -30%; z-index: -1; background: radial-gradient(closest-side, rgb(10 12 20 / 0.5), rgb(10 12 20 / 0)); }
.st-film-title small { display: flex; align-items: center; gap: 0.7em; font: 800 clamp(11px, 1.4cqw, 20px) / 1 var(--ui-font); letter-spacing: 0.32em; text-transform: uppercase; color: var(--ui-gold-bright); text-shadow: 0 1px 2px rgb(10 12 20 / 0.9); }
.st-film-title small::before { content: ''; width: 0.55em; height: 0.55em; background: var(--ui-gold-bright); transform: rotate(45deg); box-shadow: 0 0 8px rgb(240 212 138 / 0.7); }
.st-film-title b { position: relative; padding-bottom: 0.18em; font: 650 clamp(28px, 6.4cqw, 96px) / 1 var(--ui-display); letter-spacing: -0.01em; color: var(--ui-paper-light); text-shadow: 0 2px 4px rgb(10 12 20 / 0.6), 0 0 30px rgb(10 12 20 / 0.5); }
.st-film-title b::after { content: ''; position: absolute; left: 0; bottom: 0; width: 70%; height: max(2px, 0.03em); background: linear-gradient(90deg, var(--ui-gold-bright), rgb(240 212 138 / 0)); transform-origin: left; transform: scaleX(0); transition: transform 0s 200ms; }
.st-film-title.on b::after { transform: none; transition: transform 1200ms 300ms var(--ui-ease); }
.st-film-skip {
  position: absolute; right: clamp(16px, 3vw, 40px); bottom: clamp(16px, 3vw, 40px); z-index: 4;
  display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 18px 6px 8px;
  font: 700 15px / 1 var(--ui-font); color: var(--ui-glass-ink); background: var(--ui-glass); border: 0; border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--ui-glass-line), var(--ui-glass-shadow); cursor: pointer;
  opacity: 0; transition: opacity 300ms ease-out;
}
/* Faded until a key, a press or the pointer near it shows it; a click on it skips at once. */
.st-film-skip.on, .st-film-skip:hover, .st-film-skip:focus-visible { opacity: 1; }
.st-film-skip:hover { background: rgb(22 26 38 / 0.78); }
.st-film-skip:focus-visible { outline: 2px solid var(--ui-gold-bright); outline-offset: 3px; }
.st-film-ring { width: 26px; height: 26px; transform: rotate(-90deg); }
.st-film-ring circle { fill: none; stroke-width: 2.5; }
.st-film-ring circle:first-child { stroke: rgb(246 241 231 / 0.25); }
.st-film-ring .fill { stroke: var(--ui-gold-bright); stroke-dasharray: 100; stroke-dashoffset: 100; stroke-linecap: round; }
.st-film-wait { position: absolute; left: 50%; top: 50%; z-index: 2; width: 10px; height: 10px; margin: -5px; background: var(--ui-gold-bright); transform: rotate(45deg); opacity: 0; transition: opacity 300ms; box-shadow: 0 0 12px rgb(240 212 138 / 0.7); }
.st-film-wait.on { opacity: 0.85; animation: st-film-pulse 1.2s ease-in-out infinite alternate; }
@keyframes st-film-pulse { from { opacity: 0.3; } to { opacity: 0.9; } }
/* The HUD and everything over the world step out while the film plays. */
.ui-book.st-film-on .gb-hud, .ui-book.st-film-on .gb-beacon, .ui-book.st-film-on .gu-top, .ui-book.st-film-on .gu-toasts,
.ui-book.st-film-on .gu-prompt, .ui-book.st-film-on .gb-dialogue, .ui-book.st-film-on .marks { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { .st-film-say, .st-film-title, .st-film-title b::after { transition: none; } .st-film-wait.on { animation: none; } }
`;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

function seenBefore(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* no storage: it asks for a hold next time too */ }
}

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  addStyle(root, 'story-opening', STYLE);
  const params = new URLSearchParams(location.search);
  const holdAt = params.has('opening-at') ? Number(params.get('opening-at')) : null;

  // ---- the page
  const box = document.createElement('div');
  box.className = 'st-film';
  box.hidden = true;
  box.innerHTML = /* html */ `
    <div class="st-film-stage">
      <span class="st-film-wait"></span>
      <p class="st-film-title"><small></small><b></b></p>
      <p class="st-film-say" aria-live="polite"></p>
    </div>
    <button class="st-film-skip" type="button" data-key="opening:skip"><svg class="st-film-ring" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10.5" pathLength="100"/><circle class="fill" cx="13" cy="13" r="10.5" pathLength="100"/></svg><span>Hold to skip</span></button>`;
  root.append(box);
  const stage = box.querySelector<HTMLElement>('.st-film-stage')!;
  const say = box.querySelector<HTMLElement>('.st-film-say')!;
  const title = box.querySelector<HTMLElement>('.st-film-title')!;
  const wait = box.querySelector<HTMLElement>('.st-film-wait')!;
  const skipButton = box.querySelector<HTMLButtonElement>('.st-film-skip')!;
  const skipWords = skipButton.querySelector('span')!;
  const ring = skipButton.querySelector<SVGCircleElement>('.fill')!;

  let film: Film | null = null;
  let renderer: FilmRenderer | null = null;
  let sound: Soundtrack | null = null;
  let titleCard: { shot: string; beat: string } | null = null;
  let running = false, playing = false, waiting = false, ending = false;
  let t = 0, held = -1, lastInput = -Infinity, now = 0;
  let oneTap = false;
  let openingId = 0;

  /** Sets the hero down in the bunk room under the painted wall, and makes the land round it, while the film plays. */
  function wakeInSaltgate(): void {
    const bunk = saltgateAt(SPOTS.bunk.x, SPOTS.bunk.z);
    const cx = Math.floor(bunk.x) >> 4, cz = Math.floor(bunk.z) >> 4;
    for (let dx = -LOAD_REACH; dx <= LOAD_REACH; dx++) for (let dz = -LOAD_REACH; dz <= LOAD_REACH; dz++) view.world.sim.load(cx + dx, cz + dz);
    view.hero.teleport(bunk.x, bunk.y, bunk.z, SPOTS.bunk.facing);
    // The rules are paused, so nothing else moves the drawn hero: the land loads round where it is drawn.
    view.hero.blend(1);
    view.camera.follow(bunk.x, bunk.y, bunk.z);
    view.camera.snap();
    view.world.setFocus(bunk.x, bunk.z);
  }

  async function begin(): Promise<void> {
    if (running && !ending) end();
    const id = ++openingId;
    const current = (): boolean => id === openingId && running && !ending;
    sound = null;
    renderer = null;
    film = null;
    running = true;
    playing = waiting = ending = false;
    t = 0;
    view.setAudioMuted('opening', true);
    try {
      oneTap = seenBefore();
      skipWords.textContent = oneTap ? 'Skip' : 'Hold to skip';
      box.hidden = false;
      box.classList.remove('st-out');
      root.classList.add('st-film-on');
      view.setPaused('opening', true);
      game.player.busy = true;
      wakeInSaltgate();
      wait.classList.add('on');
      // The film's code and art load only now, after Begin: none of it is in the game's first load.
      const [{ makeFilm, TITLE }, { create }, { createSoundtrack, VOICES }] = await Promise.all([
        import('../../../demos/opening/film.ts'),
        import('../../../demos/opening/cutout/index.ts') as Promise<{ create: CreateRenderer }>,
        import('../../../demos/opening/sound/index.ts'),
      ]);
      if (!current()) return;
      // Hobb's first take until Kausthubh picks one (docs/opening-lab.md).
      const track = await createSoundtrack({ voice: VOICES[0].id, volume: view.settings.volume('master') });
      if (!current()) { track.dispose(); return; }
      sound = track;
      film = makeFilm(track.voiceSeconds);
      titleCard = { shot: TITLE.shot, beat: TITLE.beat };
      (title.querySelector('small') as HTMLElement).textContent = TITLE.eyebrow;
      (title.querySelector('b') as HTMLElement).textContent = TITLE.name;
      const cut = renderer = create(film, { quality: view.ctx.quality });
      stage.prepend(cut.canvas);
      try {
        await cut.load(film.shots.slice(0, 2));
      } finally {
        // Loading may finish after Skip's cleanup. Drop pictures it added after disposal too.
        if (id !== openingId || !running) cut.dispose();
      }
      if (!current()) return;
      // The rest comes in while the first shots play.
      void cut.load(film.shots)
        .catch((error) => {
          if (!current()) return;
          console.warn('[opening] the film\'s art did not all load:', error);
          end(id);
        })
        .finally(() => { if (id !== openingId || !running) cut.dispose(); });
      wait.classList.remove('on');
      playing = true;
      if (holdAt === null) sound.play(film, 0);
    } catch (error) {
      if (!current()) return;
      // No film: the game goes on without it, from the bunk room.
      console.error('[opening] the film could not play:', error);
      end(id);
    }
  }

  /** The film is over, played or skipped: it fades into the bunk room, and grant day begins. */
  function end(id = openingId): void {
    if (id !== openingId || !running || ending) return;
    ending = true;
    playing = false;
    const track = sound, cut = renderer;
    // Keep the world quiet through the soundtrack's stop tail and the picture's fade.
    // Schedule cleanup before any scene callback can throw.
    window.setTimeout(() => {
      try {
        track?.dispose();
      } finally {
        try {
          cut?.dispose();
          cut?.canvas.remove();
        } finally {
          if (id === openingId) {
            running = false;
            box.hidden = true;
            root.classList.remove('st-film-on');
            renderer = null;
            sound = null;
            film = null;
            view.setAudioMuted('opening', false);
          }
        }
      }
    }, FADE_OUT * 1000);
    try {
      track?.stop();
      markSeen();
      if (game.systems.opening) game.systems.opening.filmDone();
      else game.flags.set(FLAG.opening, true);
      box.classList.add('st-out');
      skipButton.classList.remove('on');
      say.classList.remove('on');
      title.classList.remove('on');
    } finally {
      view.setPaused('opening', false);
      game.player.busy = false;
      book.settle();
    }
  }

  book.onStart((fresh) => {
    const chosen = takeNewGame();
    if (playsOpening({ fresh, chosen, flags: game.flags })) void begin();
  });

  // ---- skipping: hold anything for a second, or once this browser has seen the film, press once
  function press(): void {
    if (!running || ending) return;
    lastInput = now;
    if (oneTap) return end();
    if (held < 0) held = now;
  }
  function letGo(): void {
    held = -1;
    ring.style.strokeDashoffset = '100';
  }
  skipButton.addEventListener('click', (event) => {
    event.stopPropagation();
    end();
  });
  box.addEventListener('pointerdown', (event) => {
    if ((event.target as Element).closest('button')) return;
    press();
  });
  window.addEventListener('pointerup', letGo);
  window.addEventListener('pointercancel', letGo);
  box.addEventListener('pointermove', () => { lastInput = now; }, { passive: true });

  // Every key and the wheel are the film's. In the capture phase, so the pause menu and the game never see them.
  window.addEventListener('keydown', (event) => {
    if (!running) return;
    if (document.activeElement === skipButton && (event.code === 'Enter' || event.code === 'Space')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat && !event.metaKey && !event.ctrlKey) press();
  }, { capture: true });
  window.addEventListener('keyup', (event) => {
    if (!running) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    letGo();
  }, { capture: true });
  window.addEventListener('wheel', (event) => {
    if (!running) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  // ---- the frame
  view.onFrame((dt) => {
    now += dt;
    if (!running || ending) return;
    game.player.busy = true;
    if (held >= 0) {
      const p = clamp01((now - held) / HOLD);
      ring.style.strokeDashoffset = String(100 - p * 100);
      if (p >= 1) { letGo(); end(); return; }
    }
    skipButton.classList.toggle('on', now - lastInput < PILL || held >= 0);
    if (!film || !renderer || !sound) return;

    // The clock, held at a shot whose pictures are not in yet.
    if (holdAt !== null && Number.isFinite(holdAt)) t = Math.min(holdAt, film.length - 0.01);
    else if (playing) {
      const next = film.shots.find((s) => s.at > t);
      const ready = !next || !renderer.ready || renderer.ready(next.id);
      if (!ready && t + dt >= next.at) {
        if (!waiting) { waiting = true; sound.stop(); wait.classList.add('on'); }
      } else {
        if (waiting) { waiting = false; sound.play(film, t); wait.classList.remove('on'); }
        t += dt;
      }
    }
    if (t >= film.length) { end(); return; }
    try {
      renderer.draw(t);
    } catch (error) {
      console.error('[opening] the film could not draw:', error);
      end();
      return;
    }

    // Hobb's line under the picture, and the act's title over the last shot.
    const shot = film.at(t);
    const into = t - shot.at;
    const spoken = sound.voiceSeconds[shot.id];
    if (say.textContent !== shot.say) {
      // A new line cuts in, and the old one is gone at once.
      say.classList.add('cut');
      say.classList.remove('on');
      say.textContent = shot.say;
      void say.offsetWidth;
      say.classList.remove('cut');
    }
    say.classList.toggle('on', into >= film.lead && into < (spoken ? film.lead + spoken + 0.5 : shot.len - 0.8));
    title.classList.toggle('on', !!titleCard && shot.id === titleCard.shot && into >= (shot.beats[titleCard.beat] ?? Infinity));
  });
}
