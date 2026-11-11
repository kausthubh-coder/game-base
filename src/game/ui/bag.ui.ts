// The bag, a full-screen menu: 36 item cards (the quick row first) beside a detail column, with its "By hand" tab of
// recipes; and the Make panel a workbench opens.

import type { Recipe } from '../api.sim.ts';
import { createSlotDrag } from './drag.ui.ts';
import { add, fillCues, h, iconTab, keepFocus, picture } from './dom.ui.ts';
import { half, itemUse, missingReason, slotMove } from './logic.ui.ts';
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
          // Enough: how many it takes. Short: how many there are of how many, in amber.
          h('span', { class: 'gu-num', 'aria-label': `${have} of ${need.count}` }, have < need.count ? `${have}/${need.count}` : `×${need.count}`),
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
  /** The stack picked up to move by clicks, and how many of it (all when undefined), or null. */
  let picked: { index: number; count: number | undefined } | null = null;
  /** The slot the Tab key lands on. */
  let cursor = inventory.selected;
  /** True when the game changed the bag during a drag, so it is drawn again once the drag ends. */
  let stale = false;
  /** The recipe the By hand tab shows in its column. */
  let chosen: string | null = null;

  const tabs = h('div', { class: 'gu-tabs', role: 'tablist' });
  const tabButton = (id: 'things' | 'hand', icon: string, label: string): HTMLElement =>
    iconTab(ctx.options.ornament, icon, label, tab === id, {
      'data-key': `tab:${id}`,
      onclick: () => { tab = id; picked = null; ctx.sound('click'); view.render(); },
    });

  // ---- the key prompts in the bottom rail: how to move things, or what is picked up.
  const cues = h('div', { class: 'gu-cues', 'aria-live': 'polite' });
  const drawCues = (): void => {
    const stack = picked ? inventory.slots[picked.index] : null;
    if (tab === 'hand') {
      fillCues(cues, [{ keys: ['Click'], verb: 'Choose', only: 'fine' }, { keys: ['Tap'], verb: 'Choose', only: 'coarse' }, { keys: ['Esc'], verb: 'Close', only: 'fine' }]);
    } else if (picked && stack) {
      const def = items.get(stack.id);
      const count = picked.count ?? stack.count;
      fillCues(cues, [
        { keys: [], verb: `Moving ${def.name}${count > 1 ? ` ×${count}` : ''}` },
        { keys: ['Click'], verb: 'Put down', only: 'fine' },
        { keys: ['Tap'], verb: 'Put down', only: 'coarse' },
        { keys: ['Esc'], verb: 'Cancel', only: 'fine' },
      ]);
    } else {
      // A mouse can split with its right button or Shift. A finger has neither, so it is told about tapping instead.
      fillCues(cues, [
        { keys: ['Drag'], verb: 'Move' },
        { keys: ['Shift'], verb: 'Take half', only: 'fine' },
        { keys: ['Tap'], verb: 'Pick up', only: 'coarse' },
        { keys: ['Esc'], verb: 'Close', only: 'fine' },
      ]);
    }
  };

  // ---- the detail column, on a wide screen: the thing under the pointer or the focus, drawn large with its name, use and
  // description. It shows the stack picked up, or the held one, when the pointer is elsewhere. On the By hand tab it
  // shows the chosen recipe with what it needs and the Make button.
  const detail = h('aside', { class: 'gu-detail', 'aria-live': 'polite' });
  let detailFor: number | null | undefined;
  /** The slot the pane shows when nothing is pointed at: the stack picked up, the cursor's, the held one, or the first. */
  const restingSlot = (): number | null => {
    for (const index of [picked?.index, cursor, inventory.selected]) if (index !== undefined && inventory.slots[index]) return index;
    const first = inventory.slots.findIndex((stack) => stack !== null);
    return first >= 0 ? first : null;
  };
  const art = (icon: string | null, name: string): HTMLElement =>
    h('div', { class: 'gu-detail-art' }, icon === null ? null : picture(ctx.options.icon(icon), name, 128));
  const showDetail = (index: number | null): void => {
    if (tab !== 'things' || detailFor === index) return;
    if (detailFor !== undefined && detailFor !== null) body.querySelector(`[data-key="slot:${detailFor}"]`)?.classList.remove('is-shown');
    detailFor = index;
    const stack = index === null ? null : inventory.slots[index];
    if (!stack || index === null) {
      detail.replaceChildren(h('div', { class: 'gu-detail-art gu-detail-art-empty' }), h('p', { class: 'gu-empty' }, 'The bag is empty.'));
      return;
    }
    body.querySelector(`[data-key="slot:${index}"]`)?.classList.add('is-shown');
    const def = items.get(stack.id);
    const use = itemUse(def);
    detail.replaceChildren();
    add(detail,
      art(def.icon, def.name),
      h('div', { class: 'gu-detail-text' },
        h('h3', { class: 'gu-detail-name' }, def.name),
        h('p', { class: 'gu-detail-count gu-num' }, index < QUICK ? `Quick slot ${index + 1} · ${stack.count} held` : `${stack.count} in the bag`),
        use ? h('p', { class: 'gu-detail-use' }, use) : null,
        h('p', { class: 'gu-detail-desc' }, def.description),
        use && index >= QUICK ? h('p', { class: 'gu-detail-note' }, 'Put it in a quick slot to hold it.') : null,
      ),
    );
  };
  /** The chosen recipe in the column: the thing it makes, what it needs against what the bag holds, and the Make button. */
  const showRecipe = (recipe: Recipe | null): void => {
    if (!recipe) {
      detail.replaceChildren(h('div', { class: 'gu-detail-art gu-detail-art-empty' }), h('p', { class: 'gu-empty' }, 'Nothing can be made by hand yet.'));
      return;
    }
    const made = items.get(recipe.makes.id);
    const reason = missingReason(recipe, (id) => inventory.count(id), (id) => items.get(id).name, crafting.canMake(recipe.id));
    const needs = h('ul', { class: 'gu-need-lines' });
    for (const need of recipe.needs) {
      const have = inventory.count(need.id), def = items.get(need.id);
      needs.append(
        h('li', { class: have < need.count ? 'gu-need-line gu-short' : 'gu-need-line' },
          picture(ctx.options.icon(def.icon), def.name, 32),
          h('span', { class: 'gu-need-name' }, def.name),
          h('span', { class: 'gu-num gu-need-count', 'aria-label': `${have} of ${need.count}` }, `${have}/${need.count}`),
        ),
      );
    }
    const reasonId = `gu-why-${recipe.id}`;
    detail.replaceChildren();
    add(detail,
      art(made.icon, made.name),
      h('div', { class: 'gu-detail-text' },
        h('h3', { class: 'gu-detail-name' }, made.name, recipe.makes.count > 1 ? h('span', { class: 'gu-num gu-detail-times' }, ` ×${recipe.makes.count}`) : null),
        h('p', { class: 'gu-detail-desc' }, made.description),
        h('h4', { class: 'gu-detail-sub' }, 'Needs'),
        needs,
      ),
      h('div', { class: 'gu-detail-act' },
        reason ? h('p', { class: 'gu-why', id: reasonId }, reason) : null,
        h('button', {
          class: 'gu-btn gu-primary gu-make-btn', type: 'button', 'data-key': `make:${recipe.id}`,
          'aria-disabled': reason ? 'true' : null, 'aria-describedby': reason ? reasonId : null, 'aria-label': `Make ${made.name}`,
          onclick: () => {
            if (reason) return;
            if (crafting.make(recipe.id)) ctx.sound('click');
            view.render();
          },
        }, 'Make'),
      ),
    );
  };
  /** True when the pane is on screen. A narrow screen has no room for it, and shows the tooltip instead. */
  const paneShown = (): boolean => detail.isConnected && detail.offsetParent !== null;

  // ---- the tooltip: the name, what it is for, and what the item says of itself. It lives in the stage, outside the panel's zoom.
  const tip = h('div', { class: 'gu-tip', id: 'gu-tip', role: 'tooltip', hidden: true });
  let tipFor = -1;
  /** The focus shows a tooltip only once the keys are in use here, so the slot focused as the bag opens shows none. */
  let keyed = false;
  const showTip = (index: number, anchor: HTMLElement): void => {
    if (paneShown() && !drag.active) {
      showDetail(inventory.slots[index] ? index : restingSlot());
      return;
    }
    const stack = inventory.slots[index];
    const stage = body.closest<HTMLElement>('.gu-stage');
    if (!stack || !stage || drag.active) return hideTip();
    if (tip.parentElement !== stage) stage.append(tip);
    if (tipFor !== index) {
      tipFor = index;
      const def = items.get(stack.id);
      const use = itemUse(def);
      tip.replaceChildren();
      add(tip,
        h('div', { class: 'gu-tip-name' }, def.name, stack.count > 1 ? h('span', { class: 'gu-num gu-quiet' }, ` ×${stack.count}`) : null),
        use ? h('p', { class: 'gu-tip-use' }, use) : null,
        h('p', { class: 'gu-tip-text' }, def.description),
        use && index >= QUICK ? h('p', { class: 'gu-tip-note' }, 'Put it in a quick slot to hold it.') : null,
      );
    }
    tip.hidden = false;
    const at = anchor.getBoundingClientRect(), room = stage.getBoundingClientRect(), box = tip.getBoundingClientRect();
    // Above the slot, or below it when the top of the screen is too near. Never past a side.
    const left = Math.min(Math.max(8, at.left - room.left + at.width / 2 - box.width / 2), room.width - box.width - 8);
    const above = at.top - room.top - box.height - 8;
    const top = above >= 8 ? above : at.bottom - room.top + 8;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  function hideTip(): void {
    tip.hidden = true;
    tipFor = -1;
    if (paneShown()) showDetail(restingSlot());
  }

  const click = (index: number, split: boolean): void => {
    if (picked === null) {
      const stack = inventory.slots[index];
      if (!stack) return;
      picked = { index, count: split && stack.count > 1 ? half(stack.count) : undefined };
    } else {
      if (picked.index !== index) inventory.move(picked.index, index, picked.count);
      picked = null;
    }
    ctx.sound('click');
    cursor = index;
    view.render();
  };

  const drag = createSlotDrag({
    area: body,
    layer: () => body.closest<HTMLElement>('.gu-root') ?? body,
    stackAt: (index) => inventory.slots[index] ?? null,
    picture: (stack) => picture(ctx.options.icon(items.get(stack.id).icon), items.get(stack.id).name, 48),
    drop(from, to, count) {
      inventory.move(from, to, count);
      ctx.sound('click');
      cursor = to;
    },
    onStart() {
      picked = null;
      hideTip();
      drawCues();
    },
    onEnd() {
      if (stale) view.render();
      stale = false;
      body.querySelector<HTMLElement>(`[data-key="slot:${cursor}"]`)?.focus({ preventScroll: true });
    },
  });

  // Each slot is an item card: the thing on a warm sky with its count on a cream strip, a quick slot marked by its number key.
  const slotButton = (index: number): HTMLElement => {
    const stack = inventory.slots[index];
    const def = stack ? items.get(stack.id) : null;
    const where = index < QUICK ? `Quick slot ${index + 1}` : `Slot ${index + 1}`;
    const isPicked = picked?.index === index;
    return h('button', {
      class: 'gu-slot gu-item' + (index < QUICK ? ' gu-quick' : '') + (isPicked ? ' gu-picked' : '') + (stack ? '' : ' gu-slot-empty'),
      type: 'button', 'data-key': `slot:${index}`, 'data-slot-drop': index, tabindex: index === cursor ? 0 : -1,
      'aria-label': def && stack ? `${where}: ${def.name}, ${stack.count}` : `${where}: empty`,
      'aria-pressed': isPicked ? 'true' : null,
      'aria-describedby': stack ? 'gu-tip' : null,
      onclick: (event: MouseEvent) => click(index, event.shiftKey),
      onpointerenter: (event: PointerEvent) => { if (event.pointerType !== 'touch') showTip(index, event.currentTarget as HTMLElement); },
      onpointerleave: () => hideTip(),
      onfocus: (event: FocusEvent) => { cursor = index; if (keyed) showTip(index, event.currentTarget as HTMLElement); },
      onblur: () => hideTip(),
    },
      def && stack ? picture(ctx.options.icon(def.icon), def.name, 64) : null,
      index < QUICK ? h('kbd', { class: 'gu-slot-key gu-num', 'aria-hidden': true }, String(index + 1)) : null,
      stack && stack.count > 1 ? h('span', { class: 'gu-slot-count gu-num', 'aria-hidden': true }, String(stack.count)) : null,
    );
  };

  const drawSlots = (): HTMLElement[] => {
    const total = inventory.slots.length;
    const quick = h('div', { class: 'gu-slots gu-slots-quick', role: 'group', 'aria-labelledby': 'gu-quick-label' });
    const rest = h('div', { class: 'gu-slots', role: 'group', 'aria-labelledby': 'gu-bag-label' });
    for (let index = 0; index < total; index++) (index < QUICK ? quick : rest).append(slotButton(index));
    return [
      h('h3', { class: 'gu-sr', id: 'gu-quick-label' }, 'Quick slots'),
      quick,
      h('div', { class: 'gu-bag-rule', 'aria-hidden': true }),
      h('h3', { class: 'gu-sr', id: 'gu-bag-label' }, 'Bag'),
      rest,
    ];
  };

  // A recipe is a card like a slot's: the thing it makes. One that lacks something is dimmed.
  const recipeCard = (recipe: Recipe): HTMLElement => {
    const made = items.get(recipe.makes.id);
    const ready = missingReason(recipe, (id) => inventory.count(id), (id) => items.get(id).name, crafting.canMake(recipe.id)) === null;
    return h('button', {
      class: 'gu-item gu-recipe-card' + (recipe.id === chosen ? ' is-shown' : '') + (ready ? ' gu-ready' : ' gu-item-short'),
      type: 'button', 'data-key': `recipe:${recipe.id}`, 'aria-pressed': String(recipe.id === chosen),
      'aria-label': `${made.name}${ready ? '' : ', not enough to make'}`,
      onclick: () => { chosen = recipe.id; ctx.sound('click'); view.render(); },
    },
      picture(ctx.options.icon(made.icon), made.name, 64),
      recipe.makes.count > 1 ? h('span', { class: 'gu-slot-count gu-num', 'aria-hidden': true }, `×${recipe.makes.count}`) : null,
    );
  };

  body.addEventListener('keydown', (event) => {
    keyed = true;
    if (!(event.target instanceof HTMLElement) || !event.target.matches('.gu-slot')) return;
    const grid = body.querySelector<HTMLElement>('.gu-slots');
    const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : QUICK;
    const next = slotMove(cursor, event.key, columns, inventory.slots.length);
    if (next === cursor) return;
    event.preventDefault();
    event.stopPropagation();
    const from = body.querySelector<HTMLElement>(`[data-key="slot:${cursor}"]`), to = body.querySelector<HTMLElement>(`[data-key="slot:${next}"]`);
    if (!to) return;
    if (from) from.tabIndex = -1;
    to.tabIndex = 0;
    to.focus();
  });

  const view: PanelView = {
    title: 'Bag',
    className: 'gu-panel-bag',
    head: tabs,
    body,
    screen: { icon: 'bag', cues },
    render() {
      // Drawing the slots again would drop the slot the pointer holds, so a change during a drag waits for its end.
      if (drag.active) {
        stale = true;
        return;
      }
      hideTip();
      keepFocus(body.closest<HTMLElement>('.gu-panel') ?? body, () => {
        tabs.replaceChildren(tabButton('things', 'things', 'Things'), tabButton('hand', 'by-hand', 'By hand'));
        body.classList.toggle('gu-bag-things', tab === 'things');
        body.classList.toggle('gu-bag-hand', tab === 'hand');
        drawCues();
        detailFor = undefined;
        if (tab === 'things') {
          body.replaceChildren(h('div', { class: 'gu-bag-grid' }, ...drawSlots()), detail);
          showDetail(restingSlot());
        } else {
          const byHand = crafting.available().filter((recipe) => recipe.station === 'hand');
          if (!byHand.some((recipe) => recipe.id === chosen)) chosen = (byHand.find((recipe) => crafting.canMake(recipe.id)) ?? byHand[0])?.id ?? null;
          body.replaceChildren(h('div', { class: 'gu-recipe-grid', role: 'group', 'aria-label': 'Made by hand' }, ...byHand.map(recipeCard)), detail);
          showRecipe(byHand.find((recipe) => recipe.id === chosen) ?? null);
        }
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
