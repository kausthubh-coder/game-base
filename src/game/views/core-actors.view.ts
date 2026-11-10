// Draws everyone: copies `game.actors` to sprites every frame, and floats each actor's mark (a quest
// mark, a heart, a zzz) over its head as a small HTML element.
//
// To restyle a mark from another view, override `.mark` and `.mark-<kind>` in your own style sheet.
import type { Actor } from '../api.sim.ts';
import { createActorSprites, spriteHeight } from '../shell/art.ts';
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
`;

interface Badge {
  element: HTMLElement;
  mark: Mark;
  seen: number;
}

export function install(view: GameView): void {
  const actors = createActorSprites(view.sprites);

  const style = document.createElement('style');
  style.textContent = STYLE;
  const layer = document.createElement('div');
  layer.className = 'marks';
  layer.setAttribute('aria-hidden', 'true');
  view.root.append(style, layer);

  const badges = new Map<string, Badge>();
  const heights = new Map<string, number>();
  const point: ScreenPoint = { x: 0, y: 0 };
  let pass = 0;

  function heightOf(sprite: string): number {
    let height = heights.get(sprite);
    if (height === undefined) heights.set(sprite, (height = spriteHeight(view.assets, sprite)));
    return height;
  }

  view.onFrame((dt) => {
    actors.sync(view.game.actors, dt);

    pass++;
    for (const actor of view.game.actors.values()) {
      const mark = actor.mark ?? '';
      if (mark === '' || !actor.visible) continue;
      const at = actors.drawnAt(actor.id) ?? actor.pos;
      const on = view.project(at.x, at.y + heightOf(actor.sprite) + 0.15, at.z, point);
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
  });
}
