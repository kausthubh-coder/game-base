// The account: who is signed in, their worlds, and the backup of the solo save. It starts as a guest and
// stays one until `connect` is called, so a game with no keys, or a player who never opens the panel,
// loads nothing from Clerk or Convex.
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { createPanel, type AccountLook, type Panel } from './account.ui.ts';
import { backupOf, readSaveText, refusalText, replaceSave, sizeText, type SaveFacts, type SaveStorage, type WorldCard } from './logic.ts';
import type { Database, Session, SessionKeys, SessionUser } from './session.ts';

/** The solo save in this browser, as the host game keeps it. */
export interface SaveDoor {
  /** The key the save is stored under. It is also the backup's slot, so a test scene's save has its own backup. */
  readonly key: string;
  /** Where the save is stored: `localStorage`. */
  readonly storage: SaveStorage;
  /** Writes the running game to storage now, so what is read is not a minute old. Does nothing before a game has started. */
  flush(): void;
  /** Starts the game again from what is stored. Called after a restore has put a save there. */
  restart(): void;
}

export interface AccountOptions {
  /** Clerk's publishable key. Without it and `convexUrl` the account is `off` and everyone is a guest. */
  clerkKey?: string;
  /** The Convex deployment's address. */
  convexUrl?: string;
  save: SaveDoor;
  /** The name on the solo world's card. */
  worldName: string;
  /** The host's class names for a button, a section and so on, so the panel takes the host's look. */
  look?: Partial<AccountLook>;
  /**
   * Online worlds: the address that opens one, with an invite in it when there is one, and going there. Left
   * out, the panel has no Play together and no way into an online world.
   */
  online?: {
    address(worldId: string, invite?: string): string;
    enter(worldId: string): void;
  };
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
  /** True once Convex has accepted the sign-in and the profile is there. Backing up waits for it. */
  ready: boolean;
  /** The player's worlds, live from Convex. Null until the first answer. */
  worlds: WorldCard[] | null;
  /** What is under way. The panel's buttons wait for it. */
  busy: 'backup' | 'restore' | 'rename' | 'signOut' | 'world' | null;
  /** The last link made to let a friend into an online world, or null. */
  link: { worldId: string; url: string } | null;
  /** The last thing that went well or wrong, for the line under the buttons. */
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
  /** Sends the solo save to Convex. True when it arrived. */
  backUp(): Promise<boolean>;
  /**
   * Replaces the save in this browser with the backup, keeps the replaced one under another key, and
   * restarts the game. The panel asks before it calls this. True when the save was replaced.
   */
  restore(): Promise<boolean>;
  /** The facts of the save in this browser, or null when there is none. */
  localSave(): SaveFacts | null;
  /** Makes an online world the player owns and a link that lets a friend in. True when both were made. */
  playTogether(): Promise<boolean>;
  /** Makes a new link to the player's online world, for one more friend. True when it was made. */
  inviteTo(worldId: string): Promise<boolean>;
  /** Opens an online world. */
  enter(worldId: string): void;
  /** Takes the player into the world an invite is for. True when they are in it now. */
  acceptInvite(code: string): Promise<boolean>;
  /** The signed-in player's token, for the world server. Null when nobody is signed in. */
  token(): Promise<string | null>;
  /** True when online worlds can be made and entered from here. */
  readonly online: boolean;
  /** The panel's element. It redraws itself on every change. Put it where the panel goes. */
  readonly panel: HTMLElement;
}

export function createAccount(_ctx: ViewContext, options: AccountOptions): Account {
  const { save } = options;
  const keys = options.clerkKey && options.convexUrl ? { clerkKey: options.clerkKey, convexUrl: options.convexUrl } : null;
  const connectTo = options.connect ?? (async (to: SessionKeys) => (await import('./session.ts')).connect(to));
  const now = options.now ?? Date.now;

  const state: AccountState = { status: keys ? 'guest' : 'off', name: null, email: null, ready: false, worlds: null, busy: null, link: null, note: null };
  const listeners = new Set<(state: Readonly<AccountState>) => void>();
  const set = (next: Partial<AccountState>): void => {
    Object.assign(state, next);
    for (const fn of listeners) fn(state);
  };
  const done = (text: string): void => set({ busy: null, note: { kind: 'done', text } });
  const problem = (text: string): false => {
    set({ busy: null, note: { kind: 'problem', text } });
    return false;
  };

  let session: Session | null = null;
  let connecting: Promise<void> | null = null;
  let database: Database | null = null;
  let stopWorlds: (() => void) | null = null;
  let stopUser: (() => void) | null = null;
  /** Goes up on every sign-in and sign-out, so an answer that comes back for the player before is dropped. */
  let turn = 0;
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
    stopWorlds?.();
    stopWorlds = null;
    database = null;
    if (!user) {
      set({ status: 'signedOut', name: null, email: null, ready: false, worlds: null, busy: null, link: null });
      return;
    }
    set({ status: 'signedIn', name: user.name, email: user.email, ready: false, worlds: null, busy: null, note: null });
    try {
      const opened = await session!.database();
      if (mine !== turn) return;
      const profile = await opened.ensureProfile(user.name);
      if (mine !== turn) return;
      database = opened;
      set({ name: profile.name, ready: true });
      stopWorlds = opened.watchWorlds(
        (worlds) => {
          if (mine === turn) set({ worlds });
        },
        (error) => {
          if (mine === turn) problem(refusalText(error, 'Your worlds could not be read.'));
        },
      );
    } catch (error) {
      if (mine === turn) problem(refusalText(error, 'You are signed in, but your account could not be reached. Check the connection and open this panel again.'));
    }
  }

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
      save.flush();
      if (state.status === 'guest' || state.status === 'failed') void account.connect();
      panel?.draw();
    },
    signIn() {
      // Signing in with Google leaves the page and comes back, so the game is written down first.
      save.flush();
      set({ note: null });
      session?.openSignIn();
    },
    async signOut() {
      if (!session || state.busy) return;
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
        return mine === turn && problem(refusalText(error, 'The name was not changed. Try again.'));
      }
    },
    async backUp() {
      if (!database || state.busy) return false;
      save.flush();
      const text = stored();
      if (text === null) return problem('There is nothing to back up yet. Play a little first.');
      const facts = readSaveText(text);
      if (!facts) return problem('The save in this browser could not be read, so it was not backed up.');
      const mine = turn;
      set({ busy: 'backup', note: null });
      try {
        const result = await database.uploadSave(text, { slot: save.key, name: options.worldName, savedAt: facts.at, day: facts.day });
        if (mine !== turn) return false;
        if (!result.ok) return problem(`This world is too big to back up. It is ${sizeText(result.bytes)} and the limit is ${sizeText(result.limit)}.`);
        done(`Backed up day ${facts.day}, ${sizeText(result.bytes)}.`);
        return true;
      } catch (error) {
        return mine === turn && problem(refusalText(error, 'The backup did not go through. Check the connection and try again.'));
      }
    },
    async restore() {
      const backup = backupOf(state.worlds ?? [], save.key);
      if (!database || !backup || state.busy) return false;
      const mine = turn;
      set({ busy: 'restore', note: null });
      try {
        const text = await database.downloadSave(backup.worldId);
        if (mine !== turn) return false;
        if (!readSaveText(text)) return problem('The backup could not be read, so nothing was replaced.');
        // The running game is written first, so the copy kept aside is the world as it is now.
        save.flush();
        if (!replaceSave(save.storage, save.key, text)) return problem('This browser would not store the backup, so nothing was replaced.');
        done('Restored. The world is starting again.');
        save.restart();
        return true;
      } catch (error) {
        return mine === turn && problem(refusalText(error, 'The backup could not be fetched. Check the connection and try again.'));
      }
    },
    localSave() {
      const text = stored();
      return text === null ? null : readSaveText(text);
    },
    get online() { return options.online !== undefined; },
    async playTogether() {
      const online = options.online;
      if (!database || !online || state.busy) return false;
      const mine = turn;
      set({ busy: 'world', note: null });
      try {
        const worldId = await database.createWorld(`${state.name ?? 'Your'}'s world`);
        const code = await database.invite(worldId);
        if (mine !== turn) return false;
        set({ busy: null, link: { worldId, url: online.address(worldId, code) }, note: { kind: 'done', text: 'Your world is ready. Send the link to a friend, then enter it.' } });
        return true;
      } catch (error) {
        return mine === turn && problem(refusalText(error, 'The world could not be made. Check the connection and try again.'));
      }
    },
    async inviteTo(worldId) {
      const online = options.online;
      if (!database || !online || state.busy) return false;
      const mine = turn;
      set({ busy: 'world', note: null });
      try {
        const code = await database.invite(worldId);
        if (mine !== turn) return false;
        set({ busy: null, link: { worldId, url: online.address(worldId, code) }, note: { kind: 'done', text: 'A new link, for one more friend.' } });
        return true;
      } catch (error) {
        return mine === turn && problem(refusalText(error, 'The link could not be made. Try again.'));
      }
    },
    enter(worldId) {
      options.online?.enter(worldId);
    },
    async acceptInvite(code) {
      if (!database) return false;
      try {
        await database.acceptInvite(code);
        return true;
      } catch (error) {
        problem(refusalText(error, 'The invite could not be used.'));
        return false;
      }
    },
    async token() {
      return session ? await session.token() : null;
    },
    get panel() {
      panel ??= createPanel(account, { look: options.look, slot: save.key, now });
      return panel.node;
    },
    update() {
      // Nothing is drawn in the world and nothing is done per frame: the panel redraws when the state changes.
    },
    dispose() {
      disposed = true;
      turn++;
      stopWorlds?.();
      stopUser?.();
      session?.dispose();
      panel?.dispose();
      listeners.clear();
      session = database = stopWorlds = stopUser = panel = null;
    },
  };
  return account;
}
