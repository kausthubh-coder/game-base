// The account: who is signed in, and the copy of their save that follows them to every device. It starts
// as a guest and stays one until `connect` is called, so a game with no keys, or a player who never signs
// in, loads nothing from Clerk or Convex.
//
// Signed in, the save goes both ways by itself. Every `syncEvery` and whenever the page is hidden, the save
// here is compared with the account's copy and with the mark of the last time they were the same
// (`syncStep` in logic.ts): a save changed here is sent, one changed on another device is fetched and the
// game starts again from it, and when both changed the player is asked which to keep.
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { createPanel, type AccountLook, type Panel } from './account.ui.ts';
import { readMark, readSaveText, refusalText, replaceSave, sizeText, syncStep, writeMark, type CloudSave, type SaveFacts, type SaveStorage } from './logic.ts';
import type { Database, Session, SessionKeys, SessionUser } from './session.ts';

/** How often a signed-in game looks for a change to send, in milliseconds. */
const SYNC_EVERY = 30_000;

/** The save in this browser, as the host game keeps it. */
export interface SaveDoor {
  /** The key the save is stored under. It is also the save's slot in the account, so a test scene's save has its own. */
  readonly key: string;
  /** Where the save is stored: `localStorage`. */
  readonly storage: SaveStorage;
  /** Writes the running game to storage now, so what is read is not a minute old. Does nothing before a game has started. */
  flush(): void;
  /** Starts the game again from what is stored. Called after the account's save was put there. */
  restart(): void;
}

export interface AccountOptions {
  /** Clerk's publishable key. Without it and `convexUrl` the account is `off` and everyone is a guest. */
  clerkKey?: string;
  /** The Convex deployment's address. */
  convexUrl?: string;
  save: SaveDoor;
  /** The host's class names for a button, a section and so on, so the panel takes the host's look. */
  look?: Partial<AccountLook>;
  /** Milliseconds between looks for a change to send. 0 turns the timer and the page-hidden look off, for tests. */
  syncEvery?: number;
  /** Loads Clerk and Convex. A test hands in a stand-in. Left out, it is `connect` in session.ts, by dynamic import. */
  connect?: (keys: SessionKeys) => Promise<Session>;
  /** The time in milliseconds since 1970. `Date.now` when left out. */
  now?: () => number;
}

/**
 * `off`: this copy of the game has no keys. `guest`: it has, and nothing is loaded yet. `loading`: Clerk is
 * on its way. `failed`: Clerk could not be reached. Then `signedOut` or `signedIn`.
 */
export type AccountStatus = 'off' | 'guest' | 'loading' | 'failed' | 'signedOut' | 'signedIn';

export interface AccountState {
  status: AccountStatus;
  /** The signed-in player's name: Clerk's until their profile is read, then the profile's. */
  name: string | null;
  email: string | null;
  /** True once Convex has accepted the sign-in and the profile is there. Syncing waits for it. */
  ready: boolean;
  /** The account's copy of this save: undefined until the first answer, then null or the copy. */
  cloud: CloudSave | null | undefined;
  /** What the save is doing: going up, coming down, or neither. */
  sync: 'idle' | 'sending' | 'fetching';
  /** This browser and the account each have a save changed since they last matched. The panel asks which to keep. */
  conflict: { here: SaveFacts; there: CloudSave } | null;
  /** What is under way. The panel's buttons wait for it. */
  busy: 'rename' | 'signOut' | null;
  /** The last thing that went well or wrong, for the line under the save. */
  note: { kind: 'done' | 'problem'; text: string } | null;
}

export interface Account extends ViewSystem {
  readonly state: Readonly<AccountState>;
  /** Runs `fn` after every change of `state`. Returns a function that stops it. */
  onChange(fn: (state: Readonly<AccountState>) => void): () => void;
  /** Loads Clerk and finds out who is signed in. It does nothing when the account is `off` or already connected. */
  connect(): Promise<void>;
  /** The panel came on screen: the save is written so its facts are fresh, and Clerk is loaded if it was not. */
  open(): void;
  /** Opens Clerk's sign-in box. */
  signIn(): void;
  signOut(): Promise<void>;
  /** Changes the player's name. True when it was stored. */
  rename(name: string): Promise<boolean>;
  /** Compares the save here with the account's and sends or fetches it. The timer calls this; a test calls it by hand. */
  sync(): Promise<void>;
  /**
   * Settles a conflict. `here` sends this browser's save over the account's. `there` puts the account's save
   * in this browser, keeps the one it replaces under another key, and restarts the game.
   */
  keep(which: 'here' | 'there'): Promise<void>;
  /** The facts of the save in this browser, or null when there is none. */
  localSave(): SaveFacts | null;
  /** The panel's element. It redraws itself on every change. Put it where the panel goes. */
  readonly panel: HTMLElement;
}

export function createAccount(_ctx: ViewContext, options: AccountOptions): Account {
  const { save } = options;
  const keys = options.clerkKey && options.convexUrl ? { clerkKey: options.clerkKey, convexUrl: options.convexUrl } : null;
  const connectTo = options.connect ?? (async (to: SessionKeys) => (await import('./session.ts')).connect(to));
  const now = options.now ?? Date.now;
  const syncEvery = options.syncEvery ?? SYNC_EVERY;

  const state: AccountState = { status: keys ? 'guest' : 'off', name: null, email: null, ready: false, cloud: undefined, sync: 'idle', conflict: null, busy: null, note: null };
  const listeners = new Set<(state: Readonly<AccountState>) => void>();
  const set = (next: Partial<AccountState>): void => {
    Object.assign(state, next);
    for (const fn of listeners) fn(state);
  };
  const problem = (text: string): void => set({ busy: null, note: { kind: 'problem', text } });

  let session: Session | null = null;
  let connecting: Promise<void> | null = null;
  let database: Database | null = null;
  /** The signed-in player's profile id: whose mark a mark is. */
  let player: string | null = null;
  let stopSave: (() => void) | null = null;
  let stopUser: (() => void) | null = null;
  /** Goes up on every sign-in and sign-out, so an answer that comes back for the player before is dropped. */
  let turn = 0;
  /** Set when the account refused a save as too big. Nothing more is sent until the page is loaded again. */
  let tooBig = false;
  /**
   * Set once a fetched save is in and the game is starting again from it. From then on nothing is written or
   * sent: the page fires "hidden" as it unloads, after the host has put the fetched save back, and writing
   * the running game then would put the old save over it, and send it.
   */
  let leaving = false;
  let panel: Panel | null = null;
  let disposed = false;

  const stored = (): string | null => {
    try {
      return save.storage.getItem(save.key);
    } catch {
      return null;
    }
  };

  async function onUser(user: SessionUser | null): Promise<void> {
    const mine = ++turn;
    stopSave?.();
    stopSave = null;
    database = null;
    player = null;
    if (!user) {
      set({ status: 'signedOut', name: null, email: null, ready: false, cloud: undefined, sync: 'idle', conflict: null, busy: null });
      return;
    }
    set({ status: 'signedIn', name: user.name, email: user.email, ready: false, cloud: undefined, sync: 'idle', conflict: null, busy: null, note: null });
    try {
      const opened = await session!.database();
      if (mine !== turn) return;
      const profile = await opened.ensureProfile(user.name);
      if (mine !== turn) return;
      database = opened;
      player = profile._id;
      set({ name: profile.name, ready: true });
      stopSave = opened.watchSave(
        save.key,
        (cloud) => {
          if (mine !== turn) return;
          set({ cloud });
          void sync();
        },
        (error) => {
          if (mine === turn) problem(refusalText(error, 'Your save in the account could not be read.'));
        },
      );
    } catch (error) {
      if (mine === turn) problem(refusalText(error, 'You are signed in, but your account could not be reached. Check the connection and open this panel again.'));
    }
  }

  /** Sends the save here over the account's copy dated `over`. */
  async function send(text: string, here: SaveFacts, over: number | null): Promise<void> {
    if (!database || !player || tooBig) return;
    const mine = turn, who = player;
    set({ sync: 'sending' });
    try {
      const result = await database.uploadSave(text, { slot: save.key, savedAt: here.at, day: here.day, over });
      if (mine !== turn) return;
      if (result.ok) {
        writeMark(save.storage, save.key, { player: who, here: here.at, there: result.savedAt });
        // The watch brings this copy back soon. Until then a look must not take the copy before it for a change.
        set({ sync: 'idle', note: null, cloud: { bytes: result.bytes, savedAt: result.savedAt, uploadedAt: now(), day: here.day } });
      } else if (result.reason === 'stale') {
        // Another device got there first. Its copy arrives through the watch, and the next look asks.
        set({ sync: 'idle' });
      } else {
        tooBig = true;
        set({ sync: 'idle' });
        problem(`This save is too big for your account. It is ${sizeText(result.bytes)} and the limit is ${sizeText(result.limit)}. It is kept in this browser.`);
      }
    } catch (error) {
      if (mine !== turn) return;
      set({ sync: 'idle' });
      problem(refusalText(error, 'Your account could not be reached. The save is kept here and goes up when the connection is back.'));
    }
  }

  /** Puts the account's copy in this browser and starts the game again from it. */
  async function fetchCloud(there: CloudSave): Promise<void> {
    if (!database || !player) return;
    const mine = turn, who = player;
    set({ sync: 'fetching' });
    try {
      const text = await database.downloadSave(save.key);
      if (mine !== turn) return;
      const facts = readSaveText(text);
      if (!facts) {
        set({ sync: 'idle' });
        return problem('The save in your account could not be read, so the one here was kept.');
      }
      if (!replaceSave(save.storage, save.key, text)) {
        set({ sync: 'idle' });
        return problem('This browser would not store the save from your account, so the one here was kept.');
      }
      writeMark(save.storage, save.key, { player: who, here: facts.at, there: there.savedAt });
      set({ sync: 'idle', conflict: null, note: { kind: 'done', text: `Your save from day ${facts.day} is here. The game is starting again.` } });
      leaving = true;
      save.restart();
    } catch (error) {
      if (mine !== turn) return;
      set({ sync: 'idle' });
      problem(refusalText(error, 'The save in your account could not be fetched. Check the connection.'));
    }
  }

  async function sync(): Promise<void> {
    const there = state.cloud;
    if (leaving || !database || !player || there === undefined || state.sync !== 'idle' || state.conflict) return;
    const text = stored();
    const here = text === null ? null : readSaveText(text);
    if (text !== null && !here) return problem('The save in this browser could not be read, so it was not sent.');
    const step = syncStep(here, there, readMark(save.storage, save.key), player);
    if (step === 'send' && text && here) await send(text, here, there?.savedAt ?? null);
    else if (step === 'fetch' && there) await fetchCloud(there);
    else if (step === 'ask' && here && there) set({ conflict: { here, there } });
    else if (step === 'same' && here && there) writeMark(save.storage, save.key, { player, here: here.at, there: there.savedAt });
  }

  // Looks for a change every `syncEvery`, and writes and sends the game when the page is hidden: the player
  // may be switching to another device.
  const timer = syncEvery > 0 ? setInterval(() => void sync(), syncEvery) : null;
  const onHidden = (): void => {
    if (document.visibilityState !== 'hidden' || !database || leaving) return;
    save.flush();
    void sync();
  };
  if (syncEvery > 0) document.addEventListener('visibilitychange', onHidden);

  const account: Account = {
    state,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    connect() {
      if (!keys || disposed) return Promise.resolve();
      connecting ??= (async () => {
        set({ status: 'loading', note: null });
        try {
          const made = await connectTo(keys);
          if (disposed) return made.dispose();
          session = made;
          stopUser = made.onUser((user) => void onUser(user));
        } catch (error) {
          console.warn('[account] sign-in could not be loaded:', error);
          connecting = null;
          set({ status: 'failed' });
        }
      })();
      return connecting;
    },
    open() {
      if (!leaving) save.flush();
      if (state.status === 'guest' || state.status === 'failed') void account.connect();
      panel?.draw();
      void sync();
    },
    signIn() {
      // Signing in with Google leaves the page and comes back, so the game is written down first.
      save.flush();
      set({ note: null });
      session?.openSignIn();
    },
    async signOut() {
      if (!session || state.busy) return;
      // What was played since the last look goes up first, so it is on the next device.
      save.flush();
      await sync();
      set({ busy: 'signOut', note: null });
      try {
        await session.signOut();
      } catch {
        problem('Signing out did not go through. Try again.');
      }
    },
    async rename(name) {
      if (!database || state.busy) return false;
      const mine = turn;
      set({ busy: 'rename', note: null });
      try {
        const kept = await database.rename(name);
        if (mine !== turn) return false;
        set({ busy: null, name: kept });
        return true;
      } catch (error) {
        if (mine === turn) problem(refusalText(error, 'The name was not changed. Try again.'));
        return false;
      }
    },
    sync,
    async keep(which) {
      const conflict = state.conflict;
      if (!conflict || state.sync !== 'idle') return;
      if (which === 'there') {
        // The running game is written first, so the save kept aside is the world as it is now.
        save.flush();
        await fetchCloud(conflict.there);
        return;
      }
      save.flush();
      const text = stored();
      const here = text === null ? null : readSaveText(text);
      set({ conflict: null });
      if (text && here) await send(text, here, conflict.there.savedAt);
    },
    localSave() {
      const text = stored();
      return text === null ? null : readSaveText(text);
    },
    get panel() {
      panel ??= createPanel(account, { look: options.look, now });
      return panel.node;
    },
    update() {
      // Nothing is drawn in the world and nothing is done per frame: the panel redraws when the state changes.
    },
    dispose() {
      disposed = true;
      turn++;
      if (timer !== null) clearInterval(timer);
      if (syncEvery > 0) document.removeEventListener('visibilitychange', onHidden);
      stopSave?.();
      stopUser?.();
      session?.dispose();
      panel?.dispose();
      listeners.clear();
      session = database = stopSave = stopUser = panel = null;
    },
  };
  return account;
}
