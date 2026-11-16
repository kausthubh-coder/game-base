import { touchDevice, type Press } from '../shell/keys.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';
import { stick, touchPointer } from './touch-controls.ts';

const STYLE = /* css */ `
.ui-book .ui-touch { position:absolute; inset:0; pointer-events:none; z-index:12; }
.ui-book .ui-touch[hidden] { display:none; }
.ui-book .ui-touch button { pointer-events:auto; touch-action:none; min-width:44px; min-height:44px;
  border:1px solid var(--ui-gold); border-radius:999px; color:var(--ui-paper); background:var(--ui-glass);
  font:700 12px Nunito,sans-serif; text-shadow:0 1px 3px var(--ui-night); padding:8px; }
.ui-book .ui-touch button:active { background:var(--ui-navy); border-color:var(--ui-gold-bright); }
.ui-book .ui-touch-nav { position:absolute; top:max(136px,env(safe-area-inset-top)); left:max(16px,env(safe-area-inset-left)); display:flex; gap:6px; }
.ui-book .ui-touch-stick { position:absolute; left:max(16px,env(safe-area-inset-left)); bottom:max(150px,calc(env(safe-area-inset-bottom) + 140px));
  width:108px; height:108px; padding:0; background:var(--ui-glass); }
.ui-book .ui-touch-stick span { display:block; margin:auto; width:40px; height:40px; border-radius:50%; border:1px solid var(--ui-gold); background:var(--ui-navy); pointer-events:none; }
.ui-book .ui-touch-actions { position:absolute; right:max(12px,env(safe-area-inset-right)); bottom:max(150px,calc(env(safe-area-inset-bottom) + 140px)); display:grid; grid-template-columns:repeat(3,48px); gap:6px; }
.ui-book .ui-touch-tools { position:absolute; right:max(12px,env(safe-area-inset-right)); top:max(190px,calc(env(safe-area-inset-top) + 180px)); display:flex; gap:6px; flex-wrap:wrap; max-width:190px; justify-content:flex-end; }
.ui-book .ui-touch-tools[hidden] { display:none; }
.ui-book .ui-touch.is-tools .ui-touch-actions { visibility:hidden; }
.ui-book.ui-touch-enabled:has(.ui-touch.is-tools:not([hidden])) .gb-hud-quest { visibility:hidden; }
.ui-book .ui-touch-aim { position:absolute; color:var(--ui-gold-bright); text-shadow:0 1px 3px var(--ui-night); transform:translate(-50%,-50%); font-size:24px; }
@media (orientation:landscape) and (max-height:540px) {
  .ui-book .ui-touch-stick,.ui-book .ui-touch-actions { bottom:max(20px,env(safe-area-inset-bottom)); }
  .ui-book .ui-touch-tools { top:190px; }
  .ui-book.ui-touch-enabled .gd-coin { left:auto; right:0; top:auto; bottom:100%; margin:0 0 8px; transform:none; }
  .ui-book.ui-touch-enabled .gu-top { width:min(260px,calc(100% - 232px)); }
  .ui-book.ui-touch-enabled .gb-hud-slots { width:calc(100% - 310px); left:calc(50% - 16px); flex-wrap:wrap; box-sizing:border-box; }
}
`;

export function install(view: GameView): void {
  if (!touchDevice()) return;
  const book = bookOf(view), { touch } = view.keys;
  addStyle(view.root, 'touch', STYLE);
  view.root.classList.add('ui-touch-enabled');
  const layer = document.createElement('div');
  layer.className = 'ui-touch';
  layer.hidden = true;
  layer.setAttribute('aria-label', 'Touch controls');
  layer.innerHTML = `<div class="ui-touch-nav"></div><button type="button" class="ui-touch-stick" aria-label="Move" data-touch="move"><span></span></button><div class="ui-touch-actions"></div><div class="ui-touch-tools" hidden></div><span class="ui-touch-aim" aria-hidden="true">⌖</span>`;
  view.root.append(layer);
  const tools = layer.querySelector<HTMLElement>('.ui-touch-tools')!;
  const cancels: (() => void)[] = [];
  const free = () => view.started && !view.paused && !book.covered && !view.game.player.busy && !view.root.classList.contains('st-film-on') && !view.root.classList.contains('st-cinema-on');
  function cancel(): void { touch.cancel(); for (const fn of cancels.splice(0)) fn(); knob.style.transform = ''; }
  // Rebind after cancellation so a finger held across a menu never resumes a world action.
  const binds: (() => () => void)[] = [];
  const bind = (fn: () => () => void) => { binds.push(fn); };
  const knob = layer.querySelector<HTMLElement>('.ui-touch-stick span')!;
  const movement = layer.querySelector<HTMLElement>('.ui-touch-stick')!;
  function move(e: PointerEvent): void {
    if (!free()) return;
    const rect = movement.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    const value = stick(x, y, rect.width / 2);
    touch.move(value.right, value.forward);
    knob.style.transform = `translate(${value.right * 28}px,${-value.forward * 28}px)`;
  }
  bind(() => touchPointer(movement, { start: move, move, end: cancelled => { if (cancelled) cancel(); else { touch.move(0, 0); knob.style.transform = ''; } } }));
  const target = layer.querySelector<HTMLElement>('.ui-touch-aim')!;
  function aim(e: PointerEvent): void {
    const rect = view.canvas.getBoundingClientRect();
    touch.aim((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2);
    const root = view.root.getBoundingClientRect();
    target.style.left = `${e.clientX - root.left}px`;
    target.style.top = `${e.clientY - root.top}px`;
  }
  let x = 0, y = 0;
  const oldAction = view.canvas.style.touchAction;
  view.canvas.style.touchAction = 'none';
  bind(() => touchPointer(view.canvas, {
    start(e) { if (!free()) return; x = e.clientX; y = e.clientY; aim(e); },
    move(e) {
      if (!free()) return;
      if (view.keys.primary) aim(e);
      else touch.look(e.clientX - x, e.clientY - y);
      x = e.clientX; y = e.clientY;
    },
    end(cancelled) { if (cancelled) cancel(); },
  }));
  function button(group: string, name: string, action: () => void, hold?: (down: boolean) => void): void {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = name; element.dataset.touch = name.toLowerCase();
    layer.querySelector(group)!.append(element);
    if (hold) bind(() => touchPointer(element, {
      start() { if (free()) hold(true); },
      end(cancelled) { if (cancelled) cancel(); else hold(false); },
    }));
    else element.addEventListener('click', () => { if (free()) action(); });
  }
  const press = (p: Exclude<Press, { kind: 'letGo' }>) => () => touch.press(p);
  button('.ui-touch-nav', 'Bag', () => { cancel(); book.ui.open('bag'); });
  button('.ui-touch-nav', 'Map', () => { cancel(); book.map?.open(); });
  button('.ui-touch-nav', 'Pause', () => { cancel(); book.ui.open('pause'); });
  button('.ui-touch-nav', 'Tools', () => { cancel(); tools.hidden = !tools.hidden; layer.classList.toggle('is-tools', !tools.hidden); });
  button('.ui-touch-actions', 'Use', () => {}, down => touch.primary(down));
  button('.ui-touch-actions', 'Place', press({ kind: 'use', button: 'secondary' }));
  button('.ui-touch-actions', 'Talk', press({ kind: 'interact' }));
  button('.ui-touch-actions', 'Jump', () => {}, down => touch.jump(down));
  button('.ui-touch-tools', 'Build', press({ kind: 'build' }));
  button('.ui-touch-tools', 'Undo', press({ kind: 'undo' }));
  button('.ui-touch-tools', 'Turn', press({ kind: 'turn', direction: 1 }));
  button('.ui-touch-actions', 'Dodge', press({ kind: 'fight', action: 'dodge' }));
  button('.ui-touch-actions', 'Skill', press({ kind: 'fight', action: 'skill' }));
  button('.ui-touch-actions', 'Calm', () => {}, down => { touch.calm(down); if (down) touch.press({ kind: 'fight', action: 'use' }); });
  button('.ui-touch-tools', 'View', press({ kind: 'camera' }));
  button('.ui-touch-tools', '−', press({ kind: 'zoom', steps: 1 }));
  button('.ui-touch-tools', '+', press({ kind: 'zoom', steps: -1 }));
  book.onPanel(cancel);
  view.game.events.on('talk.started', cancel);
  for (const event of ['blur', 'orientationchange', 'pagehide']) window.addEventListener(event, cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  let visible = false;
  const skillButton = layer.querySelector<HTMLElement>('[data-touch="skill"]')!;
  const calmButton = layer.querySelector<HTMLElement>('[data-touch="calm"]')!;
  view.onFrame(() => {
    const practice = view.game.systems.opening?.bout().on ?? false;
    skillButton.hidden = calmButton.hidden = practice;
    const show = free();
    if (show !== visible) {
      cancel(); visible = show; layer.hidden = !show; tools.hidden = true; layer.classList.remove('is-tools');
      if (show) {
        touch.aim(0, -.25);
        target.style.left = '50%'; target.style.top = '62.5%';
      }
    }
    if (show && cancels.length === 0) for (const fn of binds) cancels.push(fn());
  });
  // The game owns the canvas for its lifetime; restore its prior style when it leaves the page.
  window.addEventListener('pagehide', () => { view.canvas.style.touchAction = oldAction; }, { once: true });
}
