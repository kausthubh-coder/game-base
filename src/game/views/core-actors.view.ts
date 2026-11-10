// Draws everyone: copies `game.actors` to sprites, or to 3D models when Settings > View > Characters says so,
// every frame, and floats each actor's mark (a quest mark, a heart, a zzz) over its head as a small HTML element.
//
// The models load the first time they are asked for. Until they have, everyone stays a sprite; then everyone
// swaps at once. Switching back and forth after that is instant.
//
// A creature whose Almanac page is still open stands on a soft pale ring that breathes, so a green
// mossling on green grass can be found and watched. The ring goes once its page is complete.
//
// To restyle a mark from another view, override `.mark` and `.mark-<kind>` in your own style sheet.
import type { Actor, Systems } from '../api.sim.ts';
import { createActorSprites, loadCastModels, spriteHeight, type CastModels } from '../shell/art.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';

type Mark = NonNullable<Actor['mark']>;

const GLYPHS: Record<Exclude<Mark, ''>, string> = { quest: '!', talk: '…', heart: '♥', alert: '!', sleep: 'z' };

const STYLE = `
.marks { position: absolute; inset: 0; pointer-events: none; }
.mark { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -26px 0 0 -11px; display: grid; place-items: center;
  font: 700 15px/1 ui-rounded, ui-sans-serif, system-ui, sans-serif; color: #2a2118; background: #f6e7b4;
  border: 2px solid #2a2118; border-radius: 7px; box-shadow: 0 2px 0 rgba(20, 14, 8, 0.45); will-change: transform; }
.mark-quest { background: #ffd24a; }
.mark-talk { background: #f4f1e6; }
.mark-heart { background: #ffd9dc; color: #c8324a; }
.mark-alert { background: #ff8a5c; }
.mark-sleep { background: #cfe0ff; color: #33507a; font-style: italic; }
@media (prefers-reduced-motion: no-preference) {
  .mark-quest, .mark-alert { animation: mark-bob 1.1s ease-in-out infinite; }
}
@keyframes mark-bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }
/* The element is placed by its transform. The ring is drawn and breathes on ::before, because the scale
   property would apply on top of that transform and pull the ring toward the top left of the page. */
.watch-ring { position: absolute; left: 0; top: 0; width: 34px; height: 13px; margin: -7px 0 0 -17px; will-change: transform; }
.watch-ring::before { content: ''; position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid rgba(255, 246, 214, 0.9); background: rgba(255, 246, 214, 0.18);
  box-shadow: 0 0 8px rgba(255, 240, 190, 0.55); }
@media (prefers-reduced-motion: no-preference) {
  .watch-ring::before { animation: watch-breathe 1.6s ease-in-out infinite; }
}
@keyframes watch-breathe { 0%, 100% { opacity: 0.55; scale: 0.9; } 50% { opacity: 1; scale: 1.08; } }
`;

/** The ring's size at each zoom step of the camera, nearest first, so it stays the size of the creature. */
const RING_SCALE = [1, 0.75, 0.55, 0.4];

interface Badge {
  element: HTMLElement;
  mark: Mark;
  seen: number;
}

export async function install(view: GameView): Promise<void> {
  const actors = createActorSprites(view.sprites);
  let models: CastModels | null = null;
  let loading: Promise<CastModels | null> | null = null;

  /** Draws the cast the way the setting says, loading the models the first time. */
  async function apply(): Promise<void> {
    if (view.settings.characters !== 'models') {
      actors.setModels(null);
      return;
    }
    loading ??= loadCastModels(view.ctx, view.sky.sun).catch((error: unknown) => {
      console.warn('The 3D characters did not load, so the sprites stay.', error);
      return null;
    });
    models = await loading;
    // The setting may have changed back while they loaded.
    actors.setModels(view.settings.characters === 'models' ? models : null);
  }
  view.settings.onChange((setting) => {
    if (setting === 'characters') void apply();
  });
  // A page opened with models shows them from the first frame.
  await apply();

  const style = document.createElement('style');
  style.textContent = STYLE;
  const layer = document.createElement('div');
  layer.className = 'marks';
  layer.setAttribute('aria-hidden', 'true');
  view.root.append(style, layer);

  const badges = new Map<string, Badge>();
  const rings = new Map<string, { element: HTMLElement; seen: number }>();
  const sys = view.game.systems as Partial<Systems>;
  /** True while the creature of this actor id has facts on its page still to learn. */
  const unwatched = (id: string): boolean => {
    if (!id.startsWith('creature:')) return false;
    const page = sys.almanac?.page(id.split(':')[1] ?? '');
    return page !== undefined && !page.complete;
  };
  const heights = new Map<string, number>();
  const point: ScreenPoint = { x: 0, y: 0 };
  let pass = 0;

  function heightOf(sprite: string): number {
    let height = heights.get(sprite);
    if (height === undefined) heights.set(sprite, (height = spriteHeight(view.assets, sprite)));
    return height;
  }

  view.onFrame((dt) => {
    const line = sys.talk?.current();
    actors.setSpeaker(line?.npc ? `npc:${line.npc}` : null);
    actors.sync(view.game.actors, dt);
    models?.cast.update(dt, view.ctx);

    pass++;
    for (const actor of view.game.actors.values()) {
      const mark = actor.mark ?? '';
      if (mark === '' || !actor.visible) continue;
      const at = actors.drawnAt(actor.id) ?? actor.pos;
      const on = view.project(at.x, at.y + (actors.markHeight(actor.id) ?? heightOf(actor.sprite)) + 0.15, at.z, point);
      if (!on) continue;
      let badge = badges.get(actor.id);
      if (!badge) {
        badge = { element: document.createElement('div'), mark: '', seen: 0 };
        layer.append(badge.element);
        badges.set(actor.id, badge);
      }
      if (badge.mark !== mark) {
        badge.mark = mark;
        badge.element.className = `mark mark-${mark}`;
        badge.element.textContent = GLYPHS[mark];
      }
      badge.seen = pass;
      badge.element.style.transform = `translate(${Math.round(on.x)}px, ${Math.round(on.y)}px)`;
    }
    for (const [id, badge] of badges) {
      if (badge.seen === pass) continue;
      badge.element.remove();
      badges.delete(id);
    }

    for (const actor of view.game.actors.values()) {
      if (!actor.visible || !unwatched(actor.id)) continue;
      const at = actors.drawnAt(actor.id) ?? actor.pos;
      const on = view.project(at.x, at.y + 0.02, at.z, point);
      if (!on) continue;
      let ring = rings.get(actor.id);
      if (!ring) {
        ring = { element: document.createElement('div'), seen: 0 };
        ring.element.className = 'watch-ring';
        layer.prepend(ring.element);
        rings.set(actor.id, ring);
      }
      ring.seen = pass;
      const size = RING_SCALE[view.camera.zoom] ?? RING_SCALE[RING_SCALE.length - 1];
      ring.element.style.transform = `translate(${Math.round(on.x)}px, ${Math.round(on.y)}px) scale(${size})`;
    }
    for (const [id, ring] of rings) {
      if (ring.seen === pass) continue;
      ring.element.remove();
      rings.delete(id);
    }
  });
}
