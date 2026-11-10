// The View section of Settings: how the camera stands and how characters are drawn. It sits at the top of
// the right-hand column, above Keys. Graphics settings belong in the left-hand column with Picture quality.
import { h } from './dom.ui.ts';
import type { UiContext, ViewCamera, ViewCharacters, ViewChoices } from './types.ui.ts';

const CAMERAS: readonly ViewCamera[] = ['tilt', 'free', 'first'];
const CAMERA_NAMES = ['2.5D', 'Free', 'First person'];
const LOOKS: readonly ViewCharacters[] = ['sprites', 'models'];
const LOOK_NAMES = ['Sprites', '3D models'];

/** A row of choices where one is picked: radio buttons drawn as a strip, as the other settings are. */
function strip<T extends string>(name: string, legend: string, values: readonly T[], labels: readonly string[], current: T, pick: (value: T) => void, gap = false): HTMLElement {
  const row = h('div', { class: 'gu-strip' });
  values.forEach((value, i) => {
    row.append(
      h('label', { class: 'gu-choice' },
        h('input', { type: 'radio', name: `gu-${name}`, value, checked: value === current, 'data-key': `view:${name}:${value}`, onchange: () => pick(value) }),
        h('span', null, labels[i]),
      ),
    );
  });
  return h('fieldset', { class: 'gu-choices', style: gap ? 'margin-top: var(--s5)' : null }, h('legend', { class: 'gu-label' }, legend), row);
}

export function viewSection(ctx: UiContext, view: ViewChoices): HTMLElement {
  return h('section', { class: 'gu-section gu-view' },
    h('h3', { class: 'gu-label' }, 'View'),
    strip('camera', 'Camera', CAMERAS, CAMERA_NAMES, view.camera(), (mode) => { ctx.sound('click'); view.setCamera(mode); }),
    strip('characters', 'Characters', LOOKS, LOOK_NAMES, view.characters(), (look) => { ctx.sound('click'); view.setCharacters(look); }, true),
  );
}
