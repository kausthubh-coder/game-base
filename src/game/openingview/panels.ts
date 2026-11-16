// Grant day's two panels, in the Gilded Hearth look: the mirror by the bunk, where the hero picks their look,
// and the deed at the grant, where the name they write is their name. Each is a small paper panel in the gold
// frame over the world. The rules are src/game/opening: `asking()` says which is open, `setLook` and `sign` answer.
import lookA from './art/look-a.webp?url';
import lookB from './art/look-b.webp?url';
import lookC from './art/look-c.webp?url';
import lookD from './art/look-d.webp?url';
import type { HeroLook, OpeningApi, OpeningAsk } from '../api.sim.ts';
import { NAME_MAX } from '../opening/index.sim.ts';
import { addStyle } from '../uiview/theme.ts';

/** The hero sheet's four looks (`assets-src/concept/people-home/hero.webp`), as its own pixel mocks show them. */
const LOOKS: readonly { id: HeroLook; art: string; name: string; about: string }[] = [
  { id: 'a', art: lookA, name: 'Copper', about: 'Freckles, a blue jacket' },
  { id: 'b', art: lookB, name: 'Cropped', about: 'A plum jacket' },
  { id: 'c', art: lookC, name: 'Fringe', about: 'A terracotta jacket' },
  { id: 'd', art: lookD, name: 'Braid', about: 'A sage jacket' },
];

/** The keys that continue a conversation, and how long after the deed opens they are still taken for that. */
const CONTINUE_KEYS = ['KeyE', 'Enter', 'Space'];
const SETTLE_MS = 800;

const STYLE = /* css */ `
.gd-shade { position: absolute; inset: 0; z-index: 45; display: grid; place-items: center; padding: 16px; background: rgb(14 17 27 / 0.42); pointer-events: auto; }
.gd-shade[hidden] { display: none; }
.gd-panel { width: min(560px, 100%); padding: 34px 40px 30px; color: var(--ui-ink); font: 600 15px / 1.45 var(--ui-font); animation: gd-in 160ms var(--ui-ease) both; }
.ui-book.ui-kit .gd-panel { padding: 40px 46px 36px; }
@keyframes gd-in { from { transform: translateY(6px) scale(0.97); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .gd-panel { animation: none; } }
.gd-head { position: relative; margin: 0 0 18px; padding-bottom: 12px; text-align: center; font: 650 26px / 1.1 var(--ui-display); color: var(--ui-ink); }
.gd-head::after { content: ''; position: absolute; left: 50%; bottom: 0; width: 60%; height: 2px; transform: translateX(-50%); background: linear-gradient(90deg, rgb(211 188 142 / 0), var(--ui-gold), rgb(211 188 142 / 0)); }
.gd-note { margin: 0 0 16px; text-align: center; color: var(--ui-ink-2); }
.gd-looks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 0 0 20px; padding: 0; border: 0; }
.gd-look { display: grid; justify-items: center; gap: 6px; padding: 10px 6px 8px; color: var(--ui-ink); background: var(--ui-paper-2); border: 0; border-radius: 12px; box-shadow: inset 0 0 0 1px var(--ui-line-strong); cursor: pointer; font: 700 13px / 1.2 var(--ui-font); transition: transform 120ms var(--ui-ease), box-shadow 120ms var(--ui-ease); }
.gd-look img { width: 72px; height: 80px; object-fit: contain; image-rendering: pixelated; border-radius: 8px; background: var(--ui-paper-light); }
.gd-look:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px var(--ui-gold), 0 4px 12px rgb(201 162 94 / 0.3); }
.gd-look[aria-checked='true'] { background: var(--ui-paper-light); box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 0 1px var(--ui-bronze), 0 4px 14px rgb(201 162 94 / 0.45); }
.gd-look:focus-visible { outline: 2px solid var(--ui-bronze); outline-offset: 3px; }
.gd-look small { font-weight: 600; font-size: 11px; color: var(--ui-ink-2); text-align: center; }
.gd-row { display: flex; justify-content: center; gap: 12px; }
.gd-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 26px; font: 700 16px / 1 var(--ui-font); letter-spacing: 0.01em; color: var(--ui-paper-light); background: linear-gradient(180deg, #56607a, #4a5366 55%, #424a5c); border: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), 0 2px 6px rgb(10 12 20 / 0.22); cursor: pointer; }
.gd-btn.gd-primary { color: var(--ui-night); background: linear-gradient(180deg, #f6dfa0, #e2c07a 55%, #cfa863); box-shadow: inset 0 0 0 1px rgb(255 247 220 / 0.7), 0 0 0 1px var(--ui-bronze), 0 2px 10px rgb(201 162 94 / 0.45); }
.gd-btn:hover { filter: brightness(1.08); }
.gd-btn:active { transform: scale(0.97); }
.gd-btn:focus-visible { outline: 2px solid var(--ui-bronze); outline-offset: 3px; }
.gd-btn:disabled { color: var(--ui-ink-2); background: var(--ui-paper-2); box-shadow: inset 0 0 0 1px var(--ui-line-strong); cursor: default; filter: none; transform: none; }
.gd-deed { margin: 0 0 18px; padding: 18px 20px; text-align: center; background: var(--ui-paper-light); border-radius: 10px; box-shadow: inset 0 0 0 1px var(--ui-line); }
.gd-deed p { margin: 0 0 6px; color: var(--ui-ink-2); }
.gd-deed b { display: block; margin-bottom: 14px; font: 650 22px / 1.2 var(--ui-display); color: var(--ui-ink); }
.gd-name { width: 100%; min-height: 48px; padding: 6px 4px 4px; font: 600 26px / 1.2 var(--ui-display); font-style: italic; text-align: center; color: #2b3a6b; background: transparent; border: 0; border-bottom: 2px solid var(--ui-bronze); border-radius: 0; outline: 0; }
.gd-name::placeholder { color: rgb(107 111 126 / 0.55); font-style: italic; }
.gd-name:focus { border-bottom-color: var(--ui-gold-bright); box-shadow: 0 6px 0 -4px rgb(240 212 138 / 0.6); }
.gd-sig { margin-top: 6px; font: 700 11px / 1 var(--ui-font); letter-spacing: 0.24em; text-transform: uppercase; color: var(--ui-ink-2); }
@container gu (width < 560px) { .gd-panel { padding: 26px 20px 22px; } .gd-looks { grid-template-columns: repeat(2, 1fr); } }
`;

export interface GrantPanels {
  readonly open: OpeningAsk | null;
  /** Opens the panel the rules ask for, or closes it when they ask for none. */
  sync(ask: OpeningAsk | null): void;
  /** A key while a panel is open. True when the panel used it. */
  key(event: KeyboardEvent): boolean;
}

export function createGrantPanels(root: HTMLElement, opening: () => OpeningApi | undefined, sound: (s: 'click' | 'open' | 'close') => void): GrantPanels {
  addStyle(root, 'grantday-panels', STYLE);
  const shade = document.createElement('div');
  shade.className = 'gd-shade';
  shade.hidden = true;
  root.append(shade);
  let open: OpeningAsk | null = null;
  let picked: HeroLook = 'a';

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function mirror(): HTMLElement {
    picked = opening()?.hero().look ?? 'a';
    const panel = el('section', 'gd-panel ui-frame');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'The mirror');
    panel.append(el('h2', 'gd-head', 'The mirror'), el('p', 'gd-note', 'Sixteen years old, and leaving today. Who looks back?'));
    const looks = el('div', 'gd-looks');
    looks.setAttribute('role', 'radiogroup');
    looks.setAttribute('aria-label', 'Your look');
    const buttons = LOOKS.map((look, i) => {
      const b = el('button', 'gd-look');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.key = `mirror:${look.id}`;
      const img = el('img', '');
      img.src = look.art;
      img.alt = '';
      b.append(img, el('span', '', look.name), el('small', '', look.about));
      b.onclick = () => { picked = look.id; sound('click'); mark(); };
      b.onkeydown = (event) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = LOOKS[(i + step + LOOKS.length) % LOOKS.length];
        picked = next.id;
        mark();
        buttons[LOOKS.indexOf(next)].focus();
      };
      return b;
    });
    const mark = () => buttons.forEach((b, i) => {
      const on = LOOKS[i].id === picked;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    mark();
    looks.append(...buttons);
    const done = el('button', 'gd-btn gd-primary', 'That\'s me');
    done.type = 'button';
    done.dataset.key = 'mirror:done';
    done.onclick = () => { sound('click'); opening()?.setLook(picked); };
    const row = el('div', 'gd-row');
    row.append(done);
    panel.append(looks, row);
    requestAnimationFrame(() => buttons[LOOKS.findIndex((l) => l.id === picked)]?.focus({ preventScroll: true }));
    return panel;
  }

  function deed(): HTMLElement {
    const panel = el('section', 'gd-panel ui-frame');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'The deed');
    panel.append(el('h2', 'gd-head', 'Deed of grant'));
    const paper = el('div', 'gd-deed');
    paper.append(el('p', '', 'By right of the grant, to a ward of the Delvers\' Guild:'), el('b', '', 'Plot forty-one, Greenhollow'));
    const name = el('input', 'gd-name');
    name.type = 'text';
    name.maxLength = NAME_MAX;
    name.placeholder = 'Write your name';
    name.autocomplete = 'off';
    name.spellcheck = false;
    name.setAttribute('aria-label', 'Your name');
    name.dataset.key = 'deed:name';
    paper.append(name, el('div', 'gd-sig', 'Signed'));
    const sign = el('button', 'gd-btn gd-primary', 'Sign');
    sign.type = 'button';
    sign.dataset.key = 'deed:sign';
    sign.disabled = true;
    name.oninput = () => { sign.disabled = name.value.trim() === ''; };
    const submit = () => {
      if (sign.disabled) return;
      sound('click');
      opening()?.sign(name.value);
    };
    sign.onclick = submit;
    // The deed opens as the Guildmaster's last line ends, and a player may still be tapping E to continue: that E,
    // or a key pressed or held from before, is not the first letter of a name. Timed by when the key went down, not
    // when the page got to it: the page can be busy for a moment as the deed first draws.
    const opened = performance.now();
    let writing = false;
    name.onkeydown = (event) => {
      const t = event.timeStamp - opened;
      if (!writing && (event.repeat || t < 0 || (CONTINUE_KEYS.includes(event.code) && t < SETTLE_MS))) {
        event.preventDefault();
        return;
      }
      writing = true;
      if (event.key === 'Enter') { event.preventDefault(); submit(); }
    };
    // The field takes the focus a frame after it opens, so a key that went down before can still land its letter
    // here: a letter whose key went down elsewhere is not written.
    name.addEventListener('beforeinput', (event) => { if (!writing) event.preventDefault(); });
    const row = el('div', 'gd-row');
    row.append(sign);
    panel.append(paper, row);
    requestAnimationFrame(() => name.focus({ preventScroll: true }));
    return panel;
  }

  return {
    get open() { return open; },
    sync(ask) {
      if (ask === open) return;
      open = ask;
      shade.hidden = ask === null;
      shade.replaceChildren(...(ask === 'mirror' ? [mirror()] : ask === 'deed' ? [deed()] : []));
      sound(ask ? 'open' : 'close');
    },
    key(event) {
      if (!open) return false;
      if (event.code === 'Escape') {
        opening()?.cancel();
        return true;
      }
      return false;
    },
  };
}
