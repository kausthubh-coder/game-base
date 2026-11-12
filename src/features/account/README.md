# account

Clerk signs a player in. Convex keeps their profile and a copy of their save, so a game started on one
device goes on on any other they sign in on. A guest plays with none of it loaded, and their save stays in
this browser.

```ts
import { createAccount } from '../features/account/index.ts';

const account = createAccount(ctx, {
  clerkKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,   // both missing: the account is `off`
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  save: { key, storage: localStorage, flush, restart },
  look: { button: 'gu-btn', primary: 'gu-btn gu-primary', section: 'gu-section', label: 'gu-label', note: 'gu-menu-note' },
});
somePanel.append(account.panel);
account.open();
```

The game installs it in `src/game/views/ui-account.view.ts`, behind Account on the title screen and in the
pause menu.

## What loads, and when

| When | What is fetched |
|---|---|
| The game starts, as a guest | Nothing. The view file adds about 1.8 KB to the game's first script. |
| The player opens the Account panel | This feature (16 KB in two files), then Clerk from the Clerk instance's address |
| A player is signed in | Convex's browser client (64 KB), and one WebSocket to the deployment |
| The next visit of a browser that was signed in | All of the above, once the game has drawn three frames |
| No keys in `.env.local` | Only this feature, when the panel is opened. The panel says sign-in is not set up. |

Clerk comes as two scripts from the Clerk instance's own address, not from the `@clerk/clerk-js` package.
The package is one 1.5 MB file with every wallet and password library inside it. The script is 328 KB and
fetches those only when a player uses them. The package stays installed for its types. Both ways are in
Clerk's JavaScript quickstart.

## How the save follows the player

Signed in, the account watches its copy of the save live (`saves.mine`) and looks for a change every 30
seconds, when the page is hidden, when the panel opens and before a sign-out. Each look compares three
times: the save here (its `at`), the account's copy (its `savedAt`), and the mark of the last time the two
were the same save, kept under `<key>.synced`. `syncStep` in `logic.ts` decides:

| Here | In the account | What happens |
|---|---|---|
| A save | None | This one goes up |
| None | A save | It comes down, and the game starts again from it |
| Changed since the mark | Not changed | This one goes up over it |
| Not changed | Changed, by another device | It comes down, and the game starts again from it |
| Changed | Changed | The panel opens by itself and asks which one to play |
| A save never matched with this account, such as a guest's | A different save | The same question |

A save that comes down replaces the one here, which is kept under `<key>.before-restore`. Nothing in the
game reads that copy yet. To go back by hand, copy its value over `greenhollow.save` in the browser's
storage and reload.

The upload says which copy it replaces (`over`). When another device put a newer one there first, Convex
refuses it as `stale`, the newer copy arrives through the watch, and the next look asks. So two devices
never overwrite each other without the player choosing.

The game starts again in the host's `restart`. At the title the page reloads to the title, with the save to
Continue. In a game it reloads straight into the game.

The shell writes the save every 60 seconds of play, so a device that is switched off mid-game can be up to
a minute behind. Hiding the page writes and sends it at once.

## The states

`account.state.status`:

| Status | Meaning |
|---|---|
| `off` | This copy of the game has no keys. Everyone is a guest. |
| `guest` | It has keys, and nothing is loaded yet |
| `loading` | Clerk is on its way |
| `failed` | Clerk could not be reached. `connect()` tries again. |
| `signedOut` | Clerk is loaded and nobody is signed in |
| `signedIn` | `name` and `email` are set. `ready` turns true once Convex has accepted the sign-in. `cloud` is undefined until the first answer, then the account's copy or null. |

`sync` is `idle`, `sending` or `fetching`. `conflict` holds both saves' facts while the player is asked.

## Methods

| Method | What it does |
|---|---|
| `connect()` | Loads Clerk and finds out who is signed in |
| `open()` | The panel came on screen: writes the save, connects if it has not, redraws, looks for a change |
| `signIn()` | Writes the save, then opens Clerk's sign-in box over the page |
| `signOut()` | Sends what was played, then signs out and closes the connection to Convex. The save stays here. |
| `rename(name)` | Changes the player's name. True when Convex stored it. |
| `sync()` | One look: sends, fetches, asks or does nothing, as the table above says |
| `keep('here' \| 'there')` | Settles a conflict: send this browser's save over the account's, or fetch the account's |
| `localSave()` | The day, time and size of the save in this browser, or null |
| `onChange(fn)` | Hears every change of `state` |
| `panel` | The panel's element. It redraws itself. |
| `update()`, `dispose()` | As every view system. `update` does nothing. |

## Options

| Option | Needed | What it is |
|---|---|---|
| `clerkKey`, `convexUrl` | no | Clerk's publishable key and the Convex deployment's address. Without both the account is `off`. |
| `save.key` | yes | The key the save is stored under. It is also its slot in the account, so a test scene's save has its own. |
| `save.storage` | yes | Where the save is: `localStorage` |
| `save.flush()` | yes | Writes the running game to storage now |
| `save.restart()` | yes | Starts the game again from what is stored |
| `look` | no | The host's class names for a button, the primary button, a section, its heading and a note |
| `syncEvery` | no | Milliseconds between looks, 30,000 by default. 0 turns off the timer and the page-hidden look, for tests. |
| `connect` | no | A stand-in for Clerk and Convex, for tests |
| `now` | no | The clock, for tests |

## Keys

The game listens for keys on the window. A key pressed inside Clerk's box stops at the document, so
typing an email walks nobody, Tab stays in the box and Esc closes only the box.

## Files

| File | What is in it |
|---|---|
| `account.ts` | `createAccount`: the states and the sync |
| `account.ui.ts` | The panel's contents |
| `session.ts` | The only file that talks to Clerk and Convex |
| `logic.ts` | Reading a save, which way it goes, the mark, the words on the panel, swapping a save. No page, no network. |
| `account.test.ts`, `logic.test.ts` | `bun test src/features/account` |

The tables and functions it calls are in `convex/`, described in `convex/README.md`.
`bun tools/play-cloud-save.mjs` plays it with two browsers and real sign-ins.
