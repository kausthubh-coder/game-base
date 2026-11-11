// The Almanac, a full-screen menu: a tab for each category in the top rail, the entries met in that category down the
// left, and the open entry on the right, its picture large, with its two columns of facts.

import type { AlmanacFact, AlmanacPage } from '../api.sim.ts';
import { fillCues, h, iconTab, keepFocus, picture } from './dom.ui.ts';
import { groupPages } from './logic.ui.ts';
import type { PanelView, UiContext } from './types.ui.ts';

const KIND_NAMES: Record<AlmanacPage['kind'], string> = { creature: 'Creature', pet: 'Pet', crop: 'Crop', person: 'Person', place: 'Place' };
/** The line icon of each category's tab. */
const TAB_ICONS: Record<AlmanacPage['kind'], string> = { creature: 'creatures', pet: 'pets', crop: 'crops', person: 'people', place: 'places' };

/** The page the book was last open at, kept for the next time it opens. */
let lastPage: string | null = null;

export function almanacPanel(ctx: UiContext, startPage: string | undefined): PanelView {
  const { almanac } = ctx.game.systems;
  const body = h('div', { class: 'gu-almanac' });
  const tabs = h('div', { class: 'gu-tabs', role: 'tablist' });
  const cues = h('div', { class: 'gu-cues' });
  fillCues(cues, [
    { keys: ['↑', '↓'], verb: 'Entry', only: 'fine' },
    { keys: ['Tab'], verb: 'Close', only: 'fine' },
    { keys: ['Esc'], verb: 'Close', only: 'fine' },
    { keys: ['Tap'], verb: 'Open an entry', only: 'coarse' },
  ]);
  let open: string | null = startPage ?? null;
  /** Every page met, in the index's order, for the arrow keys to walk across the categories. */
  let order: AlmanacPage[] = [];

  const pickPage = (pages: AlmanacPage[]): AlmanacPage | null => {
    const byId = (id: string | null): AlmanacPage | undefined => pages.find((page) => page.id === id);
    return byId(open) ?? pages.find((page) => ctx.fresh.has(page.id)) ?? byId(lastPage) ?? pages[0] ?? null;
  };
  const art = (page: AlmanacPage) => ctx.options.picture?.(page.picture) ?? ctx.options.icon(page.picture);

  const factRow = (page: AlmanacPage, fact: AlmanacFact): HTMLElement => {
    if (!fact.known) return h('li', { class: 'gu-fact gu-fact-unknown' }, h('span', { class: 'gu-dashes', role: 'img', 'aria-label': 'Not yet seen' }));
    const fresh = ctx.fresh.get(page.id);
    const isNew = fresh?.has(fact.id) || fresh?.has(fact.text);
    return h('li', { class: 'gu-fact' }, h('span', { class: isNew ? 'gu-inked' : null }, fact.text));
  };

  const column = (page: AlmanacPage, which: 'needs' | 'gives', heading: string): HTMLElement =>
    h('section', { class: 'gu-column' },
      h('h3', { class: 'gu-column-head' }, heading),
      h('ul', { class: 'gu-facts' }, ...page.facts.filter((fact) => fact.column === which).map((fact) => factRow(page, fact))),
    );

  // The open entry: its picture large on a soft glow, then its kind, name and the two columns of facts.
  const leaf = (page: AlmanacPage): HTMLElement => {
    const known = page.facts.filter((fact) => fact.known).length;
    const node = h('article', { class: 'gu-leaf', 'aria-live': 'polite' },
      h('div', { class: 'gu-leaf-art' }, picture(art(page), page.title, 256)),
      h('div', { class: 'gu-leaf-text' },
        h('p', { class: 'gu-leaf-kind' }, KIND_NAMES[page.kind], h('span', { class: 'gu-leaf-known gu-num' }, `${known} of ${page.facts.length} known`)),
        h('h2', { class: 'gu-leaf-title' }, page.title),
        h('div', { class: 'gu-columns' }, column(page, 'needs', 'What it needs'), column(page, 'gives', 'What it gives')),
        page.complete ? h('span', { class: ctx.freshComplete.has(page.id) ? 'gu-stamp gu-stamped' : 'gu-stamp' }, 'Complete') : null,
      ),
    );
    // Shown once, so the ink does not run again the next time the page is drawn.
    ctx.fresh.delete(page.id);
    ctx.freshComplete.delete(page.id);
    return node;
  };

  const openPage = (id: string): void => {
    open = id;
    ctx.sound('click');
    view.render();
  };

  const view: PanelView = {
    title: 'Almanac',
    className: 'gu-panel-almanac',
    head: tabs,
    body,
    screen: { icon: 'almanac', cues },
    render() {
      keepFocus(body.closest<HTMLElement>('.gu-panel') ?? body, () => {
        const groups = groupPages(almanac.pages());
        order = groups.flatMap((group) => group.pages);
        const page = pickPage(order);
        if (!page) {
          tabs.replaceChildren();
          body.replaceChildren(h('p', { class: 'gu-empty' }, 'The book is blank. Look closely at a living thing, and the Almanac writes down what it needs and what it gives.'));
          body.classList.add('gu-almanac-blank');
          return;
        }
        body.classList.remove('gu-almanac-blank');
        open = lastPage = page.id;
        // The categories are the tabs. The open page's is picked, and the list shows its entries.
        const shown = groups.find((group) => group.kind === page.kind) ?? groups[0];
        tabs.replaceChildren(...groups.map((group) =>
          iconTab(ctx.options.ornament, TAB_ICONS[group.kind], group.label, group === shown, {
            'data-key': `tab:${group.kind}`,
            onclick: () => { if (group !== shown) openPage((group.pages.find((entry) => ctx.fresh.has(entry.id)) ?? group.pages[0]).id); },
          }),
        ));
        const index = h('nav', { class: 'gu-index', 'aria-label': shown.label },
          ...shown.pages.map((entry) =>
            h('button', {
              class: 'gu-page-link', type: 'button', 'data-key': `page:${entry.id}`, 'data-page': entry.id,
              'aria-current': entry.id === page.id ? 'page' : null,
              onclick: () => openPage(entry.id),
            },
              h('span', { class: 'gu-entry-pic' }, picture(art(entry), entry.title, 64)),
              h('span', { class: 'gu-entry-name' }, entry.title),
              ctx.fresh.has(entry.id) && entry.id !== page.id ? h('span', { class: 'gu-new', 'aria-label': 'new' }) : null,
            ),
          ),
        );
        // A small count of the new entries in the other categories, on their tabs.
        for (const group of groups) {
          if (group === shown || !group.pages.some((entry) => ctx.fresh.has(entry.id))) continue;
          tabs.querySelector(`[data-key="tab:${group.kind}"]`)?.append(h('span', { class: 'gu-new gu-tab-new', 'aria-label': 'new' }));
        }
        body.replaceChildren(index, leaf(page));
      });
    },
    onKey(event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
      const at = order.findIndex((page) => page.id === open);
      const next = order[at + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        open = next.id;
        view.render();
        body.querySelector<HTMLElement>(`[data-page="${CSS.escape(open)}"]`)?.focus();
      }
      return true;
    },
  };
  return view;
}
