// The Account panel's contents: who you are, this world's backup, and your worlds. It is drawn into one
// element that the host puts inside its own panel frame. The pieces carry the host's class names (`look`),
// so buttons, headings and notes look as they do in the host's other panels. The few rules of its own
// below read the host's color and spacing variables and fall back to plain values without them.
import type { Account, AccountState } from './account.ts';
import { agoText, backupOf, sizeText, worldLine } from './logic.ts';

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
  /** The save slot whose backup the panel is about. */
  slot: string;
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
.acct-worlds .acct-row { margin-top: var(--s2, 8px); }
.acct-worlds li + li { margin-top: var(--s3, 12px); padding-top: var(--s3, 12px); border-top: 1px solid var(--line, rgb(0 0 0 / 0.12)); }
.acct-world-name { font-weight: 600; overflow-wrap: anywhere; }
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
  const { slot, now } = options;

  const status = el('p', { class: 'acct-status', role: 'status' });
  /** True while the panel asks whether to replace this world with the backup. */
  let asking = false;
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
        note(loaded ? 'Sign in to back this world up, and to restore it on another device.' : 'Getting sign-in ready.'),
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

  function thisWorld(state: Readonly<AccountState>): Child[] {
    const here = account.localSave();
    const backup = state.worlds ? backupOf(state.worlds, slot) : null;
    const busy = state.busy !== null;
    const lines = [
      el('p', null, here ? `In this browser: day ${here.day}, saved ${agoText(here.at, now())}.` : 'Nothing is saved in this browser yet.'),
      el('p', null, state.worlds === null ? (state.ready ? 'Reading your backup.' : 'Reaching your account.') : backup ? `Backed up: day ${backup.day}, ${sizeText(backup.bytes)}, ${agoText(backup.uploadedAt, now())}.` : 'Not backed up yet.'),
    ];
    if (asking && backup) {
      return [
        ...lines,
        el('p', null, `Restoring replaces the world in this browser with the backup from day ${backup.day}. ${here ? 'The world you have now is kept aside in this browser.' : ''}`),
        row(
          button('restore-yes', state.busy === 'restore' ? 'Restoring' : 'Replace this world', () => void account.restore().then((restored) => { if (!restored) { asking = false; draw(); } }), { disabled: busy }),
          button('restore-no', 'Keep this world', () => { asking = false; draw(); focus('restore'); }, { primary: true, disabled: busy }),
        ),
        status,
      ];
    }
    return [
      ...lines,
      row(
        button('backup', state.busy === 'backup' ? 'Backing up' : 'Back up this world', () => void account.backUp(), { primary: true, disabled: !state.ready || busy || !here }),
        button('restore', 'Restore', () => { asking = true; draw(); focus('restore-no'); }, { disabled: !backup || busy }),
      ),
      // How the last backup, restore or rename went, under the buttons that started it.
      status,
    ];
  }

  /** Play together: a world on the server, and the link that lets a friend into it. */
  function together(state: Readonly<AccountState>): Child[] {
    if (!account.online) return [];
    const busy = state.busy !== null;
    const link = state.link;
    if (!link) {
      return [
        row(button('together', state.busy === 'world' ? 'Making a world' : 'Play together', () => void account.playTogether(), { primary: true, disabled: !state.ready || busy })),
        note('Makes a world on the server that you and up to seven friends play in at once.'),
      ];
    }
    const field = el('input', { class: 'acct-input', type: 'text', 'data-key': 'link', readonly: true, 'aria-label': 'The link to send', value: link.url, onfocus: (event: FocusEvent) => (event.target as HTMLInputElement).select() });
    const copyButton = button('copy', 'Copy link', () => {
      field.select();
      // Where the clipboard is not allowed, the link is selected for the player to copy by hand.
      void navigator.clipboard?.writeText(link.url).then(() => { copyButton.textContent = 'Copied'; }, () => undefined);
    });
    return [
      row(field, copyButton),
      note('The link lets one friend in. Make a new one for each friend.'),
      row(button('enter', 'Enter the world', () => account.enter(link.worldId), { primary: true }), button('invite', 'New link', () => void account.inviteTo(link.worldId), { disabled: busy })),
    ];
  }

  function yourWorlds(state: Readonly<AccountState>): Child[] {
    if (state.worlds === null) return [note(state.ready ? 'Reading your worlds.' : 'Reaching your account.')];
    const top = together(state);
    if (state.worlds.length === 0) return [...top, note('No worlds yet. A world you back up shows here, and so will the worlds friends invite you to.')];
    const list = el('ul', { class: 'acct-worlds' });
    for (const world of state.worlds) {
      const online = world.kind === 'online' && account.online;
      list.append(el('li', { 'data-world': world._id },
        el('div', { class: 'acct-world-name' }, world.name),
        el('div', { class: 'acct-quiet' }, worldLine(world, now())),
        online ? row(
          button(`enter-${world._id}`, 'Enter', () => account.enter(world._id)),
          world.role === 'owner' ? button(`invite-${world._id}`, 'Link for a friend', () => void account.inviteTo(world._id), { disabled: state.busy !== null }) : null,
        ) : null,
      ));
    }
    return [...top, list];
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
    { node: part('world', 'This world'), heading: 'This world', build: thisWorld, shows: (s, minute) => [s.worlds, s.ready, s.busy, asking, account.localSave(), minute], signedInOnly: true, drawn: '' },
    { node: part('worlds', 'Your worlds'), heading: 'Your worlds', build: yourWorlds, shows: (s, minute) => [s.worlds, s.ready, s.busy, s.link, minute], signedInOnly: true, drawn: '' },
  ];
  for (const each of parts) node.append(each.node);

  const focus = (key: string): void => node.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus({ preventScroll: true });

  function draw(): void {
    const state = account.state;
    if (state.status !== 'signedIn') {
      asking = false;
      draft = null;
    }
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
