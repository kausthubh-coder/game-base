// The settlement on screen, as the approved mockups draw it (assets-src/concept/interface/people and dinner):
//
//   - A settler's card, on "E" at them or at their home: their portrait and name, their three needs as Met or
//     Missing, their wish, their two jobs as navy cards, and the button that walks them to the one picked.
//   - The dinner table, on "E" at it on a dinner evening: the two asks with their portraits, one button each.
//     The one granted thanks you, and the other says their one line.
//   - Over each home, when the hero is near, a glass tag with who lives there and what they still need.
//   - A banner when the settlement takes a step (homestead, hamlet, freehold) or someone comes to live here.
//
// The rules are src/game/settlement. This file only reads `book.sys.settlement` and calls `lead` and `grant`.
import type { NeedId, SettlerView } from '../api.sim.ts';
import type { PersonId } from '../content/ids.ts';
import { SETTLER, STEP_MOMENTS, isSettler } from '../content/people.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';
import { worldLabelLayout } from './world-label-layout.ts';
import { bookOf } from '../uiview/book.ts';
import { button, el, homePanel, rule } from '../uiview/home-panel.ts';
import { addStyle } from '../uiview/theme.ts';

/** Seconds between two looks at the homes' tags. */
const LOOK_EVERY = 0.5;
/** A home's tag shows when the hero is this many blocks from it or closer. */
const TAG_RANGE = 18;
/** How high over the ground before a door its tag hangs, in blocks. */
const DOOR_HEIGHT = 2.6;
const ARRIVED = 'Come to live with you';
/** Seconds a banner stays. */
const BANNER = 4.5;

const NEEDS: readonly { id: NeedId; label: string; small?: string; icon: string }[] = [
  { id: 'bed', label: 'Bed', small: '(under a roof)', icon: '<path d="M3 13 L12 5 L21 13" /><path d="M6 11 V19 H18 V11" />' },
  { id: 'meal', label: 'Meal', small: '(each day)', icon: '<path d="M7 4 V20 M4 4 V9 a3 3 0 0 0 6 0 V4" /><path d="M16 20 V4 c3 2 3 7 0 9" />' },
  { id: 'lamp', label: 'Lamp', icon: '<path d="M9 5 H15 L16 8 H8 Z" /><path d="M8 8 H16 V17 H8 Z" /><path d="M10 17 V20 H14 V17 M12 2 V5" />' },
];

const STYLE = /* css */ `
.ui-book .hp-need-icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ui-book .hp-wish { display: flex; gap: 12px; align-items: baseline; padding: 0 8px; }
.ui-book .hp-wish-key { flex: none; color: var(--ui-bronze); font-weight: 800; }
.ui-book .hp-wish-key::before { content: '✧ '; }
.ui-book .hp-wish-text { flex: 1; }
.ui-book .hp-wish.is-granted .hp-wish-key::before { content: '✓ '; color: #5e8a4a; }
.ui-book .hp-hearts { margin: 2px 0 0; color: var(--ui-ink-2); font-size: 0.9em; }
.ui-book .hp-asks { display: grid; gap: 10px; }
.ui-book .hp-ask { display: flex; align-items: center; gap: 16px; padding: 10px 14px 10px 10px; border-radius: 16px; background: var(--ui-paper-light); box-shadow: inset 0 0 0 1px var(--ui-line); }
.ui-book .hp-ask .hp-portrait { width: 72px; height: 72px; border-radius: 12px; }
.ui-book .hp-ask-words { flex: 1; display: grid; gap: 4px; }
.ui-book .hp-ask-name { font: 700 1.25em var(--ui-display); }
.ui-book .hp-ask-name::after { content: ''; display: inline-block; width: 9px; height: 9px; margin-left: 10px; transform: rotate(45deg) translateY(-2px); background: #e0a23c; }
.ui-book .hp-ask-text { color: var(--ui-ink); }
.ui-book .hp-ask .hp-btn { min-width: 150px; }
.ui-book .hp-ask.is-granted { box-shadow: inset 0 0 0 2px var(--ui-gold); background: #fbf3df; }
.ui-book .hp-ask.is-other { opacity: 0.85; }
.ui-book .hp-sub b { color: var(--ui-ink); }
/* The dinner table's asks, in the dialogue box's look (assets-src/concept/interface/dialogue.webp): low on the
   screen over a dark band, gold names over a fine rule, round gold-ringed portraits, outlined pills to choose. The
   table, the lanterns and the people at it stay in view above. */
.ui-book .hp-layer.is-dinner { place-items: end center; padding: 16px 16px max(18px, env(safe-area-inset-bottom, 0px)); z-index: 39; }
.ui-book .hp-layer.is-dinner::before { content: ''; position: absolute; inset: auto 0 0 0; height: min(40vh, 300px); background: linear-gradient(0deg, rgb(20 24 38 / 0.94), rgb(22 27 42 / 0.8) 50%, rgb(22 27 42 / 0)); pointer-events: none; }
.ui-book .hp-panel.hp-dinner { width: min(1100px, 100%); padding: 0 8px 4px; background: none; color: var(--ui-glass-ink); text-shadow: 0 1px 3px rgb(0 0 0 / 0.7); overflow: visible; }
.ui-book .hp-dinner .hp-close { top: 0; right: 0; background: rgb(43 50 69 / 0.9); color: var(--ui-paper-light); box-shadow: inset 0 0 0 1.5px var(--ui-gold); text-shadow: none; }
.ui-book .hp-dinner-head { display: flex; align-items: baseline; gap: 18px; padding-right: 48px; margin-bottom: 10px; flex-wrap: wrap; }
.ui-book .hp-dinner-title { margin: 0; font: 650 calc(24px * var(--ui-size))/1.2 var(--ui-display); color: var(--ui-gold-bright); }
.ui-book .hp-dinner-sub { margin: 0; color: var(--ui-glass-ink-2); font-size: 0.95em; }
.ui-book .hp-dinner .hp-asks { gap: 8px; }
.ui-book .hp-dinner .hp-ask { gap: 18px; padding: 8px 0; border-radius: 0; background: none; box-shadow: none; border-top: 1px solid rgb(211 188 142 / 0.28); }
.ui-book .hp-dinner .hp-ask .hp-portrait { width: 64px; height: 64px; box-shadow: 0 0 0 3px var(--ui-gold), 0 0 0 5px rgb(22 26 38 / 0.6), 0 6px 14px rgb(0 0 0 / 0.45); }
.ui-book .hp-dinner .hp-ask-name { color: var(--ui-gold-bright); font: 650 1.2em var(--ui-display); }
.ui-book .hp-dinner .hp-ask-text { color: var(--ui-glass-ink); font-size: 1.08em; }
.ui-book .hp-dinner .hp-ask .hp-btn {
  min-width: 220px; min-height: 46px; color: var(--ui-glass-ink); font-weight: 700; border-radius: 999px; text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  background: linear-gradient(180deg, rgb(30 36 54 / 0.78), rgb(22 26 38 / 0.86)); box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.85), 0 2px 8px rgb(0 0 0 / 0.3);
}
.ui-book .hp-dinner .hp-ask .hp-btn:hover, .ui-book .hp-dinner .hp-ask .hp-btn:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 18px rgb(240 212 138 / 0.35); filter: none; }
.ui-book .hp-dinner .hp-ask.is-granted { background: none; box-shadow: none; }
.ui-book .hp-dinner .hp-ask.is-granted .hp-ask-name::after { content: ' · granted'; color: var(--ui-gold); font: 700 0.7em var(--ui-font); }
.ui-book .hp-dinner .hp-ask.is-other { opacity: 0.8; }
.ui-book .hp-dinner .hp-foot { color: var(--ui-glass-ink-2); text-align: left; }
.ui-book .hp-dinner .hp-actions { justify-content: flex-end; margin-top: 6px; }
/* On a narrow screen the asks take more height than the band: they get night glass of their own, so the log under them does not show through. */
@media (max-width: 899px) {
  .ui-book .hp-panel.hp-dinner { padding: 14px 14px 10px; border-radius: 18px; background: rgb(20 24 38); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.4); }
  .ui-book .hp-dinner .hp-close { top: 10px; right: 10px; }
}
/* On a wide screen the two asks stand side by side, each with its pill under the words, so the band stays low. */
@media (min-width: 900px) {
  .ui-book .hp-dinner .hp-asks { grid-template-columns: 1fr 1fr; column-gap: 40px; }
  .ui-book .hp-dinner .hp-ask { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; }
  .ui-book .hp-dinner .hp-ask .hp-btn { grid-column: 2; justify-self: start; min-height: 42px; }
}

/* Over each home: who lives there and what they need. Night glass, never a card. */
.ui-book .hp-tags { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.ui-book .ui-covered .hp-tags, .ui-book.ui-covered .hp-tags { display: none; }
.ui-book .hp-tag {
  position: absolute; left: 0; top: 0; display: grid; gap: 2px; justify-items: center; padding: 6px 14px 7px; border-radius: 14px;
  background: var(--ui-glass); box-shadow: inset 0 0 0 1px var(--ui-glass-line), var(--ui-glass-shadow); color: var(--ui-glass-ink);
  font: 700 12px/1.25 var(--ui-font); white-space: nowrap; will-change: transform;
}
.ui-book .hp-tag[hidden] { display: none; }
.ui-book .hp-tag-name { font: 700 15px var(--ui-display); }
.ui-book .hp-tag-line .is-missing { color: var(--ui-gold-bright); }

/* A step of the settlement, or someone come to stay: a title over the world. */
.ui-book .hp-banner { position: absolute; left: 50%; top: 32%; z-index: 25; display: grid; justify-items: center; gap: 4px; transform: translateX(-50%); pointer-events: none; text-align: center; color: var(--ui-glass-ink); text-shadow: var(--ui-text-shadow); }
.ui-book .hp-banner[hidden] { display: none; }
.ui-book .hp-banner-kicker { font: 800 13px var(--ui-font); letter-spacing: 0.18em; text-transform: uppercase; color: var(--ui-gold-bright); }
.ui-book .hp-banner-title { font: 700 clamp(34px, 6vw, 56px)/1.05 var(--ui-display); }
.ui-book .hp-banner-text { max-width: min(560px, 90vw); font: 700 16px/1.35 var(--ui-font); }
.ui-book .hp-banner .hp-rule { width: 260px; margin: 6px 0; }
.ui-book .hp-banner.is-showing { animation: hp-banner-in 420ms var(--ui-ease); }
.ui-book .hp-banner.is-going { transition: opacity 600ms ease; opacity: 0; }
/* The arrival occupies the phone's tracker space only while its banner is visible. */
@media (max-width: 559px) {
  .ui-book:has(.hp-banner:not([hidden])) .gb-hud-quest,
  .ui-book:has(.hp-banner:not([hidden])) .ui-heart { visibility: hidden; pointer-events: none; }
}
@keyframes hp-banner-in { from { transform: translate(-50%, 10px); } to { transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) { .ui-book .hp-banner.is-showing { animation: none; } }
@media (max-width: 560px) {
  .ui-book .hp-ask { flex-wrap: wrap; }
  .ui-book .hp-ask .hp-btn { width: 100%; }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  addStyle(root, 'home', STYLE);
  const panel = homePanel(view, book);
  const settlement = () => book.sys.settlement;
  const nameOf = (who: PersonId): string => (isSettler(who) ? SETTLER[who].name : book.sys.people?.get(who)?.name ?? who);

  function portrait(who: PersonId): HTMLElement {
    const ring = el('span', 'hp-portrait');
    const art = book.art.portraitElement(who);
    if (art) ring.append(art);
    else ring.append(el('span', 'ui-letters', nameOf(who).slice(0, 1)));
    return ring;
  }

  function icon(svg: string): HTMLElement {
    const box = el('span', 'hp-row-icon hp-need-icon');
    box.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
    return box;
  }

  // ------------------------------------------------------------------------------------ the card

  let cardOf: PersonId | null = null;
  let picked: string | null = null;
  /** The card as last drawn, to draw it again only when something on it changed. */
  let lastCard = '';

  function openCard(who: PersonId): void {
    const s = settlement()?.settler(who);
    if (!s) return;
    cardOf = who;
    picked = s.job ?? s.jobs[0]?.id ?? null;
    lastCard = JSON.stringify(s);
    panel.open((body) => fillCard(body, s));
  }

  function fillCard(body: HTMLElement, s: SettlerView): void {
    body.dataset.key = `home:card:${s.who}`;
    const head = el('div', 'hp-head');
    const words = el('div', '');
    words.append(el('h2', 'hp-title', s.name), rule(Math.min(3, Math.floor(s.hearts / 10)), 3));
    if (s.hearts > 0) words.append(el('p', 'hp-hearts', `${s.hearts} heart${s.hearts === 1 ? '' : 's'} given`));
    head.append(portrait(s.who), words);
    body.append(head);

    const rows = el('div', 'hp-rows');
    for (const need of NEEDS) {
      const met = s.needs[need.id];
      const row = el('div', 'hp-row');
      const label = el('span', 'hp-row-label', need.label);
      if (need.small) label.append(' ', el('small', '', need.small));
      const pill = el('span', `hp-pill ${met ? 'is-met' : 'is-missing'}`, met ? '✓ Met' : '◇ Missing');
      row.append(icon(need.icon), label, pill);
      rows.append(row);
    }
    body.append(rows, el('div', 'hp-sep'));

    const wish = el('div', `hp-wish${s.wish.granted ? ' is-granted' : ''}`);
    wish.append(el('span', 'hp-wish-key', s.wish.granted ? 'Granted' : 'Wish'), el('span', 'hp-wish-text', `${s.wish.text}.`));
    body.append(wish, el('div', 'hp-sep'));

    body.append(el('div', 'hp-heading', s.jobs.length > 1 ? 'Choose one job' : 'Their work'));
    const jobs = el('div', 'hp-jobs');
    const cards: HTMLButtonElement[] = [];
    for (const job of s.jobs) {
      const card = el('button', 'hp-job');
      card.type = 'button';
      card.dataset.job = job.id;
      card.append(el('span', 'hp-dia'), el('span', 'hp-job-name', job.name), el('span', 'hp-job-text', job.text));
      card.append(el('span', 'hp-job-room', job.ready ? `At ${job.room}` : `Needs ${job.room.replace(/^the |^your |^a /, 'a ')}`));
      if (!job.ready) card.setAttribute('aria-disabled', 'true');
      card.classList.toggle('is-held', s.job === job.id);
      card.addEventListener('click', () => { picked = job.id; mark(); });
      cards.push(card);
      jobs.append(card);
    }
    if (s.jobs.length === 1) jobs.style.gridTemplateColumns = '1fr';
    body.append(jobs);

    const actions = el('div', 'hp-actions');
    const walk = button('Assign job', true, () => {
      if (!picked || !cardOf) return;
      const why = settlement()?.lead(cardOf, picked);
      if (why) { foot.textContent = why; foot.classList.add('is-warn'); return; }
      panel.close();
    });
    const talk = button('Talk', false, () => {
      const who = cardOf;
      panel.close();
      if (who) book.sys.talk?.talkTo(who);
    });
    actions.append(talk, walk);
    body.append(actions);
    const foot = el('p', 'hp-foot', s.leading ? `On the way to ${s.jobs.find((j) => j.id === s.leading)?.room ?? 'work'}. Walk there together.` : s.note || (s.job ? `From the road: ${s.road}` : ''));
    if (!s.glad && s.note) foot.classList.add('is-warn');
    body.append(foot);

    function mark(): void {
      for (const card of cards) card.classList.toggle('is-picked', card.dataset.job === picked);
      const job = s.jobs.find((j) => j.id === picked);
      const ready = !!job && job.ready && s.job !== job.id && s.jobs.length > 1;
      walk.disabled = !ready;
      walk.textContent = !job ? 'Assign job' : s.job === job.id ? 'At work there' : !job.ready ? `Build ${job.room.replace(/^the |^your |^a /, 'a ')} first` : `Walk ${s.name} to ${job.room}`;
    }
    mark();
  }

  // ------------------------------------------------------------------------------------ the dinner table

  function openDinner(): void {
    const dinner = settlement()?.dinner();
    if (!dinner) return;
    cardOf = null;
    panel.open((body) => {
      body.dataset.key = 'home:dinner';
      const head = el('div', 'hp-dinner-head');
      head.append(el('h2', 'hp-dinner-title', 'Dinner on the green'), el('p', 'hp-dinner-sub', 'Two of them ask you for something. Grant one wish tonight: 10 hearts.'));
      body.append(head);
      const asks = el('div', 'hp-asks');
      const rows = new Map<PersonId, { row: HTMLElement; text: HTMLElement; choose: HTMLButtonElement }>();
      for (const ask of dinner.asks) {
        const row = el('div', 'hp-ask');
        const words = el('div', 'hp-ask-words');
        const text = el('span', 'hp-ask-text', `“${ask.text}”`);
        words.append(el('span', 'hp-ask-name', nameOf(ask.who)), text);
        const choose = button(`Grant ${nameOf(ask.who)}'s wish`, false, () => grant(ask.who));
        row.append(portrait(ask.who), words, choose);
        rows.set(ask.who, { row, text, choose });
        asks.append(row);
      }
      body.append(asks);
      const foot = el('p', 'hp-foot', 'The other will answer once.');
      body.append(foot);

      function grant(who: PersonId): void {
        const other = dinner!.asks.find((a) => a.who !== who)!.who;
        const line = settlement()?.grant(who);
        if (line === null || line === undefined) return;
        const granted = settlement()?.settler(who);
        for (const [id, r] of rows) {
          r.choose.remove();
          r.row.classList.add(id === who ? 'is-granted' : 'is-other');
        }
        rows.get(who)!.text.textContent = `“${grantedLine(who)}”`;
        rows.get(other)!.text.textContent = `“${line}”`;
        foot.textContent = `${granted?.name ?? nameOf(who)} gave ten hearts.`;
        const actions = el('div', 'hp-actions');
        actions.append(button('Good night', true, () => panel.close()));
        body.append(actions);
      }
    }, 'dinner');
  }

  /** What the one granted says. */
  const grantedLine = (who: PersonId): string => (isSettler(who) ? SETTLER[who].ask?.granted ?? '' : '');

  // ------------------------------------------------------------------------------------ the tags over the homes

  const tagLayer = el('div', 'hp-tags');
  root.append(tagLayer);
  interface Tag { node: HTMLElement; name: HTMLElement; lines: HTMLElement; id: string; x: number; y: number; z: number; text: string; place: (x: number, y: number) => void }
  const tags: Tag[] = [];
  const point: ScreenPoint = { x: 0, y: 0 };
  let sinceLook = LOOK_EVERY;

  function tagFor(i: number): Tag {
    let tag = tags[i];
    if (!tag) {
      const node = el('div', 'hp-tag');
      const name = el('span', 'hp-tag-name');
      const lines = el('div', 'hp-tag-lines');
      node.append(name, lines);
      tagLayer.append(node);
      tag = { node, name, lines, id: '', x: 0, y: 0, z: 0, text: '', place: worldLabelLayout(root).register(node) };
      tags.push(tag);
    }
    return tag;
  }

  function needsLine(s: SettlerView): HTMLElement {
    const line = el('div', 'hp-tag-line');
    NEEDS.forEach((need, i) => {
      if (i > 0) line.append(' · ');
      const met = s.needs[need.id];
      line.append(met ? `${need.label} ✓` : el('span', 'is-missing', `${need.label} missing`));
    });
    return line;
  }

  function refreshTags(): void {
    const homes = settlement()?.homes() ?? [];
    let n = 0;
    for (const home of homes) {
      const tag = tagFor(n++);
      // On the front wall over the door, as the mockup has it: the roof's peak is often off the top of the screen.
      tag.x = home.door.x; tag.y = home.door.y + DOOR_HEIGHT; tag.z = home.door.z;
      const views = home.residents.map((who) => settlement()?.settler(who)).filter((s): s is SettlerView => !!s);
      const text = views.map((s) => `${s.name}:${s.needs.bed}${s.needs.meal}${s.needs.lamp}`).join('|');
      if (text !== tag.text || tag.id !== home.id) {
        tag.text = text;
        tag.id = home.id;
        tag.name.textContent = views.length === 1 ? views[0].name : views.map((s) => s.name).join(' & ');
        tag.lines.replaceChildren(...views.map((s) => {
          const line = needsLine(s);
          if (views.length > 1) line.prepend(`${s.name} · `);
          return line;
        }));
      }
    }
    for (let i = n; i < tags.length; i++) { tags[i].node.hidden = true; tags[i].id = ''; }
  }

  const heroFeet = { x: 0, y: 0 }, heroHead = { x: 0, y: 0 };
  function placeTags(): void {
    const hero = view.playerPosition;
    const feet = view.project(hero.x, hero.y, hero.z, heroFeet);
    const head = view.project(hero.x, hero.y + 2, hero.z, heroHead);
    worldLabelLayout(root).protectHero(feet, head);
    const show = view.started && !book.covered && !panel.isOpen && !(book.sys.talk?.active ?? false);
    for (const tag of tags) {
      if (!tag.id) continue;
      const near = Math.hypot(tag.x - hero.x, tag.z - hero.z) <= TAG_RANGE;
      const at = show && near ? view.project(tag.x, tag.y, tag.z, point) : null;
      if (!at) { tag.node.hidden = true; continue; }
      tag.node.hidden = false;
      // Kept on screen under the top edge, where the clock and the minimap leave room.
      tag.place(at.x, at.y);
    }
  }

  // ------------------------------------------------------------------------------------ banners

  const banner = el('div', 'hp-banner');
  banner.hidden = true;
  const kicker = el('span', 'hp-banner-kicker');
  const title = el('span', 'hp-banner-title');
  const words = el('span', 'hp-banner-text');
  banner.append(kicker, title, rule(3, 3), words);
  root.append(banner);
  let bannerLeft = 0;
  const queue: [string, string, string][] = [];

  function showBanner(k: string, t: string, w: string): void {
    kicker.textContent = k;
    title.textContent = t;
    words.textContent = w;
    banner.hidden = false;
    banner.classList.remove('is-going', 'is-showing');
    void banner.offsetWidth;
    banner.classList.add('is-showing');
    bannerLeft = BANNER;
  }

  game.events.on('settlement.step', ({ step }) => {
    if (step === 'camp') return;
    queue.push(['Your settlement', STEP_MOMENTS[step].title, STEP_MOMENTS[step].text]);
  });
  game.events.on('settler.arrived', ({ who }) => {
    // Hobb and Dax come together: one banner for both.
    const last = queue[queue.length - 1];
    if (last && last[0] === ARRIVED) {
      const names = [...last[1].split(/, | and /), nameOf(who)];
      last[1] = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      return;
    }
    queue.push([ARRIVED, nameOf(who), '']);
  });

  // ------------------------------------------------------------------------------------ wiring

  game.events.on('settler.opened', ({ who }) => openCard(who));
  game.events.on('dinner.asked', () => openDinner());

  view.onFrame((dt) => {
    if (bannerLeft > 0) {
      bannerLeft -= dt;
      if (bannerLeft <= 0.6 && !banner.classList.contains('is-going')) banner.classList.add('is-going');
      if (bannerLeft <= 0) banner.hidden = true;
    } else if (queue.length > 0 && view.started && !book.covered) {
      const [k, t, w] = queue.shift()!;
      showBanner(k, t, w);
    }
    sinceLook += dt;
    if (sinceLook >= LOOK_EVERY) {
      sinceLook = 0;
      refreshTags();
      // An open card follows the rules: a need met, a job taken.
      if (panel.isOpen && cardOf) {
        const s = settlement()?.settler(cardOf);
        const now = s ? JSON.stringify(s) : '';
        if (s && now !== lastCard) {
          lastCard = now;
          panel.open((body) => fillCard(body, s));
        }
      }
    }
    placeTags();
  });
}
