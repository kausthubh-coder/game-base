// The quest list: each quest the player has met with its steps, done ones struck through.

import type { QuestView } from '../api.sim.ts';
import { h } from './dom.ui.ts';
import type { PanelView, UiContext } from './types.ui.ts';

function quest(view: QuestView): HTMLElement {
  const done = view.state === 'done';
  return h('section', { class: done ? 'gu-quest gu-quest-done' : 'gu-quest' },
    h('h3', { class: 'gu-quest-title' }, view.title, done ? h('span', { class: 'gu-label gu-quest-state' }, 'Done') : null),
    done ? null : h('p', { class: 'gu-quest-summary' }, view.summary),
    h('ul', { class: 'gu-steps' },
      ...view.steps.map((step) =>
        h('li', { class: step.done ? 'gu-step gu-step-done' : 'gu-step' },
          h('span', { class: 'gu-step-mark', 'aria-hidden': true }),
          step.done ? h('s', { class: 'gu-step-text' }, step.text) : h('span', { class: 'gu-step-text' }, step.text),
          step.need !== undefined && !step.done
            ? h('span', { class: 'gu-num gu-quiet', 'aria-label': `${step.have ?? 0} of ${step.need}` }, `${step.have ?? 0}/${step.need}`)
            : null,
        ),
      ),
    ),
  );
}

export function questsPanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-quests' });
  return {
    title: 'Quests',
    className: 'gu-panel-quests',
    body,
    render() {
      const all = ctx.game.systems.quests.all().filter((view) => view.state !== 'hidden');
      const active = all.filter((view) => view.state === 'active');
      const done = all.filter((view) => view.state === 'done');
      body.replaceChildren();
      if (all.length === 0) body.append(h('p', { class: 'gu-empty' }, 'No quests yet. Talk to Tamsin at the grant stone.'));
      for (const view of [...active, ...done]) body.append(quest(view));
    },
  };
}
