// The Account panel's contents: who you are, and where your save is. It is drawn into one
// element that the host puts inside its own panel frame. The pieces carry the host's class names (`look`),
// so buttons, headings and notes look as they do in the host's other panels. The few rules of its own
// below read the host's color and spacing variables and fall back to plain values without them.
import type { Account, AccountState } from './account.ts';
import { agoText } from './logic.ts';

/** The host's class names for the pieces the panel is built from. */
export interface AccountLook {
  /** A button, and the one button that is the next thing to do. */
  button: string;
  primary: string;
  /** A block with a heading, and that heading. */
  section: string;
  label: string;
  /** A small line of explanation. */
  note: string;
}

export interface Panel {
  readonly node: HTMLElement;
  /** Brings the panel in line with the account. It also runs by itself after every change. */
  draw(): void;
  dispose(): void;
}

export interface PanelOptions {
  look?: Partial<AccountLook>;
  now: () => number;
}

const STYLE = /* css */ `
.acct { width: 520px; max-width: 100%; }
/* :where keeps the reset weightless, so the rules below can set a margin. */
.acct :where(p, ul) { margin: 0; padding: 0; list-style: none; }
.acct p { max-width: 60ch; text-wrap: pretty; }
.acct-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2, 8px) var(--s3, 12px); }
.acct-part > * + * { margin-top: var(--s3, 12px); }
.acct-name { margin-right: auto; font-size: 20px; font-weight: 650; letter-spacing: -0.015em; overflow-wrap: anywhere; }
.acct-quiet { color: var(--ink-2, #6b6258); }
.acct-input {
  flex: 1 1 180px; min-width: 0; min-height: var(--target, 40px); padding: 0 var(--s3, 12px);
  border: 0; border-radius: var(--radius, 10px); background: var(--paper-light, #fff);
  box-shadow: inset 0 0 0 1px var(--line-strong, rgb(0 0 0 / 0.28)); user-select: text; -webkit-user-select: text;
}
.acct-status[data-kind='problem'] { color: var(--new, #a25f00); }
.acct-status[data-kind='done'] { color: var(--done, #2f7d4f); }
.acct-status:empty { display: none; }
`;

type Attr = string | boolean | null | undefined | ((event: never) => void);
type Child = Node | string | null | undefined | false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, Attr> | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') node.addEventListener(name.slice(2), value as EventListener);
    else node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

export function createPanel(account: Account, options: PanelOptions): Panel {
  const look: AccountLook = { button: 'acct-button', primary: 'acct-button acct-primary', section: 'acct-section', label: 'acct-label', note: 'acct-quiet', ...options.look };
  const { now } = options;

  const status = el('p', { class: 'acct-status', role: 'status' });
  /** The name being typed, or null when the name is not being changed. */
  let draft: string | null = null;

  const button = (key: string, label: string, onclick: () => void, extra: { primary?: boolean; disabled?: boolean } = {}): HTMLButtonElement =>
    el('button', { class: extra.primary ? look.primary : look.button, type: 'button', 'data-key': key, disabled: extra.disabled, onclick }, label);
  const note = (text: string): HTMLElement => el('p', { class: look.note }, text);
  const row = (...children: Child[]): HTMLElement => el('div', { class: 'acct-row' }, ...children);

  // ---- the three parts. Each returns what goes under its heading.

  function you(state: Readonly<AccountState>): Child[] {
    if (state.status !== 'signedIn') {
      const guest = el('p', null, 'You are playing as a guest. This world is saved in this browser and nowhere else.');
      if (state.status === 'off') return [guest, row(button('sign-in', 'Sign in', () => {}, { primary: true, disabled: true })), note('Sign-in is not set up in this copy of the game.')];
      if (state.status === 'failed') return [guest, row(button('retry', 'Try again', () => void account.connect(), { primary: true })), note('Sign-in could not be reached. Check the connection.')];
      const loaded = state.status === 'signedOut';
      return [
        guest,
        row(button('sign-in', 'Sign in', () => account.signIn(), { primary: true, disabled: !loaded })),
        note(loaded ? 'Sign in to keep this world in your account, and to play it on any device.' : 'Getting sign-in ready.'),
      ];
    }
    const busy = state.busy !== null;
    if (draft !== null) {
      const input = el('input', {
        class: 'acct-input', type: 'text', 'data-key': 'name', maxlength: '24', autocomplete: 'nickname', 'aria-label': 'Your name', value: draft,
        oninput: (event: Event) => { draft = (event.target as HTMLInputElement).value; },
        onkeydown: (event: KeyboardEvent) => { if (event.key === 'Enter') saveName(); },
      });
      return [
        row(input, button('name-save', state.busy === 'rename' ? 'Saving' : 'Save name', saveName, { primary: true, disabled: busy }), button('name-keep', 'Cancel', () => { draft = null; draw(); focus('name-change'); })),
        state.email ? el('p', { class: 'acct-quiet' }, state.email) : null,
      ];
    }
    return [
      row(
        el('span', { class: 'acct-name' }, state.name ?? ''),
        button('name-change', 'Change name', () => { draft = state.name ?? ''; draw(); focus('name'); }, { disabled: !state.ready || busy }),
        button('sign-out', state.busy === 'signOut' ? 'Signing out' : 'Sign out', () => void account.signOut(), { disabled: busy }),
      ),
      state.email ? el('p', { class: 'acct-quiet' }, state.email) : null,
    ];
  }

  function saveName(): void {
    if (draft === null) return;
    void account.rename(draft).then((stored) => {
      if (stored) draft = null;
      draw();
      focus(stored ? 'name-change' : 'name');
    });
  }

  function yourSave(state: Readonly<AccountState>): Child[] {
    const here = account.localSave();
    const conflict = state.conflict;
    if (conflict) {
      const fetching = state.sync === 'fetching';
      return [
        el('p', null, 'This browser and your account each have a save that changed since they last matched. Which one do you want to play?'),
        el('p', null, `In this browser: day ${conflict.here.day}, saved ${agoText(conflict.here.at, now())}.`),
        el('p', null, `In your account: day ${conflict.there.day}, saved ${agoText(conflict.there.savedAt, now())}.`),
        row(
          button('keep-there', fetching ? 'Fetching' : 'Play the account\'s', () => void account.keep('there'), { primary: true, disabled: state.sync !== 'idle' }),
          button('keep-here', state.sync === 'sending' ? 'Saving' : 'Play this browser\'s', () => void account.keep('here'), { disabled: state.sync !== 'idle' }),
        ),
        note('Playing the account\'s keeps this browser\'s save aside here. Playing this browser\'s replaces the one in your account.'),
        status,
      ];
    }
    const cloud = state.cloud;
    let there: string;
    if (cloud === undefined) there = state.ready ? 'Reading your account.' : 'Reaching your account.';
    else if (state.sync === 'sending') there = 'Saving to your account.';
    else if (state.sync === 'fetching') there = 'Fetching the save from your account.';
    else if (cloud === null) there = here ? 'Not in your account yet. It goes up within a minute.' : 'Your account has no save yet.';
    else there = `In your account: day ${cloud.day}, saved ${agoText(cloud.savedAt, now())}.`;
    return [
      el('p', null, here ? `In this browser: day ${here.day}, saved ${agoText(here.at, now())}.` : 'Nothing is saved in this browser yet.'),
      el('p', null, there),
      note('Your save goes to your account as you play, and any device you sign in on picks it up.'),
      // How the last save or rename went.
      status,
    ];
  }

  // ---- the element

  const node = el('div', { class: 'acct' }, el('style', null, STYLE));
  const part = (key: string, heading: string): HTMLElement => el('section', { class: `acct-part ${look.section}`, 'data-part': key, 'aria-label': heading });
  /** `shows` lists what a part is drawn from. The part is drawn again only when that changes, so typing a name is not cut short by a world list that moved. */
  interface Part {
    node: HTMLElement;
    heading: string;
    build(state: Readonly<AccountState>): Child[];
    shows(state: Readonly<AccountState>, minute: number): unknown[];
    signedInOnly: boolean;
    drawn: string;
  }
  const parts: Part[] = [
    { node: part('you', 'You'), heading: 'You', build: you, shows: (s) => [s.status, s.name, s.email, s.ready, s.busy, draft === null], signedInOnly: false, drawn: '' },
    { node: part('save', 'Your save'), heading: 'Your save', build: yourSave, shows: (s, minute) => [s.cloud === undefined ? 'unread' : s.cloud, s.ready, s.sync, s.conflict, account.localSave(), minute], signedInOnly: true, drawn: '' },
  ];
  for (const each of parts) node.append(each.node);

  const focus = (key: string): void => node.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus({ preventScroll: true });

  function draw(): void {
    const state = account.state;
    if (state.status !== 'signedIn') draft = null;
    // The words about time change by the minute.
    const minute = Math.floor(now() / 60_000);
    for (const each of parts) {
      each.node.hidden = each.signedInOnly && state.status !== 'signedIn';
      const stamp = JSON.stringify(each.shows(state, minute));
      if (each.node.hidden || each.drawn === stamp) continue;
      each.drawn = stamp;
      // A part that is drawn again keeps the focus on the button it was on.
      const held = document.activeElement instanceof HTMLElement && each.node.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
      each.node.replaceChildren(el('h3', { class: look.label }, each.heading), ...each.build(state).filter((child): child is Node | string => Boolean(child)));
      if (held) focus(held);
    }
    status.textContent = state.note?.text ?? '';
    status.dataset.kind = state.note?.kind ?? '';
  }

  const stop = account.onChange(draw);
  draw();
  return {
    node,
    draw,
    dispose() {
      stop();
      node.remove();
    },
  };
}
