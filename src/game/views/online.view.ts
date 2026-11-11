// An online world on the page: each other player's name over their head, and a line at the top while the
// world is joining, has lost its connection or would not let this player in. Nothing here in solo play.
//
// The others are drawn by core-actors.view.ts like everyone else: the online copy puts them in
// `game.actors` (src/game/online/online.ts). This file only adds what a player has and a person does not.
import { soloAddress } from '../online/join.ts';
import type { OnlineView } from '../online/online.ts';
import { spriteHeight } from '../shell/art.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

const STYLE = /* css */ `
.ol-names { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ol-name { position: absolute; left: 0; top: 0; padding: 2px 8px; transform-origin: 50% 100%; will-change: transform;
  font: 600 13px/1.3 var(--ui-font, ui-sans-serif, system-ui, sans-serif); white-space: nowrap;
  color: oklch(0.97 0.01 88); background: oklch(0.22 0.02 60 / 0.62); border-radius: 6px; }
.ol-notice { position: absolute; top: var(--s4, 16px); left: 50%; translate: -50% 0; max-width: calc(100% - 32px);
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2, 8px) var(--s3, 12px); padding: var(--s2, 8px) var(--s2, 8px) var(--s2, 8px) var(--s4, 16px);
  color: var(--glass-ink, #fff); background: var(--glass, oklch(0.22 0.02 60 / 0.8)); border-radius: var(--radius, 10px);
  box-shadow: var(--glass-shadow, none); font-size: 15px; font-weight: 500; pointer-events: auto; z-index: 30; }
.ol-notice[hidden] { display: none; }
.ol-notice-text { padding: 6px 0; text-wrap: pretty; }
.ol-notice:not(:has(button)) { padding-right: var(--s4, 16px); }
`;

/** How far over the head the name floats, in blocks. */
const OVER_HEAD = 0.1;

export function install(view: GameView): void {
  const online = view.online;
  if (!online) return;
  const book = bookOf(view);
  addStyle(view.root, 'online', STYLE);

  const names = document.createElement('div');
  names.className = 'ol-names';
  names.setAttribute('aria-hidden', 'true');
  view.root.append(names);

  // In the interface's own layer, so it takes its colors and its buttons.
  const notice = document.createElement('div');
  notice.className = 'ol-notice';
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  (view.root.querySelector('.gu-root') ?? view.root).append(notice);

  const button = (label: string, primary: boolean, onclick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = primary ? 'gu-btn gu-primary' : 'gu-btn';
    b.textContent = label;
    b.addEventListener('click', onclick);
    return b;
  };
  const solo = (): HTMLButtonElement => button('Play solo', false, () => location.assign(soloAddress(location.href)));

  function show(o: OnlineView): void {
    const text = document.createElement('span');
    text.className = 'ol-notice-text';
    const parts: Node[] = [text];
    switch (o.status) {
      case 'playing':
        notice.hidden = true;
        return;
      case 'signin':
        text.textContent = 'Sign in to join this world.';
        parts.push(button('Sign in', true, () => book.ui.open('account')), solo());
        break;
      case 'connecting':
        text.textContent = 'Joining the world…';
        break;
      case 'reconnecting':
        text.textContent = 'The connection dropped. Joining again…';
        break;
      case 'refused':
        text.textContent = o.refusal?.text ?? 'The world would not let you in.';
        if (o.refusal?.why === 'reload') parts.push(button('Reload', true, () => location.reload()));
        if (o.refusal?.why === 'token') parts.push(button('Sign in', true, () => book.ui.open('account')));
        parts.push(solo());
        break;
      case 'closed':
        text.textContent = 'This world is open in another tab.';
        parts.push(solo());
        break;
    }
    notice.replaceChildren(...parts);
    notice.hidden = false;
  }
  online.onChange(() => show(online));
  show(online);

  const over = spriteHeight(view.assets, 'hero') + OVER_HEAD;
  const labels = new Map<string, { element: HTMLElement; seen: number }>();
  const point: ScreenPoint = { x: 0, y: 0 };
  let pass = 0;
  view.onFrame(() => {
    pass++;
    for (const player of online.players()) {
      if (!player.name) continue;
      const on = view.project(player.at.x, player.at.y + over, player.at.z, point);
      if (!on) continue;
      let label = labels.get(player.id);
      if (!label) {
        label = { element: document.createElement('div'), seen: 0 };
        label.element.className = 'ol-name';
        names.append(label.element);
        labels.set(player.id, label);
      }
      if (label.element.textContent !== player.name) label.element.textContent = player.name;
      label.seen = pass;
      label.element.style.transform = `translate(${Math.round(on.x)}px, ${Math.round(on.y)}px) translate(-50%, -100%)`;
    }
    for (const [id, label] of labels) {
      if (label.seen === pass) continue;
      label.element.remove();
      labels.delete(id);
    }
  });
}
