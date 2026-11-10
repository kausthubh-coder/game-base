// The touch controls: a move stick on the left and round buttons on the right. They write straight
// into the raw input, so a thumb on a button is the same to the rules as a key.
import './input.css';
import { TOUCH_CODE, stickFromOffset, type Action, type RawInput } from './intents.sim.ts';

export interface TouchControls {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** How far the knob travels from the middle of the stick, in pixels. A thumb this far out is a full push. */
const TRAVEL = 44;

const ICON: Record<string, string> = {
  jump: 'M12 19V6M6 11l6-6 6 6',
  interact: 'M4 5h16v10H11l-5 4v-4H4z',
  use: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
  place: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
  turnLeft: 'M9 4L4 9l5 5M4 9h9a6 6 0 0 1 0 12h-2',
  turnRight: 'M15 4l5 5-5 5M20 9h-9a6 6 0 0 0 0 12h2',
};

const BUTTONS: readonly { action: Action; label: string }[] = [
  { action: 'jump', label: 'Jump' },
  { action: 'use', label: 'Use' },
  { action: 'interact', label: 'Talk' },
  { action: 'place', label: 'Place' },
  { action: 'turnLeft', label: 'Turn the camera left' },
  { action: 'turnRight', label: 'Turn the camera right' },
];

/** Keeps a finger's events coming to the element it went down on. A pointer that is already gone cannot be captured, and that is fine. */
function capture(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The pointer ended between the event and now.
  }
}

export function createTouchControls(parent: HTMLElement, raw: RawInput): TouchControls {
  const stop = new AbortController();
  const signal = stop.signal;
  const root = document.createElement('div');
  root.className = 'gb-touch';
  root.hidden = true;

  const stick = document.createElement('div');
  stick.className = 'gb-touch-stick';
  stick.setAttribute('role', 'application');
  stick.setAttribute('aria-label', 'Move stick');
  const knob = document.createElement('div');
  knob.className = 'gb-touch-knob';
  stick.append(knob);

  const offset = { x: 0, y: 0 };
  let thumb = -1;
  const release = (): void => {
    thumb = -1;
    raw.stickX = raw.stickY = 0;
    knob.style.transform = '';
    stick.classList.remove('is-held');
  };
  const push = (e: PointerEvent): void => {
    const box = stick.getBoundingClientRect();
    stickFromOffset(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2), TRAVEL, offset);
    raw.stickX = offset.x;
    raw.stickY = offset.y;
    knob.style.transform = `translate(${(offset.x * TRAVEL).toFixed(1)}px, ${(-offset.y * TRAVEL).toFixed(1)}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    if (thumb !== -1) return;
    e.preventDefault();
    thumb = e.pointerId;
    capture(stick, e.pointerId);
    stick.classList.add('is-held');
    push(e);
  }, { signal });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === thumb) push(e); }, { signal });
  const lift = (e: PointerEvent): void => { if (e.pointerId === thumb) release(); };
  stick.addEventListener('pointerup', lift, { signal });
  stick.addEventListener('pointercancel', lift, { signal });
  stick.addEventListener('lostpointercapture', lift, { signal });

  const pad = document.createElement('div');
  pad.className = 'gb-touch-pad';
  for (const { action, label } of BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gb-touch-button gb-touch-${action}`;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[action]}"/></svg>`;
    const code = TOUCH_CODE[action];
    const up = (): void => {
      raw.held.delete(code);
      button.classList.remove('is-held');
    };
    button.addEventListener('pointerdown', (e) => {
      // No focus and no page gesture: the button is a key, and the next thumb must not be delayed.
      e.preventDefault();
      capture(button, e.pointerId);
      raw.held.add(code);
      raw.pressed.add(code);
      button.classList.add('is-held');
    }, { signal });
    button.addEventListener('pointerup', up, { signal });
    button.addEventListener('pointercancel', up, { signal });
    button.addEventListener('lostpointercapture', up, { signal });
    // A keyboard or a screen reader presses it with a click that no pointer started.
    button.addEventListener('click', (e) => { if (e.detail === 0) raw.pressed.add(code); }, { signal });
    button.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    pad.append(button);
  }

  root.append(stick, pad);
  parent.append(root);

  return {
    element: root,
    setVisible(visible) {
      if (root.hidden === !visible) return;
      root.hidden = !visible;
      if (!visible) {
        release();
        for (const { action } of BUTTONS) raw.held.delete(TOUCH_CODE[action]);
      }
    },
    dispose() {
      stop.abort();
      root.remove();
    },
  };
}
