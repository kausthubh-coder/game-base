// The quest log: the open quests first, each with its chapter, its summary and its steps, the open step's how-to line
// under it, and the done ones after, struck through. When more than one quest is open (the three vaults), the one
// the tracker follows says so, and each other has a Follow button.

import type { QuestView } from '../api.sim.ts';
import { CHAPTER_TITLES, type Chapter } from '../content/quests.ts';
import { h } from './dom.ui.ts';
import type { PanelView, UiContext } from './types.ui.ts';

function quest(ctx: UiContext, view: QuestView, tracked: boolean, several: boolean): HTMLElement {
  const done = view.state === 'done';
  const open = done ? -1 : view.steps.findIndex((step) => !step.done);
  const chapter = view.chapter ? CHAPTER_TITLES[view.chapter as Chapter] : '';
  return h('section', { class: `gu-quest${done ? ' gu-quest-done' : ''}${tracked && several ? ' gu-quest-tracked' : ''}`, 'data-quest': view.id },
    done || !chapter ? null : h('p', { class: 'gu-quest-chapter' }, `Chapter ${view.chapter} · ${chapter}`),
    h('h3', { class: 'gu-quest-title' }, view.title,
      done ? h('span', { class: 'gu-label gu-quest-state' }, 'Done') : null,
      !done && several && tracked ? h('span', { class: 'gu-label gu-quest-following' }, 'Following') : null,
      !done && several && !tracked
        ? h('button', { class: 'gu-btn gu-quest-follow', type: 'button', 'data-key': `quests:follow:${view.id}`, onclick: () => ctx.game.systems.quests.track?.(view.id) }, 'Follow')
        : null,
    ),
    done ? null : h('p', { class: 'gu-quest-summary' }, view.summary),
    h('ul', { class: 'gu-steps' },
      ...view.steps.map((step, i) =>
        h('li', { class: step.done ? 'gu-step gu-step-done' : i === open ? 'gu-step gu-step-open' : 'gu-step' },
          h('span', { class: 'gu-step-mark', 'aria-hidden': true }),
          step.done ? h('s', { class: 'gu-step-text' }, step.text) : h('span', { class: 'gu-step-text' }, step.text),
          step.need !== undefined && !step.done
            ? h('span', { class: 'gu-num gu-quiet', 'aria-label': `${step.have ?? 0} of ${step.need}` }, `${step.have ?? 0}/${step.need}`)
            : null,
          i === open && step.hint ? h('span', { class: 'gu-step-hint' }, step.hint) : null,
        ),
      ),
    ),
  );
}

export function questsPanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-quests' });
  const panel: PanelView = {
    title: 'Quests',
    className: 'gu-panel-quests',
    body,
    render() {
      const quests = ctx.game.systems.quests;
      const all = quests.all().filter((view) => view.state !== 'hidden');
      const active = all.filter((view) => view.state === 'active');
      // The newest done first: the one just finished is the one the player remembers.
      const done = all.filter((view) => view.state === 'done').reverse();
      const tracked = quests.tracked()?.id;
      body.replaceChildren();
      if (all.length === 0) body.append(h('p', { class: 'gu-empty' }, 'No quests yet.'));
      for (const view of active) body.append(quest(ctx, view, view.id === tracked, active.length > 1));
      for (const view of done) body.append(quest(ctx, view, false, false));
      // Following another quest redraws the log at once.
      for (const button of body.querySelectorAll<HTMLButtonElement>('.gu-quest-follow')) button.addEventListener('click', () => panel.render());
    },
  };
  return panel;
}
