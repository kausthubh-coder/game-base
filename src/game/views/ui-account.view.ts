// The Account entry of the pause menu: sign in and out, the player's name, the backup of this world and
// the world list. The account itself is src/features/account.
//
// Guest first. This file is all of it that is in the game's first script. The feature, and Clerk and
// Convex behind it, load by dynamic import: when the player opens the panel, or once the game is drawing
// and this browser was signed in the last time. With no keys in `.env.local` nothing is ever fetched.
import type { Account } from '../../features/account/index.ts';
import { SAVE_KEY, reloadInto } from '../shell/save.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';

/** Set while this browser is signed in, so the next visit signs in again without the panel being opened. */
const SIGNED_IN_KEY = 'greenhollow.account.signed-in';
/** The name on the solo world's card in the world list. */
const WORLD_NAME = 'A plot of your own';

const remembered = (): boolean => {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
};

export function install(view: GameView): void {
  const { ui } = bookOf(view);
  const body = document.createElement('div');
  body.className = 'gu-menu-note';
  body.textContent = 'Opening your account.';

  let account: Account | null = null;
  let loading: Promise<Account> | null = null;
  const load = (): Promise<Account> => (loading ??= import('../../features/account/index.ts').then(({ createAccount }) => {
    const made = createAccount(view.ctx, {
      clerkKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
      convexUrl: import.meta.env.VITE_CONVEX_URL,
      worldName: WORLD_NAME,
      look: { button: 'gu-btn', primary: 'gu-btn gu-primary', section: 'gu-section', label: 'gu-label', note: 'gu-menu-note' },
      save: {
        key: SAVE_KEY,
        storage: localStorage,
        flush: () => { view.save(); },
        restart() {
          // The shell writes the running game as the page closes. This listener was added after the shell's,
          // so it runs after it and puts the restored save back.
          const restored = localStorage.getItem(SAVE_KEY);
          if (restored !== null) {
            window.addEventListener('pagehide', () => {
              try {
                localStorage.setItem(SAVE_KEY, restored);
              } catch {
                // It was stored a moment ago, so this only fails if the shell's write just filled the disk.
              }
            });
          }
          reloadInto('continue');
        },
      },
    });
    made.onChange((state) => {
      if (state.status !== 'signedIn' && state.status !== 'signedOut') return;
      try {
        if (state.status === 'signedIn') localStorage.setItem(SIGNED_IN_KEY, '1');
        else localStorage.removeItem(SIGNED_IN_KEY);
      } catch {
        // Without storage the next visit starts as a guest, and the panel signs in again.
      }
    });
    body.className = '';
    body.replaceChildren(made.panel);
    account = made;
    return made;
  }));

  ui.setAccount(() => ({
    title: 'Account',
    className: 'gu-panel-account',
    body,
    render() {
      if (account) account.open();
      else void load().then((made) => made.open(), (error: unknown) => {
        console.warn('[game] the account did not load:', error);
        body.textContent = 'The account could not be loaded. Check the connection and open this again.';
        loading = null;
      });
    },
  }));

  // A browser that was signed in signs in again by itself, but only after the game has drawn a few frames.
  if (!remembered()) return;
  let frames = 0;
  const stop = view.onFrame(() => {
    if (++frames < 3) return;
    stop();
    setTimeout(() => void load().then((made) => made.connect(), () => { loading = null; }), 0);
  });
}
