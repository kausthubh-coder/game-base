// What a fight in the world shows over the picture, in the game's Gilded Hearth look (docs/ui-look.md): nothing is
// a box over the world. The fight's one line and its short sayings are cream text with a shadow at the top. The
// hero's health and stamina are two thin pills at the bottom left, the kit's three slots and the companion's skill
// are night wells with gold rims at the bottom right, and each beast has its name, its depth and its guard over its
// head. A depth the Heartstone reaches has a gold diamond; one it does not is grey, the colour of the Blight.
import type { RunningFight } from '../api.sim.ts';
import { KIT } from '../content/gear.ts';
import type { KitId } from '../content/ids.ts';
import type { BeastState } from '../fight/fight.sim.ts';
import type { UiArt } from '../uiview/art.ts';
import { addStyle } from '../uiview/theme.ts';

const STYLE = /* css */ `
.ui-book .wf-hud { position: absolute; inset: 0; pointer-events: none; font-family: var(--ui-font); color: var(--ui-glass-ink); }
.ui-book .wf-hud[hidden] { display: none; }
.ui-book .wf-line { position: absolute; top: 100px; left: 50%; transform: translateX(-50%); max-width: min(640px, 86vw); text-align: center; text-shadow: var(--ui-text-shadow); }
.ui-book .wf-name { font-family: var(--ui-display); font-size: 22px; font-weight: 650; color: var(--ui-gold-bright); }
.ui-book .wf-teach { margin-top: 2px; font-size: 15px; font-weight: 700; }
.ui-book .wf-say { margin-top: 8px; min-height: 20px; font-size: 15px; font-weight: 700; color: var(--ui-paper-light); transition: opacity 200ms var(--ui-ease); }
.ui-book .wf-vitals { position: absolute; left: 24px; bottom: 104px; display: grid; gap: 6px; width: 240px; }
.ui-book .wf-bar { position: relative; height: 12px; border-radius: 999px; background: linear-gradient(180deg, rgb(22 26 38 / 0.5), rgb(22 26 38 / 0.75)); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), 0 2px 6px rgb(10 12 20 / 0.3); overflow: hidden; }
.ui-book .wf-bar > i { position: absolute; inset: 2px auto 2px 2px; border-radius: 999px; transition: width 120ms linear; }
.ui-book .wf-health > i { background: linear-gradient(180deg, #f6f1e7, #e4dbc9); }
.ui-book .wf-health.is-low > i { background: linear-gradient(180deg, #f0d48a, #c9a35a); }
.ui-book .wf-stamina { height: 8px; width: 78%; }
.ui-book .wf-stamina > i { background: linear-gradient(180deg, #f0d48a, #d3bc8e); }
.ui-book .wf-num { font-size: 12px; font-weight: 800; color: var(--ui-gold); text-shadow: var(--ui-text-shadow); }
.ui-book .wf-wells { position: absolute; right: 24px; bottom: 104px; display: flex; gap: 8px; align-items: end; }
.ui-book .wf-well { position: relative; width: 50px; height: 50px; border-radius: var(--ui-radius);
  background: radial-gradient(90% 90% at 30% 20%, rgb(58 66 88 / 0.86), rgb(31 36 51 / 0.86));
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), inset 0 2px 6px rgb(0 0 0 / 0.3), 0 2px 6px rgb(10 12 20 / 0.3); }
.ui-book .wf-well.is-held { transform: translateY(-4px); box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 16px rgb(240 212 138 / 0.65); }
.ui-book .wf-well.is-empty { opacity: 0.45; }
.ui-book .wf-well > b { position: absolute; top: 3px; left: 6px; font-size: 11px; font-weight: 800; color: var(--ui-gold); text-shadow: var(--ui-text-shadow); }
.ui-book .wf-well > span { position: absolute; inset: 50% auto auto 50%; width: 32px; height: 32px; margin: -15px 0 0 -16px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: var(--ui-paper-light); }
.ui-book .wf-skill { border-radius: 999px; width: 58px; height: 58px; }
.ui-book .wf-skill > em { position: absolute; inset: 0; border-radius: 999px; background: conic-gradient(rgb(22 26 38 / 0.72) var(--left, 0%), transparent 0); }
.ui-book .wf-skill > small { position: absolute; left: 50%; bottom: -18px; transform: translateX(-50%); white-space: nowrap; font-size: 12px; font-weight: 800; color: var(--ui-glass-ink); text-shadow: var(--ui-text-shadow); }
.ui-book .wf-beast { position: absolute; left: 0; top: 0; display: grid; justify-items: center; gap: 3px; transform: translate(-50%, -100%); white-space: nowrap; text-shadow: var(--ui-text-shadow); }
.ui-book .wf-beast[hidden] { display: none; }
.ui-book .wf-beast-name { font-size: 13px; font-weight: 800; display: flex; gap: 6px; align-items: center; }
.ui-book .wf-depth { display: inline-flex; align-items: center; gap: 4px; font-family: var(--ui-display); font-size: 13px; color: var(--ui-gold-bright); }
.ui-book .wf-depth::before { content: ''; width: 8px; height: 8px; transform: rotate(45deg); background: var(--ui-gold-bright); box-shadow: 0 0 6px rgb(240 212 138 / 0.6); }
.ui-book .wf-depth.is-beyond { color: #b6b3ad; }
.ui-book .wf-depth.is-beyond::before { background: #9a9690; box-shadow: none; }
.ui-book .wf-guard { width: 84px; height: 6px; border-radius: 999px; background: rgb(22 26 38 / 0.7); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.45); overflow: hidden; }
.ui-book .wf-guard > i { display: block; height: 100%; background: linear-gradient(180deg, #f6f1e7, #d9cdb6); }
.ui-book .wf-gift { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); font-family: var(--ui-display); font-size: 18px; color: var(--ui-gold-bright); text-shadow: var(--ui-text-shadow); white-space: nowrap; }
@media (max-width: 700px) {
  .ui-book .wf-vitals { left: 12px; width: 160px; bottom: 96px; }
  .ui-book .wf-wells { right: 12px; bottom: 96px; gap: 6px; }
  .ui-book .wf-well { width: 44px; height: 44px; }
  .ui-book .wf-line { top: 60px; }
}
@media (prefers-reduced-motion: reduce) { .ui-book .wf-bar > i, .ui-book .wf-say { transition: none; } }
`;

/** A pack's count in words. */
const COUNT: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four' };

export interface WorldHud {
  /** Once a frame while a fight runs. `beastAt` places a beast's bar on the page; `held` is the kit thing in the hand. */
  update(run: RunningFight, reach: number, held: KitId | string | null, beastAt: (beast: BeastState) => { x: number; y: number } | null): void;
  /** A short line under the fight's line. */
  say(text: string): void;
  /** The name of a gift, floating over where it was given. */
  label(text: string, at: { x: number; y: number } | null, alpha: number): void;
  hide(): void;
}

export function createWorldHud(root: HTMLElement, art: UiArt | null): WorldHud {
  addStyle(root, 'world-fights', STYLE);
  const hud = document.createElement('div');
  hud.className = 'wf-hud';
  hud.hidden = true;
  hud.innerHTML = `
    <div class="wf-line"><div class="wf-name"></div><div class="wf-teach"></div><div class="wf-say"></div></div>
    <div class="wf-vitals"><div class="wf-num"></div><div class="wf-bar wf-health"><i></i></div><div class="wf-bar wf-stamina"><i></i></div></div>
    <div class="wf-wells"></div>
    <div class="wf-gift" hidden></div>`;
  root.append(hud);
  const $ = <T extends HTMLElement>(selector: string): T => hud.querySelector(selector) as T;
  const name = $('.wf-name'), teach = $('.wf-teach'), saying = $('.wf-say'), num = $('.wf-num');
  const health = $('.wf-health'), healthFill = $('.wf-health > i'), staminaFill = $('.wf-stamina > i');
  const wells = $('.wf-wells'), gift = $('.wf-gift');

  // The kit's three slots and the companion's skill.
  const slots: { el: HTMLElement; icon: HTMLElement; kind: string | null }[] = [];
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'wf-well';
    el.innerHTML = `<b>${i + 1}</b><span></span>`;
    wells.append(el);
    slots.push({ el, icon: el.querySelector('span') as HTMLElement, kind: '' });
  }
  const skill = document.createElement('div');
  skill.className = 'wf-well wf-skill';
  skill.innerHTML = '<em></em><b>C</b><span></span><small></small>';
  wells.append(skill);
  const skillName = skill.querySelector('small') as HTMLElement, skillLeft = skill.querySelector('em') as HTMLElement;

  const bars = new Map<number, { el: HTMLElement; depth: HTMLElement; fill: HTMLElement }>();
  let shown: RunningFight | null = null, sayLeft = 0, lineLeft = 0, last = 0;

  function bar(b: BeastState): { el: HTMLElement; depth: HTMLElement; fill: HTMLElement } {
    let one = bars.get(b.id);
    if (one) return one;
    const el = document.createElement('div');
    el.className = 'wf-beast';
    el.innerHTML = `<div class="wf-beast-name"><span></span><span class="wf-depth"></span></div><div class="wf-guard"><i></i></div>`;
    (el.querySelector('.wf-beast-name > span') as HTMLElement).textContent = b.def.name;
    hud.append(el);
    one = { el, depth: el.querySelector('.wf-depth') as HTMLElement, fill: el.querySelector('.wf-guard > i') as HTMLElement };
    bars.set(b.id, one);
    return one;
  }

  return {
    update(run, reach, held, beastAt) {
      const now = performance.now() / 1000, dt = last ? Math.min(0.1, now - last) : 0;
      last = now;
      if (shown !== run) {
        shown = run;
        hud.hidden = false;
        const first = run.fight.beasts[0];
        const many = run.fight.beasts.length;
        name.textContent = run.keeper?.name ?? (run.hall ? 'The Verdant Stag' : first ? (many > 1 ? `${COUNT[many] ?? many} ${first.def.name.replace(/x$/, 'xe')}s` : first.def.name) : '');
        teach.textContent = run.line;
        lineLeft = 7;
        for (const b of bars.values()) b.el.remove();
        bars.clear();
      }
      lineLeft -= dt;
      teach.style.opacity = lineLeft > 0 ? '1' : '0';
      sayLeft -= dt;
      saying.style.opacity = sayLeft > 0 ? '1' : '0';
      const f = run.fight, h = f.hero;
      num.textContent = `${Math.ceil(h.health)} / ${f.maxHealth}`;
      healthFill.style.width = `calc(${(100 * h.health) / f.maxHealth}% - 4px)`;
      health.classList.toggle('is-low', h.health < f.maxHealth * 0.35);
      staminaFill.style.width = `calc(${(100 * h.stamina) / f.maxStamina}% - 4px)`;
      const kit = f.kitSlots();
      for (let i = 0; i < 3; i++) {
        const s = slots[i] as (typeof slots)[number], kind = kit[i] ?? null;
        if (s.kind !== kind) {
          s.kind = kind;
          s.icon.replaceChildren();
          if (kind) {
            const icon = art?.iconElement(kind);
            if (icon) s.icon.append(icon);
            else s.icon.textContent = KIT[kind].name.split(' ').map((w) => w[0]).join('');
            s.el.title = `${KIT[kind].name}: ${KIT[kind].does}`;
          } else {
            s.el.title = '';
          }
        }
        s.el.classList.toggle('is-empty', !kind);
        s.el.classList.toggle('is-held', !!kind && held === kind);
      }
      const sk = f.skill();
      skillName.textContent = `${f.companion.def.name}: ${sk.name}`;
      skillLeft.style.setProperty('--left', `${sk.rest > 0 ? (100 * sk.left) / sk.rest : 0}%`);
      for (const [id, one] of bars) if (!f.beasts.some((b) => b.id === id)) { one.el.remove(); bars.delete(id); }
      for (const b of f.beasts) {
        const one = bar(b), at = b.doing === 'calmed' ? null : beastAt(b);
        one.el.hidden = !at;
        if (!at) continue;
        one.el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
        one.el.style.left = '0';
        if (b.def.machine) { one.depth.textContent = ''; one.depth.hidden = true; }
        else {
          one.depth.hidden = false;
          one.depth.textContent = String(b.depth);
          one.depth.classList.toggle('is-beyond', b.depth > reach);
        }
        one.fill.style.width = `${(100 * b.guard) / b.full}%`;
      }
    },
    say(text) {
      saying.textContent = text;
      sayLeft = 2.6;
    },
    label(text, at, alpha) {
      gift.hidden = !at || alpha <= 0;
      if (!at) return;
      gift.textContent = text;
      gift.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
      gift.style.opacity = String(alpha);
    },
    hide() {
      hud.hidden = true;
      shown = null;
      for (const b of bars.values()) b.el.remove();
      bars.clear();
    },
  };
}
