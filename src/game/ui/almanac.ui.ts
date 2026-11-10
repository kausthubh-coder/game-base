// The Almanac: a book. The pages the player has met on the left, the open page on the right with its two columns.

import type { AlmanacFact, AlmanacPage } from '../api.sim.ts';
import { h, keepFocus, picture } from './dom.ui.ts';
import { groupPages } from './logic.ui.ts';
import type { PanelView, UiContext } from './types.ui.ts';

const KIND_NAMES: Record<AlmanacPage['kind'], string> = { creature: 'Creature', pet: 'Pet', crop: 'Crop', person: 'Person', place: 'Place' };

/** The page the book was last open at, kept for the next time it opens. */
let lastPage: string | null = null;

export function almanacPanel(ctx: UiContext, startPage: string | undefined): PanelView {
  const { almanac } = ctx.game.systems;
  const body = h('div', { class: 'gu-book' });
  let open: string | null = startPage ?? null;

  const pickPage = (pages: AlmanacPage[]): AlmanacPage | null => {
    const byId = (id: string | null): AlmanacPage | undefined => pages.find((page) => page.id === id);
    return byId(open) ?? pages.find((page) => ctx.fresh.has(page.id)) ?? byId(lastPage) ?? pages[0] ?? null;
  };

  const factRow = (page: AlmanacPage, fact: AlmanacFact): HTMLElement => {
    if (!fact.known) return h('li', { class: 'gu-fact gu-fact-unknown' }, h('span', { class: 'gu-dashes', role: 'img', 'aria-label': 'Not yet seen' }));
    const fresh = ctx.fresh.get(page.id);
    const isNew = fresh?.has(fact.id) || fresh?.has(fact.text);
    return h('li', { class: 'gu-fact' }, h('span', { class: isNew ? 'gu-inked' : null }, fact.text));
  };

  const column = (page: AlmanacPage, which: 'needs' | 'gives', heading: string): HTMLElement =>
    h('section', { class: 'gu-column' },
      h('h3', { class: 'gu-label' }, heading),
      h('ul', { class: 'gu-facts' }, ...page.facts.filter((fact) => fact.column === which).map((fact) => factRow(page, fact))),
    );

  const leaf = (page: AlmanacPage): HTMLElement => {
    const art = ctx.options.picture?.(page.picture) ?? ctx.options.icon(page.picture);
    const node = h('article', { class: 'gu-leaf', 'aria-live': 'polite' },
      h('header', { class: 'gu-leaf-head' },
        picture(art, page.title, 144),
        h('div', null, h('p', { class: 'gu-label' }, KIND_NAMES[page.kind]), h('h2', { class: 'gu-leaf-title' }, page.title)),
        page.complete ? h('span', { class: ctx.freshComplete.has(page.id) ? 'gu-stamp gu-stamped' : 'gu-stamp' }, 'Complete') : null,
      ),
      h('div', { class: 'gu-columns' }, column(page, 'needs', 'What it needs'), column(page, 'gives', 'What it gives')),
    );
    // Shown once, so the ink does not run again the next time the page is drawn.
    ctx.fresh.delete(page.id);
    ctx.freshComplete.delete(page.id);
    return node;
  };

  const view: PanelView = {
    title: 'Almanac',
    className: 'gu-panel-almanac',
    body,
    render() {
      keepFocus(body, () => {
        const groups = groupPages(almanac.pages());
        const pages = groups.flatMap((group) => group.pages);
        const page = pickPage(pages);
        if (!page) {
          body.replaceChildren(h('p', { class: 'gu-empty' }, 'The book is blank. Look closely at a living thing, and the Almanac writes down what it needs and what it gives.'));
          body.classList.add('gu-book-blank');
          return;
        }
        body.classList.remove('gu-book-blank');
        open = lastPage = page.id;
        const index = h('nav', { class: 'gu-index', 'aria-label': 'Pages' });
        for (const group of groups) {
          index.append(
            h('div', { class: 'gu-index-group' },
              h('h3', { class: 'gu-label' }, group.label),
              ...group.pages.map((entry) =>
                h('button', {
                  class: 'gu-page-link', type: 'button', 'data-key': `page:${entry.id}`, 'data-page': entry.id,
                  'aria-current': entry.id === page.id ? 'page' : null,
                  onclick: () => { open = entry.id; ctx.sound('click'); view.render(); },
                },
                  h('span', null, entry.title),
                  ctx.fresh.has(entry.id) && entry.id !== page.id ? h('span', { class: 'gu-new' }, 'new') : null,
                ),
              ),
            ),
          );
        }
        body.replaceChildren(index, h('span', { class: 'gu-spine', 'aria-hidden': true }), leaf(page));
      });
    },
    onKey(event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
      const links = [...body.querySelectorAll<HTMLElement>('.gu-page-link')];
      const at = links.findIndex((link) => link.dataset.page === open);
      const next = links[at + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        open = next.dataset.page ?? open;
        view.render();
        body.querySelector<HTMLElement>(`[data-page="${CSS.escape(open ?? '')}"]`)?.focus();
      }
      return true;
    },
  };
  return view;
}
