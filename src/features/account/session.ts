// The one file that talks to Clerk and Convex. Neither is in the game's first script. Clerk loads when
// `connect` is called, as two scripts from the Clerk instance's own address. Convex loads by dynamic import
// when a player turns out to be signed in. Everything else in the feature sees only `Session` and
// `Database`, which a test can stand in for.
//
// Clerk comes from its address and not from the `@clerk/clerk-js` package, which is here for its types.
// The package is one 1.5 MB file with every wallet and password library inside. The script is 328 KB and
// fetches those only when a player uses them. Both ways are in Clerk's JavaScript quickstart.
import type { Clerk } from '@clerk/clerk-js';
import type { ConvexClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api.js';
import type { Id } from '../../../convex/_generated/dataModel';
import { clerkAddress, type WorldCard } from './logic.ts';

/** Who Clerk says is signed in. */
export interface SessionUser {
  /** What Clerk calls them. A new profile starts with this name. */
  name: string;
  email: string | null;
}

/** What goes on a backup beside the save's text. */
export interface BackupLabel {
  slot: string;
  name: string;
  savedAt: number;
  day: number;
}

export type BackupResult = { ok: true; bytes: number } | { ok: false; reason: 'tooBig'; bytes: number; limit: number };

/** Convex, as the signed-in player. Every call is theirs: Convex reads who is asking from Clerk's token. */
export interface Database {
  /** Makes the player's profile on their first sign-in and returns the name on it. */
  ensureProfile(name: string): Promise<{ name: string }>;
  /** Returns the name as it was stored. */
  rename(name: string): Promise<string>;
  /** The player's worlds, again on every change. Returns a function that stops it. */
  watchWorlds(fn: (worlds: WorldCard[]) => void, onError: (error: unknown) => void): () => void;
  uploadSave(text: string, label: BackupLabel): Promise<BackupResult>;
  /** The text of the backup of the player's own world. */
  downloadSave(worldId: string): Promise<string>;
  /** Makes an online world the player owns, with this name. Returns its id: the `<id>` of `/world/<id>`. */
  createWorld(name: string): Promise<string>;
  /** Makes an invite to the player's online world. Returns its code, which lets one friend in, once. */
  invite(worldId: string): Promise<string>;
  /** Takes the player into the world an invite is for. Using one for a world they are already in changes nothing. */
  acceptInvite(code: string): Promise<{ worldId: string; name: string }>;
}

export interface Session {
  /** Hears who is signed in, at once and on every sign-in and sign-out. Returns a function that stops it. */
  onUser(fn: (user: SessionUser | null) => void): () => void;
  /** Opens Clerk's sign-in box over the page. */
  openSignIn(): void;
  signOut(): Promise<void>;
  /** Convex as the signed-in player, once it has accepted Clerk's token. It throws when it does not. */
  database(): Promise<Database>;
  /** The signed-in player's token, the one Convex takes. The world server takes the same one. Null when signed out. */
  token(): Promise<string | null>;
  dispose(): void;
}

export interface SessionKeys {
  /** Clerk's publishable key, `pk_test_...` or `pk_live_...`. */
  clerkKey: string;
  /** The Convex deployment's address, `https://<name>.convex.cloud`. */
  convexUrl: string;
}

/** Adds a script to the page and waits for it. */
function loadScript(src: string, attributes: Record<string, string> = {}): Promise<void> {
  return new Promise((done, fail) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    script.onload = () => done();
    script.onerror = () => {
      script.remove();
      fail(new Error(`${src} did not load`));
    };
    document.head.append(script);
  });
}

/**
 * Clerk, from the Clerk instance's own address: the SDK, which makes `window.Clerk` from the key on its
 * script tag, and the sign-in box, which puts its maker on the window. `@6` and `@1` are the versions the
 * quickstart names for this SDK.
 */
async function loadClerk(address: string, publishableKey: string): Promise<{ clerk: Clerk; box: unknown }> {
  const page = window as { Clerk?: Clerk; __internal_ClerkUICtor?: unknown };
  await Promise.all([
    page.__internal_ClerkUICtor ? null : loadScript(`https://${address}/npm/@clerk/ui@1/dist/ui.browser.js`),
    page.Clerk ? null : loadScript(`https://${address}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': publishableKey }),
  ]);
  if (!page.Clerk || !page.__internal_ClerkUICtor) throw new Error('Clerk loaded and did not start');
  return { clerk: page.Clerk, box: page.__internal_ClerkUICtor };
}

/** The claims of a token, unchecked: only to see which kind of token Clerk handed out. */
function claimsOf(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * A token Convex accepts, as convex/react-clerk fetches it: the session token when Clerk's Convex integration
 * has put `aud: convex` on it, and otherwise the older `convex` token template.
 */
async function convexToken(clerk: Clerk, fresh: boolean): Promise<string | null> {
  const session = clerk.session;
  if (!session) return null;
  try {
    const token = await session.getToken({ skipCache: fresh });
    if (token && claimsOf(token).aud === 'convex') return token;
    return await session.getToken({ template: 'convex', skipCache: fresh });
  } catch {
    return null;
  }
}

function openDatabase(client: ConvexClient): Database {
  return {
    async ensureProfile(name) {
      return await client.mutation(api.profiles.ensure, { name });
    },
    async rename(name) {
      return await client.mutation(api.profiles.rename, { name });
    },
    watchWorlds(fn, onError) {
      return client.onUpdate(api.worlds.list, {}, fn, onError);
    },
    async uploadSave(text, label) {
      const address = await client.mutation(api.saves.uploadUrl, {});
      const sent = await fetch(address, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
      if (!sent.ok) throw new Error(`the upload was refused with status ${sent.status}`);
      const { storageId } = (await sent.json()) as { storageId: Id<'_storage'> };
      const result = await client.mutation(api.saves.commit, { storageId, ...label });
      return result.ok ? { ok: true, bytes: result.bytes } : result;
    },
    async downloadSave(worldId) {
      const address = await client.query(api.saves.downloadUrl, { worldId: worldId as Id<'worlds'> });
      const got = await fetch(address);
      if (!got.ok) throw new Error(`the download was refused with status ${got.status}`);
      return await got.text();
    },
    async createWorld(name) {
      return await client.mutation(api.worlds.create, { name });
    },
    async invite(worldId) {
      return (await client.mutation(api.invites.create, { worldId: worldId as Id<'worlds'> })).code;
    },
    async acceptInvite(code) {
      return await client.mutation(api.invites.accept, { code });
    },
  };
}

/** Loads Clerk and finds out who is signed in. It throws when Clerk cannot be reached. */
export async function connect(keys: SessionKeys): Promise<Session> {
  const address = clerkAddress(keys.clerkKey);
  if (!address) throw new Error('the Clerk publishable key is not one');
  const { clerk, box } = await loadClerk(address, keys.clerkKey);

  // Clerk goes to a page when a sign-in or sign-out is done. This game is one page, and going to it again
  // would start it over, so a move to the page already open is left out.
  const stay = (to: string, metadata?: { windowNavigate: (to: URL | string) => void }): void => {
    const target = new URL(to, location.href);
    if (target.origin === location.origin && target.pathname === location.pathname) return;
    (metadata?.windowNavigate ?? ((url) => location.assign(url)))(target);
  };
  await clerk.load({
    ui: { ClerkUI: box } as never,
    routerPush: stay,
    routerReplace: stay,
    signInFallbackRedirectUrl: location.href,
    signUpFallbackRedirectUrl: location.href,
    afterSignOutUrl: location.href,
  });

  // The game listens for keys on the window: Esc closes a panel, Tab stays inside it, W walks. A key
  // pressed inside Clerk's box belongs to the box, so it stops here, one step before the window.
  const keepKeys = (event: KeyboardEvent): void => {
    if (event.target instanceof Element && event.target.closest('.cl-modalBackdrop, .cl-rootBox')) event.stopPropagation();
  };
  document.addEventListener('keydown', keepKeys);
  document.addEventListener('keyup', keepKeys);

  let client: ConvexClient | null = null;
  let opening: Promise<Database> | null = null;
  /** Goes up each time the connection is closed, so one that was still being opened knows it is not wanted. */
  let closes = 0;
  const closeDatabase = (): void => {
    closes++;
    void client?.close();
    client = null;
    opening = null;
  };

  const userOf = (): SessionUser | null => {
    const user = clerk.user;
    if (!user) return null;
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    return { name: user.fullName || user.username || user.firstName || email?.split('@')[0] || 'Player', email };
  };

  const stops = new Set<() => void>();
  return {
    onUser(fn) {
      let seen: string | undefined;
      let seenId: string | null = null;
      // Clerk calls a listener at once, and again on changes that are not a sign-in or a sign-out.
      const stop = clerk.addListener(() => {
        const user = userOf();
        const id = clerk.user?.id ?? null;
        const now = JSON.stringify([id, user]);
        if (now === seen) return;
        // Another player, or nobody: the connection to Convex was the last player's.
        if (seen !== undefined && id !== seenId) closeDatabase();
        seen = now;
        seenId = id;
        if (user) clerk.closeSignIn();
        fn(user);
      });
      stops.add(stop);
      return () => {
        stop();
        stops.delete(stop);
      };
    },
    openSignIn() {
      clerk.openSignIn({});
    },
    async signOut() {
      closeDatabase();
      await clerk.signOut();
    },
    database() {
      const started = closes;
      opening ??= (async () => {
        const { ConvexClient: ConvexClass } = await import('convex/browser');
        if (started !== closes) throw new Error('signed out while Convex was loading');
        const made = new ConvexClass(keys.convexUrl);
        client = made;
        await new Promise<void>((accepted, refused) => {
          let answered = false;
          made.setAuth(
            ({ forceRefreshToken }) => convexToken(clerk, forceRefreshToken),
            (isSignedIn) => {
              if (answered) return;
              answered = true;
              if (isSignedIn) accepted();
              else refused(new Error('Convex did not accept the sign-in'));
            },
          );
        });
        return openDatabase(made);
      })();
      // A connection Convex refused is dropped, so the next call tries again.
      const mine = opening;
      mine.catch(() => {
        if (opening === mine) closeDatabase();
      });
      return mine;
    },
    token: () => convexToken(clerk, false),
    dispose() {
      for (const stop of stops) stop();
      stops.clear();
      document.removeEventListener('keydown', keepKeys);
      document.removeEventListener('keyup', keepKeys);
      closeDatabase();
    },
  };
}
