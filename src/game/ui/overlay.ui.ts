// What sits over the game without stopping it: the prompt, hints, toasts, the Almanac's note and the breaking ring.

import { h, keycaps, picture } from './dom.ui.ts';
import { addToast, expireToasts, type ToastLine } from './logic.ui.ts';
import type { UiContext } from './types.ui.ts';

const HINT_LIFE = 6000;
const NOTE_LIFE = 6000;
const RING = 2 * Math.PI * 13;

export interface Overlay {
  node: HTMLElement;
  /** Called once a frame with the time in milliseconds and whether a panel is open. */
  update(now: number, panelOpen: boolean): void;
  hint(id: string, text: string): void;
  toast(text: string, icon: string | undefined): void;
  /** Shows "The Almanac wrote something" for a page. */
  note(page: string): void;
  clearNote(): void;
  /** While held, the hint and the note step aside and their time stands still, so a story card has the top of the screen. */
  hold(on: boolean): void;
  /** A hint with this id is never shown, because something else on screen already says it. */
  skip(id: string): void;
}

export function createOverlay(ctx: UiContext, now: () => number): Overlay {
  const { game, options } = ctx;

  // The prompt.
  const promptText = h('span', null);
  const prompt = h('div', { class: 'gu-prompt', hidden: true }, keycaps(['E']), promptText);
  prompt.style.bottom = `${options.hudBottom ?? 96}px`;
  let promptShown: string | null = null;

  // Hints, one at a time, and the Almanac's note under them.
  const hintText = h('p', { class: 'gu-hint-text' });
  const hintCard = h('div', { class: 'gu-card gu-hint', hidden: true },
    hintText,
    h('button', { class: 'gu-close', type: 'button', 'aria-label': 'Dismiss the hint', onclick: () => nextHint() }, '×'),
  );
  const noteButton = h('button', { class: 'gu-card gu-note', type: 'button', hidden: true, onclick: () => { const page = notePage; clearNote(); if (page) ctx.ui.open('almanac', page); } },
    h('span', null, 'The Almanac wrote something'),
    keycaps(['Tab']),
  );
  const top = h('div', { class: 'gu-top', role: 'status' }, hintCard, noteButton);
  const hints: { id: string; text: string }[] = [];
  const skipped = new Set<string>();
  let hintUntil = 0;
  let noteUntil = 0;
  let notePage: string | null = null;
  /** One card at a time at the top: the hint, then the note once no hint is up. */
  let noteWaiting = false;
  let held = false;
  let lastTime = 0;

  const showHint = (): void => {
    const hint = hints[0];
    hintCard.hidden = !hint;
    if (hint) {
      hintText.textContent = hint.text;
      hintUntil = now() + HINT_LIFE;
      noteButton.hidden = true;
    } else if (noteWaiting && notePage) {
      noteWaiting = false;
      noteButton.hidden = false;
      noteUntil = now() + NOTE_LIFE;
    }
  };
  const nextHint = (): void => {
    hints.shift();
    showHint();
  };
  const clearNote = (): void => {
    notePage = null;
    noteWaiting = false;
    noteButton.hidden = true;
  };

  // Toasts.
  const toastList = h('div', { class: 'gu-toasts', role: 'status' });
  const toasts: ToastLine[] = [];
  const toastNodes = new Map<number, { row: HTMLElement; count: HTMLElement }>();
  const drawToasts = (): void => {
    for (const [key, entry] of toastNodes) {
      if (!toasts.some((line) => line.key === key)) {
        entry.row.remove();
        toastNodes.delete(key);
      }
    }
    for (const line of toasts) {
      let entry = toastNodes.get(line.key);
      if (!entry) {
        const count = h('span', { class: 'gu-num gu-toast-count' });
        const row = h('div', { class: 'gu-toast' }, line.icon ? picture(options.icon(line.icon), line.icon, 24) : null, h('span', { class: 'gu-toast-text' }, line.text), count);
        entry = { row, count };
        toastNodes.set(line.key, entry);
        toastList.append(row);
      }
      const label = line.count > 1 ? `×${line.count}` : '';
      if (entry.count.textContent !== label) entry.count.textContent = label;
    }
  };

  // The breaking ring.
  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.innerHTML = '<circle class="gu-ring-edge" cx="16" cy="16" r="13"/><circle class="gu-ring-track" cx="16" cy="16" r="13"/>';
  arc.setAttribute('class', 'gu-ring-arc');
  arc.setAttribute('cx', '16');
  arc.setAttribute('cy', '16');
  arc.setAttribute('r', '13');
  arc.setAttribute('stroke-dasharray', String(RING));
  svg.append(arc);
  const ring = h('div', { class: 'gu-ring', hidden: true, 'aria-hidden': true }, svg);
  let ringProgress = -1;

  const node = h('div', { class: 'gu-over' }, ring, top, prompt, toastList);

  return {
    node,
    update(time, panelOpen) {
      const target = panelOpen || game.player.busy ? null : game.systems.interact.nearest();
      const words = target ? target.prompt() : null;
      if (words !== promptShown) {
        promptShown = words;
        prompt.hidden = words === null;
        if (words !== null) promptText.textContent = words;
      }

      const breaking = panelOpen ? null : game.systems.actions.breaking();
      const at = breaking ? options.project(breaking.x + 0.5, breaking.y + 0.5, breaking.z + 0.5) : null;
      if (breaking && at) {
        if (ring.hidden) ring.hidden = false;
        ring.style.transform = `translate(${Math.round(at.x) - 16}px, ${Math.round(at.y) - 16}px)`;
        if (breaking.progress !== ringProgress) {
          ringProgress = breaking.progress;
          arc.setAttribute('stroke-dashoffset', String(RING * (1 - Math.min(1, Math.max(0, ringProgress)))));
        }
      } else if (!ring.hidden) {
        ring.hidden = true;
        ringProgress = -1;
      }

      // Held, the cards' time stands still.
      if (held) {
        hintUntil += time - lastTime;
        noteUntil += time - lastTime;
      }
      lastTime = time;
      if (hints.length && time >= hintUntil) nextHint();
      if (notePage && !noteWaiting && time >= noteUntil) clearNote();
      if (toasts.length && expireToasts(toasts, time)) drawToasts();
    },
    hint(id, text) {
      if (skipped.has(id) || hints.some((hint) => hint.id === id)) return;
      hints.push({ id, text });
      if (hints.length === 1) showHint();
    },
    toast(text, icon) {
      addToast(toasts, text, icon, now());
      drawToasts();
    },
    note(page) {
      notePage = page;
      if (hints.length) {
        noteWaiting = true;
        return;
      }
      noteUntil = now() + NOTE_LIFE;
      noteButton.hidden = false;
    },
    clearNote,
    hold(on) {
      held = on;
      top.classList.toggle('gu-held', on);
    },
    skip(id) {
      skipped.add(id);
      if (hints.some((hint) => hint.id === id)) {
        const showing = hints[0]?.id === id;
        hints.splice(hints.findIndex((hint) => hint.id === id), 1);
        if (showing) showHint();
      }
    },
  };
}
