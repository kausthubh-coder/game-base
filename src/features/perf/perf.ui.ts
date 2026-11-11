// The meter's panel: a few lines of numbers, the quality buttons and the copy button.
import { LEVELS } from '../../content/quality.ts';

export interface PerfPanel {
  root: HTMLElement;
  /** Sets the text of the numbers. One string with line breaks. */
  setText(text: string): void;
  /** Marks the pressed button: 'auto' or a level. */
  setMode(mode: string): void;
  /** Shows a short note next to the copy button, for example "copied". */
  flash(note: string): void;
  dispose(): void;
}

const STYLE = `
.perf-meter { position: fixed; top: 8px; left: 8px; z-index: 20; min-width: 208px; padding: 8px 10px;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums;
  color: #e8eaee; background: rgba(16, 20, 26, 0.78); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px;
  user-select: none; }
.perf-meter pre { margin: 0 0 6px; font: inherit; white-space: pre; }
.perf-meter .row { display: flex; gap: 4px; align-items: center; }
.perf-meter .row + .row { margin-top: 4px; }
.perf-meter button { font: inherit; color: inherit; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px; padding: 2px 7px; cursor: pointer; }
.perf-meter button:hover { background: rgba(255, 255, 255, 0.16); }
.perf-meter button:focus-visible { outline: 2px solid #7fd4ff; outline-offset: 1px; }
.perf-meter button[aria-pressed="true"] { background: #e8eaee; color: #10141a; border-color: #e8eaee; }
.perf-meter .note { opacity: 0.7; margin-left: 4px; }
`;

export function createPerfPanel(parent: HTMLElement, onMode: (mode: string) => void, onCopy: () => void): PerfPanel {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  const root = document.createElement('div');
  root.className = 'perf-meter';
  const text = document.createElement('pre');
  const modes = document.createElement('div');
  modes.className = 'row';
  const buttons = new Map<string, HTMLButtonElement>();
  for (const mode of ['auto', ...LEVELS]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = mode;
    button.title = mode === 'auto' ? 'Lower the render size, then effects, when the frame rate drops' : `Hold quality at ${mode}`;
    button.addEventListener('click', () => onMode(mode));
    buttons.set(mode, button);
    modes.append(button);
  }
  const actions = document.createElement('div');
  actions.className = 'row';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'copy report';
  const note = document.createElement('span');
  note.className = 'note';
  copy.addEventListener('click', onCopy);
  actions.append(copy, note);
  root.append(text, modes, actions);
  parent.append(root);

  let timer = 0;
  return {
    root,
    setText(value) {
      text.textContent = value;
    },
    setMode(mode) {
      for (const [name, button] of buttons) button.setAttribute('aria-pressed', String(name === mode));
    },
    flash(value) {
      note.textContent = value;
      clearTimeout(timer);
      timer = window.setTimeout(() => { note.textContent = ''; }, 1600);
    },
    dispose() {
      clearTimeout(timer);
      root.remove();
      style.remove();
    },
  };
}
