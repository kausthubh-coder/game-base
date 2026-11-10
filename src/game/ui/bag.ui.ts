// The bag (36 slots, the quick row first) with its "By hand" tab, and the Make panel a workbench opens.

import type { Recipe } from '../api.sim.ts';
import { add, h, keepFocus, picture } from './dom.ui.ts';
import { gridMove, missingReason } from './logic.ui.ts';
import type { PanelView, UiContext } from './types.ui.ts';

const QUICK = 9;

const STATION_NAMES: Record<string, string> = { hand: 'By hand', workbench: 'Workbench' };
const stationName = (station: string): string => STATION_NAMES[station] ?? station[0].toUpperCase() + station.slice(1);

/** The list of recipes with what each needs, the have and need counts, and a Make button. */
function recipeList(ctx: UiContext, recipes: readonly Recipe[], empty: string, rerender: () => void): HTMLElement {
  const { items, inventory, crafting } = ctx.game.systems;
  if (recipes.length === 0) return h('p', { class: 'gu-empty' }, empty);
  const list = h('ul', { class: 'gu-recipes' });
  for (const recipe of recipes) {
    const made = items.get(recipe.makes.id);
    const reason = missingReason(recipe, (id) => inventory.count(id), (id) => items.get(id).name, crafting.canMake(recipe.id));
    const needs = h('span', { class: 'gu-needs' });
    for (const need of recipe.needs) {
      const have = inventory.count(need.id);
      needs.append(
        h('span', { class: have < need.count ? 'gu-need gu-short' : 'gu-need' },
          picture(ctx.options.icon(items.get(need.id).icon), items.get(need.id).name, 24),
          h('span', null, items.get(need.id).name),
          h('span', { class: 'gu-num', 'aria-label': `${have} of ${need.count}` }, `${have}/${need.count}`),
        ),
      );
    }
    const reasonId = `gu-why-${recipe.id}`;
    const button = h('button', {
      class: 'gu-btn', type: 'button', 'data-key': `make:${recipe.id}`,
      'aria-disabled': reason ? 'true' : null, 'aria-describedby': reason ? reasonId : null,
      'aria-label': `Make ${made.name}`,
      onclick: () => {
        if (reason) return;
        if (crafting.make(recipe.id)) ctx.sound('click');
        rerender();
      },
    }, 'Make');
    list.append(
      h('li', { class: 'gu-recipe' },
        picture(ctx.options.icon(made.icon), made.name, 48),
        h('div', { class: 'gu-recipe-text' },
          h('div', { class: 'gu-recipe-name' }, made.name, recipe.makes.count > 1 ? h('span', { class: 'gu-num gu-quiet' }, ` ×${recipe.makes.count}`) : null),
          needs,
        ),
        h('div', { class: 'gu-recipe-act' }, button, reason ? h('span', { class: 'gu-why', id: reasonId }, reason) : null),
      ),
    );
  }
  return list;
}

export function bagPanel(ctx: UiContext, startTab: string | undefined): PanelView {
  const { items, inventory, crafting } = ctx.game.systems;
  const body = h('div', { class: 'gu-bag' });
  let tab: 'things' | 'hand' = startTab === 'hand' ? 'hand' : 'things';
  /** The slot picked up to move, or null. */
  let picked: number | null = null;
  /** The slot the detail shows: the one under the pointer or the focus. */
  let shown = inventory.selected;
  /** The slot the Tab key lands on. */
  let cursor = inventory.selected;

  const tabs = h('div', { class: 'gu-tabs', role: 'tablist' });
  const tabButton = (id: 'things' | 'hand', label: string): HTMLElement =>
    h('button', {
      class: 'gu-tab', type: 'button', role: 'tab', 'aria-selected': String(tab === id), 'data-key': `tab:${id}`,
      onclick: () => { tab = id; picked = null; ctx.sound('click'); view.render(); },
    }, label);

  const detail = h('div', { class: 'gu-detail', 'aria-live': 'polite' });
  const drawDetail = (): void => {
    const stack = inventory.slots[shown];
    detail.replaceChildren();
    if (!stack) {
      detail.append(h('p', { class: 'gu-empty' }, picked === null ? 'Click a stack, then another slot, to move it.' : 'Now pick the slot to put it in.'));
      return;
    }
    const def = items.get(stack.id);
    add(detail,
      picture(ctx.options.icon(def.icon), def.name, 64),
      h('div', { class: 'gu-detail-name' }, def.name, stack.count > 1 ? h('span', { class: 'gu-num gu-quiet' }, ` ×${stack.count}`) : null),
      h('p', { class: 'gu-detail-text' }, def.description),
      picked === null ? null : h('p', { class: 'gu-detail-text gu-quiet' }, picked === shown ? 'Picked up. Now pick the slot to put it in.' : 'Click to put the picked stack here.'),
    );
  };

  const click = (index: number): void => {
    if (picked === null) {
      if (!inventory.slots[index]) return;
      picked = index;
    } else {
      if (picked !== index) inventory.move(picked, index);
      picked = null;
    }
    ctx.sound('click');
    cursor = shown = index;
    view.render();
  };

  const drawGrid = (): HTMLElement => {
    const grid = h('div', { class: 'gu-slots', role: 'group', 'aria-label': 'Slots' });
    inventory.slots.forEach((stack, index) => {
      const def = stack ? items.get(stack.id) : null;
      const where = index < QUICK ? `Quick slot ${index + 1}` : `Slot ${index + 1}`;
      const slot = h('button', {
        class: 'gu-slot' + (index < QUICK ? ' gu-quick' : '') + (picked === index ? ' gu-picked' : ''),
        type: 'button', 'data-key': `slot:${index}`, tabindex: index === cursor ? 0 : -1,
        'aria-label': def && stack ? `${where}: ${def.name}, ${stack.count}` : `${where}: empty`,
        'aria-pressed': picked === index ? 'true' : null,
        onclick: () => click(index),
        onpointerenter: () => { shown = index; drawDetail(); },
        onfocus: () => { shown = cursor = index; drawDetail(); },
      },
        def && stack ? picture(ctx.options.icon(def.icon), def.name, 48) : null,
        index < QUICK ? h('span', { class: 'gu-slot-key gu-num', 'aria-hidden': true }, String(index + 1)) : null,
        stack && stack.count > 1 ? h('span', { class: 'gu-slot-count gu-num', 'aria-hidden': true }, String(stack.count)) : null,
      );
      grid.append(slot);
    });
    grid.addEventListener('keydown', (event) => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const next = gridMove(cursor, event.key, columns, inventory.slots.length);
      if (next === cursor) return;
      event.preventDefault();
      event.stopPropagation();
      const from = grid.children[cursor] as HTMLElement, to = grid.children[next] as HTMLElement;
      from.tabIndex = -1;
      to.tabIndex = 0;
      to.focus();
    });
    return grid;
  };

  const view: PanelView = {
    title: 'Bag',
    className: 'gu-panel-bag',
    head: tabs,
    body,
    render() {
      keepFocus(body.closest<HTMLElement>('.gu-panel') ?? body, () => {
        tabs.replaceChildren(tabButton('things', 'Things'), tabButton('hand', 'By hand'));
        if (tab === 'things') {
          drawDetail();
          body.replaceChildren(drawGrid(), detail);
        } else {
          const byHand = crafting.available().filter((recipe) => recipe.station === 'hand');
          body.replaceChildren(recipeList(ctx, byHand, 'Nothing can be made by hand yet.', () => view.render()));
        }
        body.classList.toggle('gu-bag-things', tab === 'things');
      });
    },
    onKey(event) {
      if (event.key === 'Escape' && picked !== null) {
        picked = null;
        view.render();
        return true;
      }
      return false;
    },
  };
  return view;
}

export function makePanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-make' });
  const view: PanelView = {
    title: 'Make',
    className: 'gu-panel-make',
    body,
    render() {
      keepFocus(body, () => {
        const available = ctx.game.systems.crafting.available();
        const stations = [...new Set(available.map((recipe) => recipe.station))].sort((a, b) => Number(a === 'hand') - Number(b === 'hand'));
        body.replaceChildren();
        if (stations.length === 0) body.append(h('p', { class: 'gu-empty' }, 'Nothing can be made here yet. Stand by a workbench to see what it makes.'));
        for (const station of stations) {
          body.append(
            h('section', { class: 'gu-section' },
              h('h3', { class: 'gu-label' }, stationName(station)),
              recipeList(ctx, available.filter((recipe) => recipe.station === station), '', () => view.render()),
            ),
          );
        }
      });
    },
  };
  return view;
}
