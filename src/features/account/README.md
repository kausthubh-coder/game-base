# account

Clerk signs a player in. Convex keeps their profile, their worlds and the backup of the solo save. A guest
plays with none of it loaded.

```ts
import { createAccount } from '../features/account/index.ts';

const account = createAccount(ctx, {
  clerkKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,   // both missing: the account is `off`
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  worldName: 'A plot of your own',
  save: { key, storage: localStorage, flush, restart },
  look: { button: 'gu-btn', primary: 'gu-btn gu-primary', section: 'gu-section', label: 'gu-label', note: 'gu-menu-note' },
});
somePanel.append(account.panel);
account.open();
```

The game installs it in `src/game/views/ui-account.view.ts`, behind the Account entry of the pause menu.

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

## The states

`account.state.status`:

| Status | Meaning |
|---|---|
| `off` | This copy of the game has no keys. Everyone is a guest. |
| `guest` | It has keys, and nothing is loaded yet |
| `loading` | Clerk is on its way |
| `failed` | Clerk could not be reached. `connect()` tries again. |
| `signedOut` | Clerk is loaded and nobody is signed in |
| `signedIn` | `name` and `email` are set. `ready` turns true once Convex has accepted the sign-in. `worlds` is null until the first answer, then the live list. |

## Methods

| Method | What it does |
|---|---|
| `connect()` | Loads Clerk and finds out who is signed in |
| `open()` | The panel came on screen: writes the save, connects if it has not, redraws |
| `signIn()` | Opens Clerk's sign-in box over the page |
| `signOut()` | Signs out and closes the connection to Convex |
| `rename(name)` | Changes the player's name. True when Convex stored it. |
| `backUp()` | Writes the save, then sends it to Convex. True when it arrived. |
| `restore()` | Fetches the backup, copies the save it replaces to `<key>.before-restore`, writes the backup and calls `save.restart()`. The panel asks before it calls this. |
| `localSave()` | The day, time and size of the save in this browser, or null |
| `onChange(fn)` | Hears every change of `state` |
| `panel` | The panel's element. It redraws itself. |
| `update()`, `dispose()` | As every view system. `update` does nothing. |

## Options

| Option | Needed | What it is |
|---|---|---|
| `clerkKey`, `convexUrl` | no | Clerk's publishable key and the Convex deployment's address. Without both the account is `off`. |
| `save.key` | yes | The key the save is stored under. It is also the backup's slot, so a test scene's save has its own backup. |
| `save.storage` | yes | Where the save is: `localStorage` |
| `save.flush()` | yes | Writes the running game to storage now |
| `save.restart()` | yes | Starts the game again from what is stored |
| `worldName` | yes | The name on the solo world's card |
| `look` | no | The host's class names for a button, the primary button, a section, its heading and a note |
| `connect` | no | A stand-in for Clerk and Convex, for tests |
| `now` | no | The clock, for tests |

## Restoring

Restoring replaces the save in this browser, so the panel asks first. `restore()` then:

1. Fetches the backup and checks it is a save this game loads. If not, it stops.
2. Writes the running game, so the copy it keeps is the world as it is now.
3. Copies that save to `<key>.before-restore`, then writes the backup over `<key>`. If the browser refuses
   either write, nothing was replaced.
4. Calls `save.restart()`, which reloads the page into the restored world.

The copy under `<key>.before-restore` is the only way back. Nothing in the game reads it yet. To go back by
hand, copy its value over `greenhollow.save` in the browser's storage and reload.

## Keys

The game listens for keys on the window. A key pressed inside Clerk's box stops at the document, so
typing an email walks nobody, Tab stays in the box and Esc closes only the box.

## Files

| File | What is in it |
|---|---|
| `account.ts` | `createAccount`: the states, backing up and restoring |
| `account.ui.ts` | The panel's contents |
| `session.ts` | The only file that talks to Clerk and Convex |
| `logic.ts` | Reading a save, the words on the panel, swapping a save. No page, no network. |
| `account.test.ts`, `logic.test.ts` | `bun test src/features/account` |

The tables and functions it calls are in `convex/`, described in `convex/README.md`.

There is no demo page under `demos/account` yet.
